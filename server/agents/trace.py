"""Every agent decision goes to `issue_events` (shown in the UI) and to the
issue's Meko conversation (the "Why?" trace). Only issue codes, categories,
locations and reasoning are sent to Meko. Never emails, names or pseudonyms.

A decision may carry `evidence`: a list of records it relies on, e.g.
  {"type": "report", "id": ...}, {"type": "routing_stat", "department": ..., "category": ..., "fixed": 9, "total": 11}
The verifier (agents/verifier.py) checks each claim against YugabyteDB right after the event is saved.
An event with no evidence stays unverified and is shown as such, never as fact.
"""
import json

import db
import meko


def record(issue_id, type: str, actor: str, summary: str, reasoning: str | None = None,
           sync_meko: bool = True, created_at=None, evidence: list | None = None) -> str:
    row = db.fetchone(
        """INSERT INTO issue_events (issue_id, type, actor, summary, reasoning, created_at, evidence)
           VALUES (%s,%s,%s,%s,%s, COALESCE(%s, now()), %s::jsonb) RETURNING id""",
        (issue_id, type, actor, summary, reasoning, created_at, json.dumps(evidence) if evidence else None),
    )
    if evidence:
        from agents import verifier  # late import: the verifier reads the same tables

        verifier.verify_event(row["id"])
    if sync_meko:
        to_meko(issue_id, type, actor, summary, reasoning)
    return row["id"]


def to_meko(issue_id, type: str, actor: str, summary: str, reasoning: str | None = None) -> None:
    if not meko.enabled():
        return
    issue = db.fetchone("SELECT code, meko_conversation_id, is_sensitive FROM issues WHERE id=%s", (issue_id,))
    if not issue or issue["is_sensitive"]:  # sensitive cases never leave our own database
        return
    conv = issue["meko_conversation_id"]
    if not conv:
        conv = meko.create_conversation(issue["code"])
        if not conv:
            return
        db.execute("UPDATE issues SET meko_conversation_id=%s WHERE id=%s", (conv, issue_id))
    meko.add_message(conv, actor, summary, reasoning, {"issue": issue["code"], "event_type": type})
