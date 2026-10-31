import secrets
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

import auth
import db
import solana_anchor
import storage
from agents import clusterer, memory, pipeline, trace
from config import settings

router = APIRouter(tags=["student"])
Student = Annotated[dict, Depends(auth.student)]

UPLOAD_TYPES = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "image/jpeg": "jpg",
    "image/png": "png",
}


def receipt_code() -> str:
    return f"RZV-R-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"


def nearest_location(lat: float, lng: float) -> dict | None:
    return db.fetchone(
        "SELECT id, name FROM locations ORDER BY (lat - %s)^2 + (lng - %s)^2 LIMIT 1", (lat, lng)
    )


# ---------- uploads ----------

class PresignIn(BaseModel):
    type: Literal["voice", "photo"]
    content_type: str | None = None
    report_id: uuid.UUID | None = None  # reuse the id from the voice presign for the photo


@router.post("/uploads/presign")
def presign(body: PresignIn, user: Student):
    if not storage.enabled():
        raise HTTPException(503, "Object storage is not configured (VULTR_S3_* in .env)")
    content_type = body.content_type or ("audio/webm" if body.type == "voice" else "image/jpeg")
    ext = UPLOAD_TYPES.get(content_type)
    if not ext or content_type.startswith("audio") != (body.type == "voice"):
        raise HTTPException(400, f"Unsupported content type for {body.type}: {content_type}")
    report_id = body.report_id or uuid.uuid4()
    bucket = storage.bucket_for(body.type)
    key = f"reports/{report_id}.{ext}"
    return {
        "report_id": report_id,
        "key": f"{bucket}/{key}",
        "url": storage.presign_put(bucket, key, content_type),
        "content_type": content_type,
    }


# ---------- reports ----------

class ReportIn(BaseModel):
    report_id: uuid.UUID | None = None
    text: str | None = None
    voice_key: str | None = None
    photo_key: str | None = None
    lat: float
    lng: float
    floor: str | None = None
    is_sensitive: bool = False


@router.post("/reports", status_code=201)
def create_report(body: ReportIn, user: Student, tasks: BackgroundTasks):
    if not (body.text and body.text.strip()) and not body.voice_key:
        raise HTTPException(400, "Send a voice note or some text")
    report_id = body.report_id or uuid.uuid4()
    for key, bucket in ((body.voice_key, settings.bucket_voice), (body.photo_key, settings.bucket_photos)):
        if key and (not key.startswith(f"{bucket}/reports/") or str(report_id) not in key):
            raise HTTPException(400, "Upload key does not match this report")
    loc = nearest_location(body.lat, body.lng)
    row = db.fetchone(
        """INSERT INTO reports (id, pseudonym, text_original, is_sensitive, location_id, lat, lng, floor,
                                voice_key, photo_key, receipt_code)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, receipt_code, created_at""",
        (report_id, user["pseudonym"], (body.text or "").strip() or None, body.is_sensitive,
         loc["id"] if loc else None, body.lat, body.lng, body.floor, body.voice_key, body.photo_key,
         receipt_code()),
    )
    tasks.add_task(pipeline.process_report, row["id"])
    if solana_anchor.enabled():
        tasks.add_task(solana_anchor.anchor, "report", row["id"], row["receipt_code"], str(row["created_at"]))
    return {
        "report_id": row["id"],
        "receipt_code": row["receipt_code"],
        "location": loc["name"] if loc else None,
        "status": "processing",
    }


@router.get("/reports/mine")
def my_reports(user: Student):
    return db.fetchall(
        """SELECT r.id, r.receipt_code, r.kind, r.is_sensitive, r.created_at,
                  COALESCE(r.text_en, r.text_original) AS text,
                  i.id AS issue_id, i.code, i.title, i.status, i.report_count,
                  p.text AS promise_text, p.due_at AS promise_due_at, p.escalation_level
           FROM reports r
           LEFT JOIN issues i ON i.id = r.issue_id
           LEFT JOIN LATERAL (
             SELECT text, due_at, escalation_level FROM promises
             WHERE issue_id = i.id AND status = 'open' ORDER BY created_at DESC LIMIT 1
           ) p ON true
           WHERE r.pseudonym = %s ORDER BY r.created_at DESC""",
        (user["pseudonym"],),
    )


