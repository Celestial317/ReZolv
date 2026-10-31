"""privacy_guardian: unseal a sensitive issue once enough distinct students agree."""
import db
from agents import router, trace


def check(issue_id) -> bool:
    """Returns True if the issue was released just now."""
    issue = db.fetchone(
        "SELECT id, code, status, release_threshold FROM issues WHERE id=%s AND is_sensitive", (issue_id,)
    )
    if not issue or issue["status"] != "sealed":
        return False
    n = db.fetchone("SELECT COUNT(DISTINCT pseudonym) AS n FROM reports WHERE issue_id=%s", (issue_id,))["n"]
    if n < issue["release_threshold"]:
        trace.record(
            issue_id, "sealed", "privacy_guardian",
            f"Still sealed: {n} of {issue['release_threshold']} students",
            "Identity protection: staff see only a count until the threshold is reached.",
        )
        return False
    db.execute("UPDATE issues SET status='open' WHERE id=%s", (issue_id,))
    trace.record(
        issue_id, "released", "privacy_guardian",
        f"Released to the committee at {n} students",
        f"{n} distinct reporters reached the threshold of {issue['release_threshold']}. "
        "No names or pseudonyms are shown to staff on the sealed count.",
    )
    router.run(issue_id)
    return True
