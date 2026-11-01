import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

import auth
import db
import solana_anchor
import storage
from agents import memory, promise_keeper, router as router_agent, trace, verifier
import meko
from config import settings

router = APIRouter(prefix="/admin", tags=["admin"])
Staff = Annotated[dict, Depends(auth.staff)]

AGENT_NAMES = ("intake", "clusterer", "privacy_guardian", "router", "root_cause", "memory", "promise_keeper",
               "fraud_check", "safe_review")


def dept_filter(user: dict, column: str = "i.department_id") -> tuple[str, list]:
    """Dept heads only see their own department. Everyone else sees all.

    Sensitive cases never appear in these views, for any role. The confidential officer and the committee read
    them through /safe; everyone else only gets counts (/admin/sealed).
    """
    clause = " AND NOT i.is_sensitive"
    if user["role"] == "dept_head" and user.get("department_id"):
        return f"{clause} AND {column} = %s", [user["department_id"]]
    return clause, []


def load_issue(issue_id: uuid.UUID, user: dict) -> dict:
    """Fetch an issue for staff. Sealed issues are never exposed here."""
    issue = db.fetchone(
        """SELECT i.id, i.code, i.title, i.category, i.status, i.is_sensitive, i.report_count,
                  i.impact_score, i.suggested_fix, i.department_id, i.created_at, i.resolved_at,
                  i.flagged, i.flag_reason, i.tokens_used, i.used_playbook,
                  l.name AS location, l.lat, l.lng, d.name AS department
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           LEFT JOIN departments d ON d.id = i.department_id WHERE i.id=%s""",
        (issue_id,),
    )
    if not issue or issue["status"] == "sealed" or issue["is_sensitive"]:
        raise HTTPException(404, "Issue not found")
    if user["role"] == "dept_head" and user.get("department_id") and str(issue["department_id"]) != str(user["department_id"]):
        raise HTTPException(403, "Not your department")
    return issue


# Which escalation level each role answers to. A promise starts at level 0 with the department, moves to the
# Warden at its deadline and to the Dean 24 hours later (or when a student disputes the fix after the deadline).
LEVELS = {"dept_head": 0, "warden": 1, "dean": 2}
LEVEL_TITLES = {0: "Facilities Head", 1: "Warden", 2: "Dean"}


def my_queue(user: dict) -> list[dict]:
    """Open issues whose current promise sits at this role's level."""
    level = LEVELS.get(user["role"])
    if level is None:
        return []
    return db.fetchall(
        """SELECT i.id, i.code, i.title, i.category, i.status, i.report_count, l.name AS location, d.name AS department,
                  p.id AS promise_id, p.text AS promise_text, p.due_at, p.escalation_level,
                  EXTRACT(EPOCH FROM (now() - p.due_at)) / 3600 AS hours_late
           FROM promises p JOIN issues i ON i.id = p.issue_id
           LEFT JOIN locations l ON l.id = i.location_id LEFT JOIN departments d ON d.id = i.department_id
           WHERE p.status = 'open' AND p.escalation_level = %s AND NOT i.is_sensitive
             AND i.status IN ('open','in_progress','awaiting_confirm')
           ORDER BY p.due_at""",
        (level,),
    )


@router.get("/escalations")
def escalations(user: Staff):
    """The issues waiting on this person because of their level (Warden: level 1, Dean: level 2)."""
    level = LEVELS.get(user["role"])
    return {"level": level, "title": LEVEL_TITLES.get(level), "issues": my_queue(user)}


