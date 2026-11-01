"""promise_keeper: escalate overdue promises (level 1 = warden/HOD, level 2 = dean).

Each escalation quotes the passage of the college rules that applies (Meko knowledge base, rules.py) and cites
the promise and the rule as evidence, so the verifier can check both.
"""
import logging

import db
import rules
from agents import trace

log = logging.getLogger("rezolv.promise_keeper")
LEVEL_NAMES = {1: "the Warden / Dept Head", 2: "the Dean"}


def run_once() -> int:
    rows = db.fetchall(
        """SELECT p.id, p.issue_id, p.escalation_level,
                  EXTRACT(EPOCH FROM (now() - p.due_at)) / 3600 AS hours_late, i.code, i.category
           FROM promises p JOIN issues i ON i.id = p.issue_id
           WHERE p.status = 'open' AND p.escalation_level < 2
             AND i.status IN ('open', 'in_progress') AND NOT i.is_sensitive
             AND p.due_at < now() - (p.escalation_level * INTERVAL '24 hours')"""
    )
    for r in rows:
        level = r["escalation_level"] + 1
        db.execute("UPDATE promises SET escalation_level=%s WHERE id=%s", (level, r["id"]))
        evidence = [{"type": "promise", "id": str(r["id"]), "hours_late": int(r["hours_late"])}]
        why = f"{r['hours_late']:.0f} h overdue. Policy: level 1 at the deadline, level 2 after 24 more hours."
        for rule in (rules.for_category(r["category"]), rules.escalation_rule()):
            if rule:
                why += f" College rule: {rule['text']}"
                evidence.append({"type": "kb", "chunk_id": rule["chunk_id"], "query": rule["query"]})
        trace.record(
            r["issue_id"], "escalated", "promise_keeper",
            f"Deadline missed, escalated to {LEVEL_NAMES[level]}", why, evidence=evidence,
        )
    return len(rows)


def escalate_after_dispute(issue_id) -> dict | None:
    """A student says "still not fixed" after the promise deadline: reopen the issue and move it up one level.

    Returns {"level": n, "to": name} or None when there is no overdue promise (the majority rule applies then).
    """
    p = db.fetchone(
        """SELECT p.id, p.escalation_level, i.category, EXTRACT(EPOCH FROM (now() - p.due_at)) / 3600 AS hours_late
           FROM promises p JOIN issues i ON i.id = p.issue_id
           WHERE p.issue_id = %s AND p.status = 'open' AND p.due_at < now() ORDER BY p.created_at DESC LIMIT 1""",
        (issue_id,),
    )
    if not p:
        return None
    level = min(2, p["escalation_level"] + 1)
    db.execute("UPDATE promises SET escalation_level=%s WHERE id=%s", (level, p["id"]))
    db.execute("UPDATE issues SET status='in_progress' WHERE id=%s", (issue_id,))
    evidence = [{"type": "promise", "id": str(p["id"]), "hours_late": int(p["hours_late"])}]
    why = (f"The promise was {p['hours_late']:.0f} h past its deadline when a reporter said the fix did not work, "
           "so the issue is open again and has moved up one level.")
    for rule in (rules.for_category(p["category"]), rules.escalation_rule()):
        if rule:
            why += f" College rule: {rule['text']}"
            evidence.append({"type": "kb", "chunk_id": rule["chunk_id"], "query": rule["query"]})
    moved = level > p["escalation_level"]
    trace.record(
        issue_id, "escalated", "students",
        (f"Still not fixed after the deadline, escalated to {LEVEL_NAMES[level]}" if moved
         else f"Still not fixed after the deadline, still with {LEVEL_NAMES[level]}"),
        why, evidence=evidence,
    )
    return {"level": level, "to": LEVEL_NAMES[level]}
