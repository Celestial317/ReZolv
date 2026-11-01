"""Safe Voice for the confidential officer and the committee.

Who sees what:
  officer    every sensitive case. Urgent first, then "talk now", then "waiting, due in X days" (counts only until the
             deadline, then an identifier-free summary), then cases already released to the committee.
  committee  only cases released to it: group concerns (texts with identifiers removed, no pseudonyms) and named
             complaints (the name the student chose to share).
  everyone else  counts only (see /admin/sealed). They never reach these routes.
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
import db
from agents import privacy, router as router_agent, trace
from agents.safe_review import redact
from config import settings

router = APIRouter(prefix="/safe", tags=["safe-voice"])
SafeStaff = Annotated[dict, Depends(auth.safe_staff)]

BASE = """SELECT i.id, i.code, i.status, i.handling, i.urgent, i.flagged, i.release_threshold, i.created_at,
                 i.reviewed_at, i.safe_summary, l.name AS location,
                 (SELECT COUNT(DISTINCT r.pseudonym) FROM reports r WHERE r.issue_id = i.id) AS students,
                 i.created_at + make_interval(days => %s) AS review_due_at,
                 (SELECT COUNT(*) FROM safe_messages m WHERE m.issue_id = i.id AND m.from_role = 'student'
                    AND m.created_at > COALESCE((SELECT MAX(o.created_at) FROM safe_messages o
                                                 WHERE o.issue_id = i.id AND o.pseudonym = m.pseudonym
                                                   AND o.from_role = 'officer'), 'epoch')) AS unanswered
          FROM issues i LEFT JOIN locations l ON l.id = i.location_id
          WHERE i.is_sensitive AND i.status <> 'resolved' """


def _need_officer(user: dict) -> None:
    if user["role"] != "officer":
        raise HTTPException(403, "Confidential officer only")


@router.get("/inbox")
def inbox(user: SafeStaff):
    rows = db.fetchall(BASE + "ORDER BY i.urgent DESC, i.created_at DESC", (settings.safe_review_days,))
    for r in rows:
        due = r["review_due_at"]
        r["days_left"] = max(0, (due - db.fetchone("SELECT now() AS t")["t"]).days) if r["handling"] == "wait" else None
        r.pop("safe_summary")  # summaries are only on the detail view
    if user["role"] == "committee":
        return {"released": [r for r in rows if r["status"] != "sealed"]}
    return {
        "urgent": [r for r in rows if r["urgent"] and r["status"] == "sealed"],
        "talk_now": [r for r in rows if not r["urgent"] and r["handling"] == "now" and r["status"] == "sealed"],
        "waiting": [r for r in rows if r["handling"] == "wait" and r["status"] == "sealed" and not r["reviewed_at"]],
        "reviewed": [r for r in rows if r["handling"] == "wait" and r["status"] == "sealed" and r["reviewed_at"]],
        "released": [r for r in rows if r["status"] != "sealed"],
        "security": {"label": "Call campus security", "phone": settings.campus_security_phone},
    }


def _load(issue_id: uuid.UUID, user: dict) -> dict:
    issue = db.fetchone(BASE + "AND i.id = %s", (settings.safe_review_days, issue_id))
    if not issue:
        raise HTTPException(404, "Case not found")
    if user["role"] == "committee" and issue["status"] == "sealed":
        raise HTTPException(403, "This case has not been released to the committee")
    return issue


@router.get("/issues/{issue_id}")
def detail(issue_id: uuid.UUID, user: SafeStaff):
    issue = _load(issue_id, user)
    officer = user["role"] == "officer"
    waiting = issue["handling"] == "wait" and issue["status"] == "sealed" and not issue["reviewed_at"]
    reports = []
    if not waiting:
        rows = db.fetchall(
            """SELECT id, pseudonym, text_original, text_en, lang, severity, floor, created_at, shared_name
               FROM reports WHERE issue_id=%s ORDER BY created_at""",
            (issue_id,),
        )
        for r in rows:
            row = {"id": r["id"], "lang": r["lang"], "severity": r["severity"], "floor": r["floor"],
                   "created_at": r["created_at"]}
            reviewed_only = issue["handling"] == "wait" and issue["status"] == "sealed"
            if reviewed_only:
                continue  # after the 7-day review the officer reads the summary, never the raw words
            if officer:
                row.update(pseudonym=r["pseudonym"], text_original=r["text_original"], text_en=r["text_en"])
            else:  # committee: no pseudonyms, identifiers removed, name only for a formal complaint
                row.update(text_en=redact(r["text_en"] or r["text_original"] or ""))
                if issue["handling"] == "named":
                    row["shared_name"] = r["shared_name"]
            reports.append(row)
    events = db.fetchall(
        "SELECT type, actor, summary, reasoning, created_at FROM issue_events WHERE issue_id=%s ORDER BY created_at",
        (issue_id,),
    )
    out = {k: issue[k] for k in ("id", "code", "status", "handling", "urgent", "flagged", "location", "students",
                                  "release_threshold", "created_at", "review_due_at", "reviewed_at")}
    out.update(reports=reports, events=events, waiting_for_review=waiting,
               summary=issue["safe_summary"] if not waiting else None,
               security={"label": "Call campus security", "phone": settings.campus_security_phone} if issue["urgent"] else None)
    if officer:
        msgs = db.fetchall(
            "SELECT pseudonym, from_role, text, created_at FROM safe_messages WHERE issue_id=%s ORDER BY created_at",
            (issue_id,),
        )
        threads: dict[str, list] = {}
        for m in msgs:
            threads.setdefault(m["pseudonym"], []).append({k: m[k] for k in ("from_role", "text", "created_at")})
        out["threads"] = threads
    return out


class MessageIn(BaseModel):
    text: str
    pseudonym: str | None = None  # omit to write to every student on the case


@router.post("/issues/{issue_id}/messages", status_code=201)
def message(issue_id: uuid.UUID, body: MessageIn, user: SafeStaff):
    """The officer writes to a student by pseudonym. The student answers in the app; the officer never sees who they are."""
    _need_officer(user)
    issue = _load(issue_id, user)
    if issue["handling"] == "wait" and issue["status"] == "sealed" and not issue["reviewed_at"]:
        raise HTTPException(409, "This case is still waiting. Messages open after the review deadline or an early release.")
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "Write a message first")
    names = [body.pseudonym] if body.pseudonym else [
        r["pseudonym"] for r in db.fetchall("SELECT DISTINCT pseudonym FROM reports WHERE issue_id=%s", (issue_id,))]
    for n in names:
        db.execute(
            "INSERT INTO safe_messages (issue_id, pseudonym, from_role, text) VALUES (%s,%s,'officer',%s)",
            (issue_id, n, text[:2000]),
        )
    db.execute("UPDATE issues SET officer_id=COALESCE(officer_id, %s) WHERE id=%s", (user["sub"], issue_id))
    return {"sent_to": len(names)}


@router.post("/issues/{issue_id}/release")
def release(issue_id: uuid.UUID, user: SafeStaff):
    """The officer sends the case to the full committee early (for example after a conversation with the student)."""
    _need_officer(user)
    issue = _load(issue_id, user)
    if issue["status"] != "sealed":
        raise HTTPException(409, "Already with the committee")
    db.execute("UPDATE issues SET status='open' WHERE id=%s", (issue_id,))
    trace.record(issue_id, "released", "confidential_officer", "Sent to the committee by the confidential officer",
                 "The officer judged that the committee should act on it now.", sync_meko=False)
    router_agent.run(issue_id)
    return {"status": "open"}


@router.post("/issues/{issue_id}/fixed")
def fixed(issue_id: uuid.UUID, user: SafeStaff):
    """Mark the case handled. The students who reported it then confirm, as for any other issue."""
    issue = _load(issue_id, user)
    if issue["status"] == "awaiting_confirm":
        raise HTTPException(409, "Already waiting for the students")
    db.execute("UPDATE issues SET status='awaiting_confirm' WHERE id=%s", (issue_id,))
    trace.record(issue_id, "fixed", user["role"], "Marked as handled, waiting for the students to confirm",
                 sync_meko=False)
    return {"status": "awaiting_confirm"}
