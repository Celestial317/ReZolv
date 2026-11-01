"""memory: suggest a past fix for new issues, save a playbook when one is resolved."""
import db
import gemini
import meko
from agents import trace


def suggest(issue_id) -> None:
    issue = db.fetchone(
        """SELECT i.id, i.code, i.title, i.category, l.name AS location
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id WHERE i.id=%s""",
        (issue_id,),
    )
    found = meko.memory_search("memory", f"{issue['category']} {issue['title']} at {issue['location']}")
    if not found:
        return
    found = " ".join(found.split())
    if len(found) <= 280:  # short enough to show as is: skip the LLM call
        fix = found
    else:
        fix = gemini.generate_text(
            f"New campus issue: {issue['title']} ({issue['category']}, {issue['location']}).\n"
            f"Memory search result:\n{found}\n\n"
            "If the memory describes a fix that applies to this kind of issue, reply with one short "
            "sentence suggesting it. If nothing relevant, reply exactly NONE."
        )
    fix = (fix or found).strip()
    if not fix or fix.upper().startswith("NONE"):
        return
    fix = " ".join(fix.split())[:300]
    db.execute("UPDATE issues SET suggested_fix=%s, used_playbook=true WHERE id=%s", (fix, issue_id))
    trace.record(issue_id, "suggested_fix", "memory", f"Suggested fix from past issues: {fix}",
                 "Found by searching Meko memory for similar resolved issues.",
                 evidence=[{"type": "memory", "text": found[:300]}])


def save_playbook(issue_id) -> None:
    issue = db.fetchone(
        """SELECT i.code, i.title, i.category, l.name AS location, d.name AS department,
                  GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE(i.resolved_at, now()) - i.created_at)) / 86400)) AS days
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id
           LEFT JOIN departments d ON d.id = i.department_id WHERE i.id=%s""",
        (issue_id,),
    )
    promise = db.fetchone(
        "SELECT text FROM promises WHERE issue_id=%s AND status='kept' ORDER BY closed_at DESC LIMIT 1",
        (issue_id,),
    )
    fix = promise["text"] if promise else "fixed and confirmed by students"
    content = (f"{issue['category']} issue '{issue['title']}' at {issue['location']} "
               f"({issue['code']}) was resolved by {issue['department']} in {int(issue['days'])} day(s): {fix}.")
    meko.memory_add("memory", content)
    trace.record(issue_id, "playbook_saved", "memory", "Saved a playbook for future similar issues", content)
