"""Equipment: students register objects (cooler, tap, geyser...), staff approve, and a QR sticker on the object
opens the report screen with the item and place already filled in.

The QR holds only the short code (rezolv://a/RZV-A-014): it names the object, never the person scanning it. The scan
screen shows the object's photo so a pasted-over or swapped sticker is noticed.
"""
import io
import math
import uuid
from pathlib import Path
from typing import Annotated

import segno
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

import auth
import db
import gemini
import storage
from agents import trace
from config import settings
from routes.student import nearest_location

router = APIRouter(tags=["equipment"])
admin = APIRouter(prefix="/admin", tags=["equipment-admin"])
Student = Annotated[dict, Depends(auth.student)]
Staff = Annotated[dict, Depends(auth.staff)]

# type -> (label, issue category the complaints are filed under)
TYPES = {
    "water_cooler": ("Water cooler", "water"),
    "tap": ("Tap or washbasin", "water"),
    "geyser": ("Geyser", "water"),
    "ac": ("Air conditioner", "electricity"),
    "fan": ("Fan", "electricity"),
    "light": ("Light", "electricity"),
    "switchboard": ("Switchboard", "electricity"),
    "wifi_router": ("Wi-Fi router", "internet"),
    "other": ("Other equipment", "other"),
}
NEAR_METRES = 8.0
PHOTO_PREFIXES = (f"{settings.bucket_assets}/assets/", "local/assets/")


def metres(a_lat, a_lng, b_lat, b_lng) -> float:
    dy = (b_lat - a_lat) * 111320
    dx = (b_lng - a_lng) * 111320 * math.cos(math.radians(a_lat))
    return math.hypot(dx, dy)


def view(row: dict) -> dict:
    row["type_label"], row["category"] = TYPES.get(row["type"], TYPES["other"])
    row["photo_url"] = f"/assets/{row['id']}/photo" if row.get("photo_key") else None
    row.pop("photo_key", None)
    return row


COLUMNS = """a.id, a.code, a.name, a.type, a.photo_key, a.floor, a.lat, a.lng, a.status, a.created_at, a.note,
             l.name AS location"""
FROM = "FROM assets a LEFT JOIN locations l ON l.id = a.location_id"


# ---------- student ----------

@router.get("/assets/types")
def types(user: Annotated[dict, Depends(auth.current_user)]):
    return [{"key": k, "label": v[0], "category": v[1]} for k, v in TYPES.items()]


@router.get("/assets")
def list_assets(user: Student):
    """Approved equipment, plus the student's own proposals that are still waiting."""
    rows = db.fetchall(
        f"""SELECT {COLUMNS}, (a.created_by_pseudonym = %s) AS mine {FROM}
            WHERE a.status = 'approved' OR (a.status <> 'retired' AND a.created_by_pseudonym = %s)
            ORDER BY a.status, a.created_at DESC""",
        (user["pseudonym"], user["pseudonym"]),
    )
    return [view(r) for r in rows]


class CheckIn(BaseModel):
    type: str
    lat: float
    lng: float
    floor: str | None = None


@router.post("/assets/check")
def check_duplicate(body: CheckIn, user: Student):
    """Is the same kind of item already registered within a few metres on the same floor?"""
    rows = db.fetchall(
        f"SELECT {COLUMNS} {FROM} WHERE a.type = %s AND a.status <> 'retired' AND a.floor IS NOT DISTINCT FROM %s",
        (body.type, body.floor),
    )
    near = [(metres(body.lat, body.lng, r["lat"], r["lng"]), r) for r in rows]
    similar = [{**view(r), "distance_m": round(d)} for d, r in sorted(near, key=lambda x: x[0]) if d <= NEAR_METRES]
    return {"similar": similar}


class SuggestIn(BaseModel):
    photo_key: str


@router.post("/assets/suggest-type")
def suggest_type(body: SuggestIn, user: Student):
    """Gemini looks at the photo and suggests the type. Only a suggestion: the student confirms."""
    if not body.photo_key.startswith(PHOTO_PREFIXES):
        raise HTTPException(400, "Not an equipment photo")
    if not gemini.enabled():
        return {"type": None, "confidence": 0}
    try:
        data = storage.download(body.photo_key)
    except Exception:
        raise HTTPException(404, "Photo not found")
    guess = gemini.suggest_asset_type(data, "image/jpeg", list(TYPES))
    return {"type": guess.type if guess and guess.type != "other" else None, "confidence": guess.confidence if guess else 0}