@router.get("/departments")
def departments(user: Staff):
    return db.fetchall("SELECT id, name FROM departments WHERE name <> 'Student Welfare Committee' ORDER BY name")


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
    tiles["escalated_to_me"] = len(my_queue(user))
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
              {where.replace('i.department_id', 'e.department_id').replace('i.is_sensitive', 'e.is_sensitive')}
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
        """SELECT id, type, actor, summary, reasoning, created_at, evidence, verified
           FROM issue_events WHERE issue_id=%s ORDER BY created_at""",
        (issue_id,),
    )
    for e in events:
        e["verification"] = verifier.label(e["verified"])
    promises = db.fetchall(
        """SELECT p.id, p.text, p.due_at, p.status, p.escalation_level, p.created_at, p.closed_at,
                  d.name AS department
           FROM promises p JOIN departments d ON d.id = p.department_id
           WHERE p.issue_id=%s ORDER BY p.created_at DESC""",
        (issue_id,),
    )
    links = db.fetchall(
        """SELECT 'cause' AS role, i.id, i.code, i.title, k.reason, k.confidence, k.hits, k.trials, k.baseline_rate, k.p_value
             FROM issue_links k JOIN issues i ON i.id = k.cause_issue_id WHERE k.effect_issue_id=%s
           UNION ALL
           SELECT 'effect', i.id, i.code, i.title, k.reason, k.confidence, k.hits, k.trials, k.baseline_rate, k.p_value
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
    db.execute("DELETE FROM confirmations WHERE issue_id=%s", (issue_id,))
    summary = f"{issue['department'] or 'Staff'} says it is fixed, waiting for students to confirm"
    trace.record(issue_id, "fixed", issue["department"] or "staff", summary, sync_meko=False)
    tasks.add_task(trace.to_meko, issue_id, "fixed", issue["department"] or "staff", summary)
    return {"status": "awaiting_confirm"}


# ---------- boards ----------

@router.get("/sealed")
def sealed(user: Staff):
    """Counts only. No text, no pseudonyms, no handling choice. The officer and the committee use /safe."""
    return db.fetchall(
        """SELECT i.id, i.code, l.name AS location, i.release_threshold, i.created_at, i.urgent,
                  (SELECT COUNT(DISTINCT r.pseudonym) FROM reports r WHERE r.issue_id = i.id) AS reporters
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           WHERE i.is_sensitive AND i.status = 'sealed' ORDER BY i.created_at DESC"""
    )


@router.get("/promises")
def promises_board(user: Staff):
    where, params = dept_filter(user, "p.department_id")
    rows = db.fetchall(
        f"""SELECT p.id, p.text, p.due_at, p.status, p.escalation_level, p.closed_at,
                   i.id AS issue_id, i.code, i.title, i.category, i.status AS issue_status, d.name AS department,
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
        """SELECT k.reason, k.confidence, k.created_at, k.hits, k.trials, k.baseline_rate, k.p_value,
                  c.id AS cause_id, c.code AS cause_code, c.title AS cause_title,
                  e.id AS effect_id, e.code AS effect_code, e.title AS effect_title, l.name AS location
           FROM issue_links k JOIN issues c ON c.id = k.cause_issue_id JOIN issues e ON e.id = k.effect_issue_id
           LEFT JOIN locations l ON l.id = e.location_id
           WHERE NOT c.is_sensitive AND NOT e.is_sensitive
           ORDER BY k.created_at DESC"""
    )


@router.get("/agents/activity")
def agent_activity(user: Staff, per_agent: int = 5):
    rows = db.fetchall(
        """SELECT * FROM (
             SELECT e.actor, e.type, e.summary, e.reasoning, e.created_at, i.code,
                    ROW_NUMBER() OVER (PARTITION BY e.actor ORDER BY e.created_at DESC) AS rn
             FROM issue_events e JOIN issues i ON i.id = e.issue_id
             WHERE NOT i.is_sensitive AND e.actor = ANY(%s)
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


# ---------- reassign: the router learns from corrections ----------

class ReassignIn(BaseModel):
    department_id: uuid.UUID


@router.post("/issues/{issue_id}/reassign")
def reassign(issue_id: uuid.UUID, body: ReassignIn, user: Staff, tasks: BackgroundTasks):
    """Staff moves an issue to the right department. The router remembers, so the next similar issue is routed there."""
    issue = load_issue(issue_id, user)
    new = db.fetchone("SELECT id, name FROM departments WHERE id=%s", (body.department_id,))
    if not new:
        raise HTTPException(404, "Unknown department")
    if str(new["id"]) == str(issue["department_id"]):
        raise HTTPException(409, "Already with that department")
    row = db.fetchone("SELECT location_id FROM issues WHERE id=%s", (issue_id,))
    old = db.fetchone("SELECT name FROM departments WHERE id=%s", (issue["department_id"],))
    fix = db.fetchone(
        """INSERT INTO routing_corrections (issue_id, category, location_id, from_dept, to_dept, made_by)
           VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
        (issue_id, issue["category"], row["location_id"], issue["department_id"], new["id"], user["sub"]),
    )
    db.execute("UPDATE issues SET department_id=%s WHERE id=%s", (new["id"], issue_id))
    summary = f"Moved from {old['name'] if old else 'nobody'} to {new['name']} by staff"
    trace.record(issue_id, "reassigned", "staff", summary,
                 f"Correction saved: {issue['category']} issues at {issue['location']} belong to {new['name']}.",
                 sync_meko=False, evidence=[{"type": "correction", "id": str(fix["id"])}])
    tasks.add_task(trace.to_meko, issue_id, "reassigned", "staff", summary)
    tasks.add_task(
        meko.memory_add, "router",
        f"{issue['category']} issues at {issue['location']} like '{issue['title']}' belong to {new['name']}"
        + (f", not {old['name']}." if old else "."),
    )
    return {"department": new["name"]}


