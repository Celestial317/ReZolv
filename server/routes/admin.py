import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

import auth
import db
import solana_anchor
import storage
from agents import promise_keeper, trace

router = APIRouter(prefix="/admin", tags=["admin"])
Staff = Annotated[dict, Depends(auth.staff)]

AGENT_NAMES = ("intake", "clusterer", "privacy_guardian", "router", "root_cause", "memory", "promise_keeper")


def dept_filter(user: dict, column: str = "i.department_id") -> tuple[str, list]:
    """Dept heads only see their own department. Everyone else sees all."""
    if user["role"] == "dept_head":
        return f" AND {column} = %s", [user["department_id"]]
    return "", []


def load_issue(issue_id: uuid.UUID, user: dict) -> dict:
    """Fetch an issue for staff. Sealed issues are never exposed here."""
    issue = db.fetchone(
        """SELECT i.id, i.code, i.title, i.category, i.status, i.is_sensitive, i.report_count,
                  i.impact_score, i.suggested_fix, i.department_id, i.created_at, i.resolved_at,
                  l.name AS location, l.lat, l.lng, d.name AS department
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           LEFT JOIN departments d ON d.id = i.department_id WHERE i.id=%s""",
        (issue_id,),
    )
    if not issue or issue["status"] == "sealed":
        raise HTTPException(404, "Issue not found")
    if user["role"] == "dept_head" and str(issue["department_id"]) != str(user["department_id"]):
        raise HTTPException(403, "Not your department")
    return issue


# ---------- overview ----------

@router.get("/overview")
def overview(user: Staff):
    where, params = dept_filter(user)
    tiles = db.fetchone(
        f"""SELECT
              COUNT(*) FILTER (WHERE i.status IN ('open','in_progress','awaiting_confirm')) AS open_issues,
              COUNT(*) FILTER (WHERE i.status = 'resolved' AND i.resolved_at > now() - INTERVAL '7 days') AS resolved_7d,
              COALESCE(SUM(i.report_count) FILTER (WHERE i.status <> 'resolved'), 0) AS open_reports
            FROM issues i WHERE i.status <> 'sealed'{where}""",
        params,
    )
    tiles["reports_24h"] = db.fetchone(
        f"""SELECT COUNT(*) AS n FROM reports r JOIN issues i ON i.id = r.issue_id
            WHERE i.status <> 'sealed' AND r.created_at > now() - INTERVAL '24 hours'{where}""",
        params,
    )["n"]
    tiles["overdue_promises"] = db.fetchone(
        f"""SELECT COUNT(*) AS n FROM promises p JOIN issues i ON i.id = p.issue_id
            WHERE p.status='open' AND p.due_at < now() AND i.status <> 'sealed'{where}""",
        params,
    )["n"]
    tiles["sealed"] = db.fetchone("SELECT COUNT(*) AS n FROM issues WHERE status='sealed'")["n"]
    top = db.fetchall(
        f"""SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, i.impact_score,
                   l.name AS location, d.name AS department
            FROM issues i LEFT JOIN locations l ON l.id = i.location_id
            LEFT JOIN departments d ON d.id = i.department_id
            WHERE i.status NOT IN ('sealed','resolved'){where}
            ORDER BY i.impact_score DESC, i.report_count DESC LIMIT 5""",
        params,
    )
    alert = db.fetchone(
        f"""SELECT c.code AS cause_code, c.title AS cause_title, e.id AS effect_id, e.code AS effect_code,
                   e.title AS effect_title, k.reason, k.confidence, k.created_at, l.name AS location
            FROM issue_links k JOIN issues c ON c.id = k.cause_issue_id JOIN issues e ON e.id = k.effect_issue_id
            LEFT JOIN locations l ON l.id = e.location_id
            WHERE e.status NOT IN ('sealed','resolved') AND c.status <> 'sealed'
              {where.replace('i.department_id', 'e.department_id')}
            ORDER BY k.created_at DESC LIMIT 1""",
        params,
    )
    return {"tiles": tiles, "top_issues": top, "root_cause_alert": alert}


# ---------- issues ----------

@router.get("/issues")
def list_issues(user: Staff, status: str | None = None, dept: uuid.UUID | None = None):
    where, params = dept_filter(user)
    if status:
        where += " AND i.status = %s"
        params.append(status)
    if dept and user["role"] != "dept_head":
        where += " AND i.department_id = %s"
        params.append(dept)
    return db.fetchall(
        f"""SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, i.impact_score,
                   i.created_at, l.name AS location, d.name AS department,
                   (SELECT MAX(p.escalation_level) FROM promises p WHERE p.issue_id = i.id AND p.status='open')
                     AS escalation_level,
                   (SELECT MIN(p.due_at) FROM promises p WHERE p.issue_id = i.id AND p.status='open') AS promise_due_at
            FROM issues i LEFT JOIN locations l ON l.id = i.location_id
            LEFT JOIN departments d ON d.id = i.department_id
            WHERE i.status <> 'sealed'{where}
            ORDER BY i.impact_score DESC, i.created_at DESC""",
        params,
    )


