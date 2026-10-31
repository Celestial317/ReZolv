"""root_cause: look at recent issues in the same building and link cause -> effect."""
import db
import gemini
from agents import trace

MIN_CONFIDENCE = 0.6


def run(issue_id) -> None:
    issue = db.fetchone("SELECT id, code, location_id FROM issues WHERE id=%s", (issue_id,))
    recent = db.fetchall(
        """SELECT id, code, title, category, status, created_at FROM issues
           WHERE location_id=%s AND NOT is_sensitive AND created_at > now() - INTERVAL '30 days'
           ORDER BY created_at""",
        (issue["location_id"],),
    )
    # Cheap SQL gate first: an LLM call is only worth it if some other kind of issue happened
    # in the same building shortly before this one.
    me = next((r for r in recent if r["id"] == issue["id"]), None)
    if not me or not any(
        r["category"] != me["category"] and 0 < (me["created_at"] - r["created_at"]).total_seconds() <= 72 * 3600
        for r in recent
    ):
        return
    lines = "\n".join(
        f"- {r['code']} | {r['created_at']:%Y-%m-%d %H:%M} | {r['category']} | {r['status']} | {r['title']}"
        for r in recent
    )
    data = gemini.generate_json(
        f"""Campus issues in one building over the last 30 days:
{lines}

Find causal links where one issue plausibly causes another (for example, a power cut stopping a
water pump). The cause must have happened before the effect. Only consider links that involve
{issue['code']}. Return a JSON list of
{{"cause_code": str, "effect_code": str, "reason": str, "confidence": number 0..1}}.
Return [] if there is no convincing link."""
    )
    by_code = {r["code"]: r for r in recent}
    for link in data or []:
        cause, effect = by_code.get(link.get("cause_code")), by_code.get(link.get("effect_code"))
        conf = float(link.get("confidence", 0))
        if not cause or not effect or cause["id"] == effect["id"] or conf < MIN_CONFIDENCE:
            continue
        if issue["code"] not in (cause["code"], effect["code"]):
            continue
        db.execute(
            """INSERT INTO issue_links (cause_issue_id, effect_issue_id, reason, confidence)
               VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING""",
            (cause["id"], effect["id"], link.get("reason", ""), conf),
        )
        trace.record(
            effect["id"], "root_cause", "root_cause",
            f"Likely caused by {cause['code']}: {cause['title']}",
            f"{link.get('reason', '')} (confidence {conf:.0%})",
        )