@router.get("/reports/{report_id}")
def report_receipt(report_id: uuid.UUID, user: Student):
    row = db.fetchone(
        """SELECT r.id, r.receipt_code, r.created_at, r.is_sensitive, r.issue_id,
                  i.code, i.title, i.status, i.report_count
           FROM reports r LEFT JOIN issues i ON i.id = r.issue_id
           WHERE r.id = %s AND r.pseudonym = %s""",
        (report_id, user["pseudonym"]),
    )
    if not row:
        raise HTTPException(404, "Report not found")
    row["processing"] = row["issue_id"] is None
    row["joined_others"] = max(0, (row["report_count"] or 1) - 1)
    return row


# ---------- issues ----------

@router.get("/issues/nearby")
def nearby(user: Student, lat: float | None = None, lng: float | None = None, radius_m: float = 2000):
    dist = "NULL::float"
    params: list = [user["pseudonym"]]
    if lat is not None and lng is not None:
        dist = ("sqrt(power((l.lat - %s) * 111320, 2) + "
                "power((l.lng - %s) * 111320 * cos(radians(%s)), 2))")
        params = [lat, lng, lat] + params
    rows = db.fetchall(
        f"""SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, i.impact_score,
                   l.name AS location, l.lat, l.lng, {dist} AS distance_m,
                   EXISTS (SELECT 1 FROM reports r WHERE r.issue_id = i.id AND r.pseudonym = %s) AS mine
            FROM issues i LEFT JOIN locations l ON l.id = i.location_id
            WHERE i.status NOT IN ('sealed','resolved')
            ORDER BY distance_m NULLS LAST, i.impact_score DESC LIMIT 50""",
        params,
    )
    if lat is not None:
        rows = [r for r in rows if r["distance_m"] is None or r["distance_m"] <= radius_m]
    return rows


def _is_reporter(issue_id, pseudonym: str) -> bool:
    return db.fetchone(
        "SELECT 1 AS x FROM reports WHERE issue_id=%s AND pseudonym=%s LIMIT 1", (issue_id, pseudonym)
    ) is not None


@router.post("/issues/{issue_id}/metoo", status_code=201)
def me_too(issue_id: uuid.UUID, user: Student, tasks: BackgroundTasks):
    issue = db.fetchone("SELECT id, category, location_id, status FROM issues WHERE id=%s", (issue_id,))
    if not issue or issue["status"] in ("sealed", "resolved"):
        raise HTTPException(404, "Issue not found")
    if _is_reporter(issue_id, user["pseudonym"]):
        raise HTTPException(409, "You already reported this")
    row = db.fetchone(
        """INSERT INTO reports (issue_id, pseudonym, kind, category, location_id, receipt_code)
           VALUES (%s,%s,'me_too',%s,%s,%s) RETURNING id, receipt_code""",
        (issue_id, user["pseudonym"], issue["category"], issue["location_id"], receipt_code()),
    )
    clusterer.refresh_counts(issue_id)
    trace.record(issue_id, "merged", "clusterer", "Another student said 'me too'",
                 "Counted as a separate reporter on this issue.", sync_meko=False)
    count = db.fetchone("SELECT report_count FROM issues WHERE id=%s", (issue_id,))["report_count"]
    return {"report_id": row["id"], "receipt_code": row["receipt_code"], "report_count": count}