@router.get("/issues/{issue_id}")
def issue_detail(issue_id: uuid.UUID, user: Staff):
    issue = load_issue(issue_id, user)
    reports = db.fetchall(
        """SELECT id, pseudonym, kind, text_original, text_en, lang, severity, floor, created_at,
                  voice_key IS NOT NULL AS has_voice, photo_key IS NOT NULL AS has_photo
           FROM reports WHERE issue_id=%s ORDER BY created_at""",
        (issue_id,),
    )
    events = db.fetchall(
        "SELECT type, actor, summary, reasoning, created_at FROM issue_events WHERE issue_id=%s ORDER BY created_at",
        (issue_id,),
    )
    promises = db.fetchall(
        """SELECT p.id, p.text, p.due_at, p.status, p.escalation_level, p.created_at, p.closed_at,
                  d.name AS department
           FROM promises p JOIN departments d ON d.id = p.department_id
           WHERE p.issue_id=%s ORDER BY p.created_at DESC""",
        (issue_id,),
    )
    links = db.fetchall(
        """SELECT 'cause' AS role, i.code, i.title, k.reason, k.confidence
             FROM issue_links k JOIN issues i ON i.id = k.cause_issue_id WHERE k.effect_issue_id=%s
           UNION ALL
           SELECT 'effect', i.code, i.title, k.reason, k.confidence
             FROM issue_links k JOIN issues i ON i.id = k.effect_issue_id WHERE k.cause_issue_id=%s""",
        (issue_id, issue_id),
    )
    confirmations = db.fetchone(
        """SELECT COUNT(*) FILTER (WHERE answer='yes') AS yes, COUNT(*) FILTER (WHERE answer='partly') AS partly,
                  COUNT(*) FILTER (WHERE answer='no') AS no FROM confirmations WHERE issue_id=%s""",
        (issue_id,),
    )
    return {**issue, "reports": reports, "events": events, "promises": promises, "links": links,
            "confirmations": confirmations}


@router.get("/media/{report_id}")
def media(report_id: uuid.UUID, user: Staff):
    r = db.fetchone("SELECT issue_id, voice_key, photo_key FROM reports WHERE id=%s", (report_id,))
    if not r or not r["issue_id"]:
        raise HTTPException(404, "Report not found")
    load_issue(r["issue_id"], user)  # enforces sealed + department rules
    if not storage.enabled():
        raise HTTPException(503, "Object storage is not configured")
    return {
        "voice_url": storage.presign_get(r["voice_key"]) if r["voice_key"] else None,
        "photo_url": storage.presign_get(r["photo_key"]) if r["photo_key"] else None,
        "expires_in": 900,
    }


class PromiseIn(BaseModel):
    text: str
    due_at: datetime


@router.post("/issues/{issue_id}/promises", status_code=201)
def make_promise(issue_id: uuid.UUID, body: PromiseIn, user: Staff, tasks: BackgroundTasks):
    issue = load_issue(issue_id, user)
    if not issue["department_id"]:
        raise HTTPException(409, "Issue is not routed to a department yet")
    if issue["status"] == "resolved":
        raise HTTPException(409, "Issue is already resolved")
    promise = db.fetchone(
        """INSERT INTO promises (issue_id, department_id, made_by, text, due_at)
           VALUES (%s,%s,%s,%s,%s) RETURNING id, text, due_at, status, escalation_level""",
        (issue_id, issue["department_id"], user["sub"], body.text.strip(), body.due_at),
    )
    if issue["status"] == "open":
        db.execute("UPDATE issues SET status='in_progress' WHERE id=%s", (issue_id,))
    summary = f"{issue['department']} promised: {promise['text']} (by {body.due_at:%d %b %H:%M})"
    trace.record(issue_id, "promise_made", issue["department"], summary, sync_meko=False)
    tasks.add_task(trace.to_meko, issue_id, "promise_made", issue["department"], summary)
    if solana_anchor.enabled():
        tasks.add_task(solana_anchor.anchor, "promise", promise["id"], promise["text"], str(body.due_at))
    return promise