@router.get("/routing-accuracy")
def routing_accuracy(user: Staff, days: int = 30):
    """Share of routed issues per day that staff did NOT have to move. Measured from the events, nothing else."""
    return db.fetchall(
        """WITH routed AS (
             SELECT date_trunc('day', e.created_at) AS day, COUNT(DISTINCT e.issue_id) AS routed
             FROM issue_events e JOIN issues i ON i.id = e.issue_id
             WHERE e.type = 'routed' AND NOT i.is_sensitive AND e.created_at > now() - make_interval(days => %s)
             GROUP BY 1),
           moved AS (
             SELECT date_trunc('day', i.created_at) AS day, COUNT(DISTINCT c.issue_id) AS moved
             FROM routing_corrections c JOIN issues i ON i.id = c.issue_id GROUP BY 1)
           SELECT r.day::date AS day, r.routed, COALESCE(m.moved, 0) AS moved,
                  ROUND(100.0 * (r.routed - COALESCE(m.moved, 0)) / NULLIF(r.routed, 0), 1) AS accuracy_pct
           FROM routed r LEFT JOIN moved m ON m.day = r.day ORDER BY r.day""",
        (days,),
    )


# ---------- root causes: fix the cause, close them all ----------

@router.post("/causes/{cause_issue_id}/fixed")
def cause_fixed(cause_issue_id: uuid.UUID, user: Staff, tasks: BackgroundTasks):
    """One click: the root cause is fixed, so every issue linked to it moves to 'awaiting confirmation'.

    Each student who reported one of them then sees "Check the fix" (GET /issues/awaiting).
    """
    cause = load_issue(cause_issue_id, user)
    linked = db.fetchall(
        """SELECT e.id, e.code, e.status FROM issue_links k JOIN issues e ON e.id = k.effect_issue_id
           WHERE k.cause_issue_id=%s AND NOT e.is_sensitive""",
        (cause_issue_id,),
    )
    moved = []
    for i in [{"id": cause["id"], "code": cause["code"], "status": cause["status"]}] + linked:
        if i["status"] not in ("open", "in_progress"):
            continue
        db.execute("UPDATE issues SET status='awaiting_confirm' WHERE id=%s", (i["id"],))
        db.execute("DELETE FROM confirmations WHERE issue_id=%s", (i["id"],))
        summary = f"Root cause {cause['code']} was fixed: {cause['title']}"
        trace.record(i["id"], "fixed", "staff", summary,
                     "Fixing the cause fixes every issue linked to it. Waiting for students to confirm.",
                     sync_meko=False, evidence=[{"type": "issue", "id": str(cause["id"])}])
        tasks.add_task(trace.to_meko, i["id"], "fixed", "staff", summary)
        moved.append(i["code"])
    return {"cause": cause["code"], "awaiting_confirm": moved}


# ---------- forecasts ----------

class CalendarIn(BaseModel):
    location_id: uuid.UUID
    kind: str  # the category of the trigger, e.g. "electricity" for a planned power cut
    note: str | None = None
    starts_at: datetime


@router.post("/calendar", status_code=201)
def add_calendar(body: CalendarIn, user: Staff):
    return db.fetchone(
        """INSERT INTO campus_calendar (location_id, kind, note, starts_at) VALUES (%s,%s,%s,%s)
           RETURNING id, kind, note, starts_at""",
        (body.location_id, body.kind.strip().lower(), body.note, body.starts_at),
    )


@router.get("/forecasts")
def forecasts(user: Staff):
    """Upcoming planned events x measured cause patterns. The percentage is the share of past triggers that were
    followed by the effect (hits / trials), taken from issue_links. Nothing is estimated beyond that."""
    return db.fetchall(
        """WITH patterns AS (
             SELECT c.category AS cause_category, e.category AS effect_category, e.location_id,
                    MAX(k.hits) AS hits, MAX(k.trials) AS trials
             FROM issue_links k JOIN issues c ON c.id = k.cause_issue_id JOIN issues e ON e.id = k.effect_issue_id
             WHERE k.hits IS NOT NULL AND NOT e.is_sensitive GROUP BY 1, 2, 3)
           SELECT cal.id, cal.starts_at, cal.note, l.name AS location, p.cause_category AS trigger,
                  p.effect_category AS likely_issue, p.hits, p.trials,
                  ROUND(100.0 * p.hits / p.trials) AS probability_pct
           FROM campus_calendar cal JOIN locations l ON l.id = cal.location_id
           JOIN patterns p ON p.location_id = cal.location_id AND p.cause_category = cal.kind
           WHERE cal.starts_at > now() ORDER BY cal.starts_at"""
    )


# ---------- campus graph: relational + vector + time in one query ----------