class AssetIn(BaseModel):
    name: str
    type: str
    photo_key: str
    lat: float
    lng: float
    floor: str | None = None


@router.post("/assets", status_code=201)
def propose(body: AssetIn, user: Student):
    if body.type not in TYPES:
        raise HTTPException(400, "Unknown equipment type")
    name = body.name.strip()
    if len(name) < 3:
        raise HTTPException(400, "Give the item a name, for example: Cooler near the library entrance")
    if not body.photo_key.startswith(PHOTO_PREFIXES):
        raise HTTPException(400, "Take a photo of the equipment first")
    loc = nearest_location(body.lat, body.lng)
    row = db.fetchone(
        f"""INSERT INTO assets (code, name, type, photo_key, location_id, floor, lat, lng, created_by_pseudonym)
            VALUES ('RZV-A-' || lpad(nextval('asset_code_seq')::text, 3, '0'), %s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, code, name, type, photo_key, floor, lat, lng, status, created_at, note,
                      NULL::text AS location""",
        (name[:80], body.type, body.photo_key, loc["id"] if loc else None, body.floor, body.lat, body.lng, user["pseudonym"]),
    )
    row["location"] = loc["name"] if loc else None
    return view(row)


@router.get("/assets/by-code/{code}")
def by_code(code: str, user: Student):
    """The scan landing screen: the item, its photo, and how many complaints it has had."""
    row = db.fetchone(
        f"""SELECT {COLUMNS}, a.created_by_pseudonym {FROM} WHERE a.code = %s""", (code.strip().upper(),)
    )
    if not row or row["status"] == "retired":
        raise HTTPException(404, "This sticker is not registered, or the item was removed")
    if row["status"] == "proposed" and row.pop("created_by_pseudonym") != user["pseudonym"]:
        raise HTTPException(409, "This item is waiting for staff approval")
    row.pop("created_by_pseudonym", None)
    stats = db.fetchone(
        """SELECT COUNT(*) AS issues, COUNT(*) FILTER (WHERE status <> 'resolved') AS open
           FROM issues WHERE asset_id = %s""", (row["id"],))
    return {**view(row), "issues": stats["issues"], "open_issues": stats["open"], "category": TYPES.get(row["type"], TYPES["other"])[1]}


