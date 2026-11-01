import secrets
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

import auth
import db
import solana_anchor
import storage
from agents import anonymity, clusterer, memory, pipeline, promise_keeper, trace, verifier
from config import settings

router = APIRouter(tags=["student"])
Student = Annotated[dict, Depends(auth.student)]

UPLOAD_TYPES = {
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/3gpp": "3gp",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
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


@router.post("/uploads/media")
async def upload_media(request: Request, user: Student, kind: Literal["voice", "photo", "asset"], report_id: uuid.UUID | None = None):
    """Raw bytes in the body (Content-Type audio/* or image/*). Stored in the object bucket when configured,
    otherwise on the server's disk. Returns the key to send with POST /reports."""
    content_type = (request.headers.get("content-type") or "").split(";")[0].strip()
    ext = UPLOAD_TYPES.get(content_type)
    if not ext or content_type.startswith("audio") != (kind == "voice"):
        raise HTTPException(400, f"Unsupported content type for {kind}: {content_type}")
    data = await request.body()
    if not data or len(data) > 15 * 1024 * 1024:
        raise HTTPException(400, "Empty or too large (15 MB max)")
    rid = report_id or uuid.uuid4()
    folder = "assets" if kind == "asset" else "reports"
    return {"report_id": rid, "key": storage.save(kind, f"{folder}/{rid}.{ext}", data, content_type)}


# ---------- reports ----------

class ReportIn(BaseModel):
    report_id: uuid.UUID | None = None
    text: str | None = None
    voice_key: str | None = None
    photo_key: str | None = None
    lat: float | None = None
    lng: float | None = None
    location_id: uuid.UUID | None = None  # a known place: skips the map step
    asset_code: str | None = None          # a scanned equipment sticker, e.g. RZV-A-014
    floor: str | None = None
    is_sensitive: bool = False
    # Safe Voice: now = confidential officer at once, wait = protected until a pattern or the review deadline,
    # named = formal complaint to the committee with the name below
    handling: Literal["now", "wait", "named"] = "now"
    shared_name: str | None = None


@router.post("/reports", status_code=201)
def create_report(body: ReportIn, user: Student, tasks: BackgroundTasks):
    if not (body.text and body.text.strip()) and not body.voice_key:
        raise HTTPException(400, "Send a voice note or some text")
    report_id = body.report_id or uuid.uuid4()
    for key, bucket in ((body.voice_key, settings.bucket_voice), (body.photo_key, settings.bucket_photos)):
        if key and (not key.startswith((f"{bucket}/reports/", "local/reports/")) or str(report_id) not in key):
            raise HTTPException(400, "Upload key does not match this report")
    asset = None
    if body.asset_code:
        asset = db.fetchone(
            """SELECT a.id, a.floor, a.lat, a.lng, a.location_id, l.name FROM assets a
               LEFT JOIN locations l ON l.id = a.location_id WHERE a.code = %s AND a.status = 'approved'""",
            (body.asset_code.strip().upper(),),
        )
        if not asset:
            raise HTTPException(404, "That equipment sticker is not registered")
    if asset:
        loc = {"id": asset["location_id"], "name": asset["name"]}
        lat, lng = asset["lat"], asset["lng"]
        body.floor = body.floor or asset["floor"]
    elif body.location_id:
        loc = db.fetchone("SELECT id, name, lat, lng FROM locations WHERE id=%s", (body.location_id,))
        if not loc:
            raise HTTPException(404, "Unknown location")
        lat, lng = loc["lat"], loc["lng"]
    elif body.lat is not None and body.lng is not None:
        lat, lng = body.lat, body.lng
        loc = nearest_location(lat, lng)
    else:
        raise HTTPException(400, "Send a location_id (QR sticker) or lat and lng")
    handling = body.handling if body.is_sensitive else None
    if handling == "named" and not (body.shared_name and body.shared_name.strip()):
        raise HTTPException(400, "Tell us the name to share with the committee, or choose another option")
    shared = (body.shared_name or "").strip() or None if handling == "named" else None
    row = db.fetchone(
        """INSERT INTO reports (id, pseudonym, text_original, is_sensitive, location_id, lat, lng, floor,
                                voice_key, photo_key, receipt_code, handling, shared_name, asset_id)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id, receipt_code, created_at""",
        (report_id, user["pseudonym"], (body.text or "").strip() or None, body.is_sensitive,
         loc["id"] if loc else None, lat, lng, body.floor, body.voice_key, body.photo_key,
         receipt_code(), handling, shared, asset["id"] if asset else None),
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
                  i.id AS issue_id, i.code, i.title, i.category, i.status, i.report_count,
                  p.text AS promise_text, p.due_at AS promise_due_at, p.escalation_level
           FROM reports r
           LEFT JOIN issues i ON i.id = r.issue_id
           LEFT JOIN LATERAL (
             SELECT text, due_at, escalation_level FROM promises
             WHERE issue_id = i.id AND status = 'open' ORDER BY created_at DESC LIMIT 1
           ) p ON true
           WHERE r.pseudonym = %s AND NOT r.is_sensitive ORDER BY r.created_at DESC""",
        (user["pseudonym"],),
    )


@router.get("/reports/{report_id}")
def report_receipt(report_id: uuid.UUID, user: Student):
    row = db.fetchone(
        """SELECT r.id, r.receipt_code, r.created_at, r.is_sensitive, r.issue_id, r.handling,
                  i.code, i.title, i.status, i.report_count, i.urgent
           FROM reports r LEFT JOIN issues i ON i.id = r.issue_id
           WHERE r.id = %s AND r.pseudonym = %s""",
        (report_id, user["pseudonym"]),
    )
    if not row:
        raise HTTPException(404, "Report not found")
    return _receipt_view(row)


def _receipt_view(row: dict) -> dict:
    row["processing"] = row["issue_id"] is None
    if row["is_sensitive"]:
        # Never reveal the title, or how many others reported, on a sensitive receipt.
        row["title"], row["report_count"], row["joined_others"] = None, None, None
        if row.get("urgent"):
            row["security"] = security_info()
    else:
        row["joined_others"] = max(0, (row["report_count"] or 1) - 1)
    return row


def security_info() -> dict:
    return {"label": "Call campus security", "phone": settings.campus_security_phone}


@router.get("/reports/by-receipt/{code}")
def report_by_receipt(code: str, user: Student):
    """A student looks up their own report by its receipt code."""
    row = db.fetchone(
        """SELECT r.id, r.receipt_code, r.created_at, r.is_sensitive, r.issue_id, r.handling,
                  i.code, i.title, i.status, i.report_count, i.urgent
           FROM reports r LEFT JOIN issues i ON i.id = r.issue_id
           WHERE r.receipt_code = %s AND r.pseudonym = %s""",
        (code.strip().upper(), user["pseudonym"]),
    )
    if not row:
        raise HTTPException(404, "No report of yours has that code")
    return _receipt_view(row)


class AnonymityIn(BaseModel):
    text: str


_check_log: dict[str, list[float]] = {}


@router.post("/reports/check-anonymity")
def check_anonymity(body: AnonymityIn, user: Student):
    """Before a sensitive report is sent: could this wording identify the student?"""
    import time

    now = time.time()
    recent = [t for t in _check_log.get(user["sub"], []) if now - t < 60]
    if len(recent) >= 6:  # keeps one student from spending the shared Gemini quota
        raise HTTPException(429, "Slow down a little and try again in a minute")
    _check_log[user["sub"]] = recent + [now]
    if not body.text.strip():
        raise HTTPException(400, "Nothing to check")
    verdict = anonymity.check(body.text)
    return {**verdict.model_dump(), "mitraa": (
        "This line could identify you. Want me to make it vaguer?" if verdict.risk != "low"
        else "Looks safe. Nothing here points to you.")}


# ---------- places (QR stickers, map pin) ----------

@router.get("/locations")
def locations(user: Annotated[dict, Depends(auth.current_user)]):
    return db.fetchall("SELECT id, name, lat, lng FROM locations ORDER BY name")


@router.get("/locations/nearest")
def nearest(lat: float, lng: float, user: Annotated[dict, Depends(auth.current_user)]):
    return nearest_location(lat, lng) or {}


@router.get("/help/security")
def help_security(user: Student):
    return security_info()


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
                   EXISTS (SELECT 1 FROM reports r WHERE r.issue_id = i.id AND r.pseudonym = %s) AS mine,
                   d.name AS department, p.text AS promise_text, p.due_at AS promise_due_at, p.escalation_level,
                   EXTRACT(EPOCH FROM (now() - p.due_at)) / 3600 AS hours_late
            FROM issues i LEFT JOIN locations l ON l.id = i.location_id
            LEFT JOIN departments d ON d.id = i.department_id
            LEFT JOIN LATERAL (SELECT text, due_at, escalation_level FROM promises
                               WHERE issue_id = i.id AND status = 'open' ORDER BY created_at DESC LIMIT 1) p ON true
            WHERE i.status NOT IN ('sealed','resolved') AND NOT i.is_sensitive
            ORDER BY distance_m NULLS LAST, i.impact_score DESC LIMIT 50""",
        params,
    )
    if lat is not None:
        rows = [r for r in rows if r["distance_m"] is None or r["distance_m"] <= radius_m]
    return rows


@router.get("/issues/awaiting")
def awaiting(user: Student):
    """Issues the student reported that staff marked fixed and the student has not answered yet."""
    return db.fetchall(
        """SELECT i.id, i.code, i.title, i.category, i.report_count, l.name AS location, d.name AS department
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           LEFT JOIN departments d ON d.id = i.department_id
           WHERE i.status = 'awaiting_confirm'
             AND EXISTS (SELECT 1 FROM reports r WHERE r.issue_id = i.id AND r.pseudonym = %s)
             AND NOT EXISTS (SELECT 1 FROM confirmations c WHERE c.issue_id = i.id AND c.pseudonym = %s)""",
        (user["pseudonym"], user["pseudonym"]),
    )


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
        """SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, i.suggested_fix, i.is_sensitive,
                  i.created_at, i.resolved_at, l.name AS location, d.name AS department
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           LEFT JOIN departments d ON d.id = i.department_id WHERE i.id=%s""",
        (issue_id,),
    )
    if not issue:
        raise HTTPException(404, "Issue not found")
    mine = _is_reporter(issue_id, user["pseudonym"])
    if issue["is_sensitive"] and not mine:
        raise HTTPException(404, "Issue not found")
    if issue["status"] == "sealed":
        if not mine:
            raise HTTPException(404, "Issue not found")
        safe = db.fetchone(
            """SELECT handling, urgent, release_threshold,
                      (SELECT COUNT(DISTINCT pseudonym) FROM reports r WHERE r.issue_id = i.id) AS students
               FROM issues i WHERE id=%s""", (issue_id,))
        from_officer = db.fetchone(
            """SELECT COUNT(*) AS n FROM safe_messages
               WHERE issue_id=%s AND pseudonym=%s AND from_role='officer'""", (issue_id, user["pseudonym"]))["n"]
        return {"id": issue["id"], "code": issue["code"], "status": "sealed", "sealed": True,
                "location": issue["location"], "mine": True, "handling": safe["handling"], "urgent": safe["urgent"],
                "separate_students": safe["students"], "release_threshold": safe["release_threshold"],
                "officer_messages": from_officer, "security": security_info() if safe["urgent"] else None}
    events = db.fetchall(
        "SELECT type, actor, summary, reasoning, created_at, verified FROM issue_events WHERE issue_id=%s ORDER BY created_at",
        (issue_id,),
    )
    for e in events:
        e["verification"] = verifier.label(e.pop("verified"))
    promise = db.fetchone(
        """SELECT text, due_at, status, escalation_level,
                  EXTRACT(EPOCH FROM (now() - due_at)) / 3600 AS hours_late FROM promises
           WHERE issue_id=%s ORDER BY (status='open') DESC, created_at DESC LIMIT 1""",
        (issue_id,),
    )
    confirmed = db.fetchone(
        "SELECT COUNT(*) FILTER (WHERE answer='yes') AS yes, COUNT(*) AS total FROM confirmations WHERE issue_id=%s",
        (issue_id,),
    )
    why_types = {"created", "merged", "classified", "routed", "root_cause", "suggested_fix"}
    cause = db.fetchone(
        """SELECT c.code, c.title, k.reason, k.hits, k.trials FROM issue_links k
           JOIN issues c ON c.id = k.cause_issue_id WHERE k.effect_issue_id = %s ORDER BY k.created_at DESC LIMIT 1""",
        (issue_id,),
    )
    return {
        **issue,
        "mine": mine,
        "cause": cause,
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
    escalated = promise_keeper.escalate_after_dispute(issue_id) if body.answer == "no" else None
    if escalated:
        outcome = "escalated"
        tasks.add_task(trace.to_meko, issue_id, "escalated", "students", f"Escalated to {escalated['to']} by a student")
    elif counts["yes"] > half:
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
    return {"outcome": outcome, "yes": counts["yes"], "no": counts["no"], "reporters": counts["reporters"],
            "escalated_to": escalated["to"] if escalated else None}


# ---------- Safe Voice: anonymous chat with the confidential officer ----------

class MessageIn(BaseModel):
    text: str


def _own_sensitive_issue(issue_id, user: dict) -> dict:
    issue = db.fetchone("SELECT id, is_sensitive FROM issues WHERE id=%s", (issue_id,))
    if not issue or not issue["is_sensitive"] or not _is_reporter(issue_id, user["pseudonym"]):
        raise HTTPException(404, "Issue not found")
    return issue


@router.get("/issues/{issue_id}/safe-messages")
def safe_messages(issue_id: uuid.UUID, user: Student):
    """The student's own thread with the officer. The officer never learns who the student is."""
    _own_sensitive_issue(issue_id, user)
    return db.fetchall(
        """SELECT id, from_role, text, created_at FROM safe_messages
           WHERE issue_id=%s AND pseudonym=%s ORDER BY created_at""",
        (issue_id, user["pseudonym"]),
    )


@router.post("/issues/{issue_id}/safe-messages", status_code=201)
def send_safe_message(issue_id: uuid.UUID, body: MessageIn, user: Student):
    _own_sensitive_issue(issue_id, user)
    if not body.text.strip():
        raise HTTPException(400, "Write a message first")
    return db.fetchone(
        """INSERT INTO safe_messages (issue_id, pseudonym, from_role, text) VALUES (%s,%s,'student',%s)
           RETURNING id, from_role, text, created_at""",
        (issue_id, user["pseudonym"], body.text.strip()[:2000]),
    )


# ---------- profile and scorecard ----------

@router.get("/me")
def me(user: Student):
    row = db.fetchone(
        """SELECT COUNT(*) FILTER (WHERE r.kind = 'report') AS reports,
                  COUNT(*) FILTER (WHERE r.kind = 'me_too') AS me_too,
                  COUNT(DISTINCT r.issue_id) FILTER (WHERE i.status = 'resolved') AS fixed,
                  COUNT(DISTINCT r.issue_id) FILTER (WHERE i.status <> 'resolved') AS open
           FROM reports r LEFT JOIN issues i ON i.id = r.issue_id WHERE r.pseudonym = %s AND NOT r.is_sensitive""",
        (user["pseudonym"],),
    )
    return {"pseudonym": user["pseudonym"], **row}


@router.get("/scorecard")
def scorecard(user: Student):
    """Share of promises each department kept. Same view the staff dashboard uses."""
    return db.fetchall(
        "SELECT name, kept, closed, kept_pct FROM department_scorecard WHERE closed > 0 ORDER BY kept_pct DESC"
    )