@router.post("/issues/{issue_id}/fixed")
def mark_fixed(issue_id: uuid.UUID, user: Staff, tasks: BackgroundTasks):
    """Staff says the fix is done. Students are then asked to confirm."""
    issue = load_issue(issue_id, user)
    if issue["status"] not in ("open", "in_progress"):
        raise HTTPException(409, f"Issue is {issue['status']}")
    db.execute("UPDATE issues SET status='awaiting_confirm' WHERE id=%s", (issue_id,))
    summary = f"{issue['department'] or 'Staff'} says it is fixed, waiting for students to confirm"
    trace.record(issue_id, "fixed", issue["department"] or "staff", summary, sync_meko=False)
    tasks.add_task(trace.to_meko, issue_id, "fixed", issue["department"] or "staff", summary)
    return {"status": "awaiting_confirm"}


# ---------- boards ----------

@router.get("/sealed")
def sealed(user: Staff):
    """Counts only. No text, no pseudonyms."""
    return db.fetchall(
        """SELECT i.id, i.code, l.name AS location, i.release_threshold, i.created_at,
                  (SELECT COUNT(DISTINCT r.pseudonym) FROM reports r WHERE r.issue_id = i.id) AS reporters
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           WHERE i.status = 'sealed' ORDER BY i.created_at DESC"""
    )


@router.get("/promises")
def promises_board(user: Staff):
    where, params = dept_filter(user, "p.department_id")
    rows = db.fetchall(
        f"""SELECT p.id, p.text, p.due_at, p.status, p.escalation_level, p.closed_at,
                   i.id AS issue_id, i.code, i.title, i.status AS issue_status, d.name AS department,
                   p.due_at < now() AS overdue,
                   EXTRACT(EPOCH FROM (now() - p.due_at)) / 3600 AS hours_late
            FROM promises p JOIN issues i ON i.id = p.issue_id JOIN departments d ON d.id = p.department_id
            WHERE i.status <> 'sealed'{where}
            ORDER BY p.due_at""",
        params,
    )
    board = {"overdue": [], "due_soon": [], "waiting_for_students": [], "on_track": [], "kept": []}
    for r in rows:
        if r["status"] == "kept":
            board["kept"].append(r)
        elif r["status"] == "broken":
            board["overdue"].append(r)
        elif r["issue_status"] == "awaiting_confirm":
            board["waiting_for_students"].append(r)
        elif r["overdue"]:
            board["overdue"].append(r)
        elif r["hours_late"] > -48:
            board["due_soon"].append(r)
        else:
            board["on_track"].append(r)
    board["kept"] = board["kept"][-20:]
    return board


@router.get("/scorecard")
def scorecard(user: Staff):
    return db.fetchall("SELECT id, name, kept, closed, kept_pct, open_issues FROM department_scorecard ORDER BY kept_pct DESC NULLS LAST")


@router.get("/map")
def campus_map(user: Staff):
    where, params = dept_filter(user)
    return db.fetchall(
        f"""SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, i.impact_score,
                   l.name AS location, l.lat, l.lng
            FROM issues i JOIN locations l ON l.id = i.location_id
            WHERE i.status NOT IN ('sealed','resolved'){where}""",
        params,
    )


@router.get("/root-causes")
def root_causes(user: Staff):
    return db.fetchall(
        """SELECT k.reason, k.confidence, k.created_at,
                  c.id AS cause_id, c.code AS cause_code, c.title AS cause_title,
                  e.id AS effect_id, e.code AS effect_code, e.title AS effect_title, l.name AS location
           FROM issue_links k JOIN issues c ON c.id = k.cause_issue_id JOIN issues e ON e.id = k.effect_issue_id
           LEFT JOIN locations l ON l.id = e.location_id
           WHERE c.status <> 'sealed' AND e.status <> 'sealed'
           ORDER BY k.created_at DESC"""
    )


@router.get("/agents/activity")
def agent_activity(user: Staff, per_agent: int = 5):
    rows = db.fetchall(
        """SELECT * FROM (
             SELECT e.actor, e.type, e.summary, e.reasoning, e.created_at, i.code,
                    ROW_NUMBER() OVER (PARTITION BY e.actor ORDER BY e.created_at DESC) AS rn
             FROM issue_events e JOIN issues i ON i.id = e.issue_id
             WHERE i.status <> 'sealed' AND e.actor = ANY(%s)
           ) t WHERE rn <= %s ORDER BY created_at DESC""",
        (list(AGENT_NAMES), per_agent),
    )
    out = {name: [] for name in AGENT_NAMES}
    for r in rows:
        r.pop("rn")
        out[r["actor"]].append(r)
    return out


@router.post("/agents/promise-keeper/run")
def run_promise_keeper(user: Staff):
    """Run the escalation check now instead of waiting for the 5-minute loop (handy in the demo)."""
    return {"escalated": promise_keeper.run_once()}