@router.get("/assets/{asset_id}/photo")
def photo(asset_id: uuid.UUID):
    """Equipment photos are not personal data, so the photo is served without a login (an unguessable id)."""
    row = db.fetchone("SELECT photo_key FROM assets WHERE id = %s", (asset_id,))
    if not row or not row["photo_key"]:
        raise HTTPException(404, "No photo")
    try:
        data = storage.download(row["photo_key"])
    except Exception:
        raise HTTPException(404, "Photo not found")
    return Response(data, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


# ---------- staff ----------

def history(asset_id) -> dict:
    stats = db.fetchone(
        """SELECT COUNT(*) AS issues,
                  COUNT(*) FILTER (WHERE status = 'resolved') AS fixed,
                  COALESCE(SUM(report_count), 0) AS complaints,
                  ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) FILTER (WHERE status = 'resolved')::numeric, 1)
                    AS avg_hours_to_fix
           FROM issues WHERE asset_id = %s AND NOT is_sensitive""", (asset_id,))
    issues = db.fetchall(
        """SELECT i.id, i.code, i.title, i.status, i.report_count, i.created_at, i.resolved_at, d.name AS department
           FROM issues i LEFT JOIN departments d ON d.id = i.department_id
           WHERE i.asset_id = %s AND NOT i.is_sensitive ORDER BY i.created_at DESC""", (asset_id,))
    return {"stats": stats, "issues": issues}


@admin.get("/assets")
def admin_list(user: Staff, status: str | None = None):
    rows = db.fetchall(
        f"""SELECT {COLUMNS}, a.created_by_pseudonym,
                   (SELECT COUNT(*) FROM issues i WHERE i.asset_id = a.id) AS issues,
                   (SELECT COALESCE(SUM(i.report_count), 0) FROM issues i WHERE i.asset_id = a.id) AS complaints
            {FROM} WHERE (%s::text IS NULL OR a.status = %s) AND a.status <> 'retired'
            ORDER BY (a.status = 'proposed') DESC, a.created_at DESC""",
        (status, status),
    )
    return [view(r) for r in rows]


@admin.get("/assets/{asset_id}")
def admin_detail(asset_id: uuid.UUID, user: Staff):
    row = db.fetchone(f"SELECT {COLUMNS}, a.created_by_pseudonym, a.approved_at {FROM} WHERE a.id = %s", (asset_id,))
    if not row:
        raise HTTPException(404, "Equipment not found")
    return {**view(row), **history(asset_id), "link": link(row["code"])}


class Decision(BaseModel):
    note: str | None = None


def _decide(asset_id, user: dict, status: str, note: str | None):
    row = db.fetchone("SELECT id, code, status FROM assets WHERE id = %s", (asset_id,))
    if not row:
        raise HTTPException(404, "Equipment not found")
    if row["status"] != "proposed":
        raise HTTPException(409, f"Already {row['status']}")
    db.execute(
        "UPDATE assets SET status=%s, approved_by=%s, approved_at=now(), note=%s WHERE id=%s",
        (status, user["sub"], (note or "").strip() or None, asset_id),
    )
    return {"code": row["code"], "status": status}


@admin.post("/assets/{asset_id}/approve")
def approve(asset_id: uuid.UUID, user: Staff, body: Decision | None = None):
    return _decide(asset_id, user, "approved", body.note if body else None)


@admin.post("/assets/{asset_id}/reject")
def reject(asset_id: uuid.UUID, user: Staff, body: Decision | None = None):
    return _decide(asset_id, user, "retired", body.note if body else None)


def link(code: str) -> str:
    return f"{settings.qr_link_prefix}{code}"


def _approved(asset_id) -> dict:
    row = db.fetchone(f"SELECT {COLUMNS} {FROM} WHERE a.id = %s", (asset_id,))
    if not row:
        raise HTTPException(404, "Equipment not found")
    if row["status"] != "approved":
        raise HTTPException(409, "Only approved equipment gets a QR code")  # no printable QR for unapproved items
    return row


@admin.get("/assets/{asset_id}/qr.svg")
def qr_svg(asset_id: uuid.UUID, user: Staff):
    row = _approved(asset_id)
    buf = io.BytesIO()
    segno.make(link(row["code"]), error="m").save(buf, kind="svg", scale=10, border=2, dark="#0f766e")
    return Response(buf.getvalue(), media_type="image/svg+xml")


@admin.get("/assets/{asset_id}/label.pdf")
def label_pdf(asset_id: uuid.UUID, user: Staff):
    """A6 sticker: Mitraa, the item name, its code and the QR code."""
    from reportlab.lib.colors import HexColor, white
    from reportlab.lib.pagesizes import A6
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    row = _approved(asset_id)
    w, h = A6
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A6)
    c.setTitle(f"ReZolv label {row['code']}")
    c.setFillColor(HexColor("#d3f1ed"))
    c.rect(0, 0, w, h, stroke=0, fill=1)
    c.setFillColor(white)
    c.roundRect(10, 10, w - 20, h - 20, 12, stroke=0, fill=1)

    icon = Path(__file__).resolve().parents[2] / "mobileApp" / "assets" / "images" / "icon.png"
    if icon.exists():
        c.drawImage(ImageReader(str(icon)), 22, h - 78, width=56, height=56, mask="auto")
    c.setFillColor(HexColor("#0f766e"))
    c.setFont("Helvetica-Bold", 22)
    c.drawString(90, h - 48, "ReZolv")
    c.setFillColor(HexColor("#55696b"))
    c.setFont("Helvetica", 9)
    c.drawString(90, h - 62, "Something wrong with this? Scan.")

    qr = segno.make(link(row["code"]), error="m")
    size = qr.symbol_size(scale=1, border=0)[0]
    box = w - 80
    cell = box / size
    x0, y0 = 40, h - 100 - box
    c.setFillColor(HexColor("#14232a"))
    for r, line in enumerate(qr.matrix):
        for k, bit in enumerate(line):
            if bit:
                c.rect(x0 + k * cell, y0 + (size - 1 - r) * cell, cell + 0.2, cell + 0.2, stroke=0, fill=1)

    c.setFillColor(HexColor("#14232a"))
    c.setFont("Helvetica-Bold", 14)
    name = row["name"]
    lines, cur = [], ""
    for word in name.split():
        if c.stringWidth(f"{cur} {word}".strip(), "Helvetica-Bold", 14) > w - 50:
            lines.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}".strip()
    lines.append(cur)
    y = y0 - 22
    for ln in lines[:2]:
        c.drawCentredString(w / 2, y, ln)
        y -= 17
    c.setFont("Courier-Bold", 13)
    c.setFillColor(HexColor("#0f766e"))
    c.drawCentredString(w / 2, 26, row["code"])
    c.showPage()
    c.save()
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'inline; filename="{row["code"]}.pdf"'})
