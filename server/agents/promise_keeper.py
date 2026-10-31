"""promise_keeper: escalate overdue promises (level 1 = warden/HOD, level 2 = dean)."""
import logging

import db
from agents import trace

log = logging.getLogger("rezolv.promise_keeper")
LEVEL_NAMES = {1: "the Warden / Dept Head", 2: "the Dean"}


def run_once() -> int:
    rows = db.fetchall(
        """SELECT p.id, p.issue_id, p.escalation_level,
                  EXTRACT(EPOCH FROM (now() - p.due_at)) / 3600 AS hours_late, i.code
           FROM promises p JOIN issues i ON i.id = p.issue_id
           WHERE p.status = 'open' AND p.escalation_level < 2
             AND p.due_at < now() - (p.escalation_level * INTERVAL '24 hours')"""
    )
    for r in rows:
        level = r["escalation_level"] + 1
        db.execute("UPDATE promises SET escalation_level=%s WHERE id=%s", (level, r["id"]))
        trace.record(
            r["issue_id"], "escalated", "promise_keeper",
            f"Deadline missed, escalated to {LEVEL_NAMES[level]}",
            f"{r['hours_late']:.0f} h overdue. Policy: level 1 at the deadline, level 2 after 24 more hours.",
        )
    return len(rows)
