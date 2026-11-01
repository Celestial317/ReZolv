"""privacy_guardian: Safe Voice. Sealed means protected, not ignored.

Handling chosen by the student (issues.handling):
  now    the confidential officer gets it immediately (default)
  wait   protected until enough students report the same pattern, or until the officer's review deadline
  named  a formal complaint: goes to the committee with the student's name, never merged, never on staff dashboards

Urgent reports (threat, assault, self-harm) always go to the officer at once, whatever was chosen.
When distinct reporters reach the release threshold the case goes to the full committee as a group concern.
Names and pseudonyms never appear in an event: staff only ever see counts.
"""
import db
from agents import router, trace


def officer_id():
    row = db.fetchone("SELECT id FROM users WHERE role='officer' ORDER BY created_at LIMIT 1")
    return row["id"] if row else None


def reporters(issue_id) -> int:
    return db.fetchone("SELECT COUNT(DISTINCT pseudonym) AS n FROM reports WHERE issue_id=%s", (issue_id,))["n"]


def handle(issue_id, report_id, urgent: bool) -> None:
    issue = db.fetchone(
        "SELECT id, code, status, handling, urgent, officer_id, release_threshold FROM issues WHERE id=%s AND is_sensitive",
        (issue_id,),
    )
    if not issue:
        return
    n = reporters(issue_id)
    cite = [{"type": "report", "id": str(report_id)}, {"type": "reporters", "issue": str(issue_id), "count": n}]
    officer = issue["officer_id"] or officer_id()

    if urgent and not issue["urgent"]:
        db.execute("UPDATE issues SET urgent=true, handling='now' WHERE id=%s", (issue_id,))
        issue["handling"] = "now"
        trace.record(issue_id, "urgent", "privacy_guardian",
                     "Urgent: sent to the confidential officer at once",
                     "Danger to a person was detected. Urgency can only be raised, never lowered.",
                     sync_meko=False, evidence=cite[:1])
    if issue["handling"] in ("now", "named") and officer and not issue["officer_id"]:
        db.execute("UPDATE issues SET officer_id=%s WHERE id=%s", (officer, issue_id))

    if issue["handling"] == "named":
        if issue["status"] == "sealed":
            db.execute("UPDATE issues SET status='open' WHERE id=%s", (issue_id,))
        trace.record(issue_id, "released", "privacy_guardian",
                     "Formal complaint sent to the committee",
                     "The student chose to share their name with the committee only.",
                     sync_meko=False, evidence=cite[:1])
        router.run(issue_id)
        return

    if issue["handling"] == "now" and not urgent:
        trace.record(issue_id, "officer_assigned", "privacy_guardian",
                     "Sent to the confidential officer",
                     "The student chose to talk to someone now.", sync_meko=False, evidence=cite[:1])
    elif issue["handling"] == "wait":
        trace.record(issue_id, "sealed", "privacy_guardian",
                     f"Protected while waiting for similar reports: {n} of {issue['release_threshold']} students",
                     "Staff see only a count. The officer reviews it by the review deadline even if nobody else reports.",
                     sync_meko=False, evidence=cite)

    if n >= 2:
        trace.record(issue_id, "pattern", "privacy_guardian",
                     f"This is now {n} separate students",
                     "Similar reports from different students strengthen the case.",
                     sync_meko=False, evidence=cite[1:])

    if issue["status"] == "sealed" and n >= issue["release_threshold"]:
        db.execute("UPDATE issues SET status='open' WHERE id=%s", (issue_id,))
        trace.record(issue_id, "released", "privacy_guardian",
                     f"Released to the committee as a group concern: {n} students",
                     f"{n} distinct reporters reached the threshold of {issue['release_threshold']}. "
                     "Only the count is shown, never names or pseudonyms.",
                     sync_meko=False, evidence=cite[1:])
        router.run(issue_id)
