"""Every agent decision goes to `issue_events` (shown in the UI) and to the
issue's Meko conversation (the "Why?" trace). Only issue codes, categories,
locations and reasoning are sent to Meko. Never emails, names or pseudonyms."""
import db
import meko


def record(issue_id, type: str, actor: str, summary: str, reasoning: str | None = None,
           sync_meko: bool = True, created_at=None) -> None:
    db.execute(
        """INSERT INTO issue_events (issue_id, type, actor, summary, reasoning, created_at)
           VALUES (%s,%s,%s,%s,%s, COALESCE(%s, now()))""",
        (issue_id, type, actor, summary, reasoning, created_at),
    )
    if sync_meko:
        to_meko(issue_id, type, actor, summary, reasoning)


def to_meko(issue_id, type: str, actor: str, summary: str, reasoning: str | None = None) -> None:
    if not meko.enabled():
        return
    issue = db.fetchone("SELECT code, meko_conversation_id FROM issues WHERE id=%s", (issue_id,))
    if not issue:
        return
    conv = issue["meko_conversation_id"]
    if not conv:
        conv = meko.create_conversation(issue["code"])
        if not conv:
            return
        db.execute("UPDATE issues SET meko_conversation_id=%s WHERE id=%s", (conv, issue_id))
    meko.add_message(conv, actor, summary, reasoning, {"issue": issue["code"], "event_type": type})
