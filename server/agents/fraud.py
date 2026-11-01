"""fraud: flag a burst of near-identical reports from brand-new accounts.

Anonymity must not become a way to flood the system. When FRAUD_BURST_MIN or more reports from accounts
created in the last 24 hours, all within the last hour and nearly identical in meaning, arrive, the issue is
flagged for review. A flag never hides or deletes anything: it only asks a human to look.
"""
import db
from agents import trace
from config import settings


def check(report_id, issue_id, embedding: list[float]) -> bool:
    row = db.fetchone(
        """SELECT COUNT(DISTINCT r.pseudonym) AS accounts
           FROM reports r
           JOIN student_profiles sp ON sp.pseudonym = r.pseudonym
           JOIN users u ON u.id = sp.user_id
           WHERE r.created_at > now() - INTERVAL '1 hour' AND u.created_at > now() - INTERVAL '24 hours'
             AND r.kind = 'report' AND r.embedding IS NOT NULL AND r.embedding <=> %s::vector < 0.10""",
        (db.vec(embedding),),
    )
    if row["accounts"] < settings.fraud_burst_min:
        return False
    if db.fetchone("SELECT flagged FROM issues WHERE id=%s", (issue_id,))["flagged"]:
        return True
    reason = (f"{row['accounts']} near-identical reports from accounts created in the last 24 hours, "
              "all within the last hour.")
    db.execute("UPDATE issues SET flagged=true, flag_reason=%s WHERE id=%s", (reason, issue_id))
    trace.record(issue_id, "flagged", "fraud_check", "Flagged for review: possible coordinated reports", reason,
                 sync_meko=False, evidence=[{"type": "report", "id": str(report_id)}])
    return True