@router.get("/campus-graph")
def campus_graph(user: Staff, days: int = 90):
    """Places, their issues, cause links with the measured lag, and the most similar other issues by meaning.

    One YugabyteDB query: relational joins, a time window, and pgvector similarity (LATERAL) together.
    """
    rows = db.fetchall(
        """SELECT l.id AS location_id, l.name AS location,
                  COALESCE(json_agg(json_build_object(
                    'id', i.id, 'code', i.code, 'title', i.title, 'category', i.category, 'status', i.status,
                    'reports', i.report_count,
                    'caused_by', (SELECT json_agg(json_build_object('code', c.code, 'hits', k.hits, 'trials', k.trials,
                                                                    'baseline_pct', ROUND(100 * k.baseline_rate)))
                                  FROM issue_links k JOIN issues c ON c.id = k.cause_issue_id WHERE k.effect_issue_id = i.id),
                    'similar', (SELECT json_agg(json_build_object('code', s.code, 'title', s.title, 'distance', ROUND(s.d::numeric, 3)))
                                FROM (SELECT o.code, o.title, o.embedding <=> i.embedding AS d FROM issues o
                                      WHERE o.id <> i.id AND NOT o.is_sensitive AND o.embedding IS NOT NULL
                                      ORDER BY o.embedding <=> i.embedding LIMIT 3) s)
                  ) ORDER BY i.created_at DESC) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS issues
           FROM locations l
           LEFT JOIN issues i ON i.location_id = l.id AND NOT i.is_sensitive AND i.embedding IS NOT NULL
                             AND i.created_at > now() - make_interval(days => %s)
           GROUP BY l.id, l.name ORDER BY l.name""",
        (days,),
    )
    return rows


# ---------- measured numbers ----------

@router.get("/verification-stats")
def verification_stats(user: Staff):
    """How many 'Why?' claims were checked against the data, and how they came out."""
    row = db.fetchone(
        """SELECT COUNT(*) FILTER (WHERE e.verified IS TRUE) AS verified,
                  COUNT(*) FILTER (WHERE e.verified IS FALSE) AS contradicted,
                  COUNT(*) FILTER (WHERE e.verified IS NULL) AS unverified, COUNT(*) AS total
           FROM issue_events e JOIN issues i ON i.id = e.issue_id WHERE NOT i.is_sensitive"""
    )
    return row


@router.get("/token-savings")
def token_savings(user: Staff):
    """Gemini tokens per issue: first-time issues against repeats that used a saved playbook. Measured, not estimated."""
    rows = db.fetchall(
        """SELECT used_playbook, COUNT(*) AS issues, ROUND(AVG(tokens_used)) AS avg_tokens
           FROM issues WHERE tokens_used > 0 AND NOT is_sensitive GROUP BY used_playbook"""
    )
    by = {bool(r["used_playbook"]): r for r in rows}
    first, repeat = by.get(False), by.get(True)
    out = {"first_time": first, "with_playbook": repeat, "saving_pct": None}
    if first and repeat and first["avg_tokens"]:
        out["saving_pct"] = round(100 * (1 - float(repeat["avg_tokens"]) / float(first["avg_tokens"])))
    return out


@router.get("/flagged")
def flagged(user: Staff):
    """Issues flagged by the fake-report check. A flag only asks a human to look."""
    return db.fetchall(
        """SELECT i.id, i.code, i.title, i.flag_reason, i.report_count, l.name AS location
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           WHERE i.flagged AND NOT i.is_sensitive ORDER BY i.created_at DESC"""
    )


# ---------- QR stickers ----------

def _qr_link(location_id) -> str:
    return f"{settings.public_app_url.rstrip('/')}/report?loc={location_id}"


@router.get("/qr")
def qr_list(user: Staff):
    """Every place with the link its QR sticker should open."""
    return [{**r, "link": _qr_link(r["id"])} for r in db.fetchall("SELECT id, name FROM locations ORDER BY name")]


@router.get("/qr/{location_id}.svg")
def qr_svg(location_id: uuid.UUID, user: Staff):
    import io

    import segno
    from fastapi.responses import Response

    loc = db.fetchone("SELECT id, name FROM locations WHERE id=%s", (location_id,))
    if not loc:
        raise HTTPException(404, "Unknown location")
    buf = io.BytesIO()
    segno.make(_qr_link(loc["id"]), error="m").save(buf, kind="svg", scale=8, border=2)
    return Response(buf.getvalue(), media_type="image/svg+xml")


@router.get("/eval")
def eval_results(user: Staff):
    """Accuracy measured on the labelled 20-report test set (python -m scripts.eval). Nothing else is claimed."""
    import json
    from pathlib import Path

    f = Path(__file__).resolve().parent.parent / "eval" / "results.json"
    if not f.exists():
        raise HTTPException(404, "Run python -m scripts.eval first")
    return json.loads(f.read_text(encoding="utf8"))