@router.get("/issues/{issue_id}")
def issue_detail(issue_id: uuid.UUID, user: Student):
    issue = db.fetchone(
        """SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, i.suggested_fix,
                  i.created_at, i.resolved_at, l.name AS location, d.name AS department
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           LEFT JOIN departments d ON d.id = i.department_id WHERE i.id=%s""",
        (issue_id,),
    )
    if not issue:
        raise HTTPException(404, "Issue not found")
    mine = _is_reporter(issue_id, user["pseudonym"])
    if issue["status"] == "sealed":
        if not mine:
            raise HTTPException(404, "Issue not found")
        return {"id": issue["id"], "code": issue["code"], "status": "sealed", "sealed": True,
                "location": issue["location"], "mine": True}
    events = db.fetchall(
        "SELECT type, actor, summary, reasoning, created_at FROM issue_events WHERE issue_id=%s ORDER BY created_at",
        (issue_id,),
    )
    promise = db.fetchone(
        """SELECT text, due_at, status, escalation_level FROM promises
           WHERE issue_id=%s ORDER BY (status='open') DESC, created_at DESC LIMIT 1""",
        (issue_id,),
    )
    confirmed = db.fetchone(
        "SELECT COUNT(*) FILTER (WHERE answer='yes') AS yes, COUNT(*) AS total FROM confirmations WHERE issue_id=%s",
        (issue_id,),
    )
    why_types = {"created", "merged", "classified", "routed", "root_cause", "suggested_fix"}
    return {
        **issue,
        "mine": mine,
        "promise": promise,
        "events": events,
        "why": [e for e in events if e["type"] in why_types],
        "confirmations": confirmed,
        "my_confirmation": (db.fetchone(
            "SELECT answer FROM confirmations WHERE issue_id=%s AND pseudonym=%s",
            (issue_id, user["pseudonym"])) or {}).get("answer"),
    }


class ConfirmIn(BaseModel):
    answer: Literal["yes", "partly", "no"]
    note: str | None = None


@router.post("/issues/{issue_id}/confirm")
def confirm_fix(issue_id: uuid.UUID, body: ConfirmIn, user: Student, tasks: BackgroundTasks):
    issue = db.fetchone("SELECT id, code, status FROM issues WHERE id=%s", (issue_id,))
    if not issue or not _is_reporter(issue_id, user["pseudonym"]):
        raise HTTPException(404, "Issue not found")
    if issue["status"] != "awaiting_confirm":
        raise HTTPException(409, "This issue is not waiting for confirmation")

    db.execute(
        """INSERT INTO confirmations (issue_id, pseudonym, answer, note) VALUES (%s,%s,%s,%s)
           ON CONFLICT (issue_id, pseudonym) DO UPDATE SET answer = EXCLUDED.answer, note = EXCLUDED.note,
                                                           created_at = now()""",
        (issue_id, user["pseudonym"], body.answer, body.note),
    )
    counts = db.fetchone(
        """SELECT COUNT(*) FILTER (WHERE answer='yes') AS yes, COUNT(*) FILTER (WHERE answer='no') AS no,
                  (SELECT COUNT(DISTINCT pseudonym) FROM reports WHERE issue_id=%s) AS reporters
           FROM confirmations WHERE issue_id=%s""",
        (issue_id, issue_id),
    )
    half = counts["reporters"] / 2
    outcome = "pending"
    if counts["yes"] > half:
        outcome = "resolved"
        with db.tx() as c:
            c.execute("UPDATE issues SET status='resolved', resolved_at=now() WHERE id=%s", (issue_id,))
            c.execute("UPDATE promises SET status='kept', closed_at=now() WHERE issue_id=%s AND status='open'",
                      (issue_id,))
        trace.record(issue_id, "confirmed", "students",
                     f"{counts['yes']} of {counts['reporters']} students confirmed the fix",
                     "Majority confirmed, so the issue is resolved and the promise is marked kept.",
                     sync_meko=False)
        tasks.add_task(trace.to_meko, issue_id, "confirmed", "students", "Resolved by student confirmation")
        tasks.add_task(memory.save_playbook, issue_id)
    elif counts["no"] > half:
        outcome = "reopened"
        db.execute("UPDATE issues SET status='open' WHERE id=%s", (issue_id,))
        trace.record(issue_id, "reopened", "students",
                     f"{counts['no']} of {counts['reporters']} students say it is not fixed",
                     "Majority said the fix did not work, so the issue is open again.", sync_meko=False)
        tasks.add_task(trace.to_meko, issue_id, "reopened", "students", "Reopened by students")
    return {"outcome": outcome, "yes": counts["yes"], "no": counts["no"], "reporters": counts["reporters"]}
