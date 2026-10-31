"""router: category -> department, with Meko memory overrides."""
import db
import meko
from agents import trace


def run(issue_id) -> None:
    issue = db.fetchone(
        """SELECT i.id, i.code, i.category, l.name AS location
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id WHERE i.id=%s""",
        (issue_id,),
    )
    depts = db.fetchall("SELECT id, name, categories FROM departments")
    default = next((d for d in depts if issue["category"] in d["categories"]), None) \
        or next((d for d in depts if "other" in d["categories"]), None)
    chosen, reason = default, f"Default routing for category '{issue['category']}'."

    hint = meko.memory_search(
        "router", f"Which department resolves {issue['category']} issues at {issue['location']}?"
    )
    if hint:
        low = hint.lower()
        mentioned = sorted(
            ((low.find(d["name"].lower()), d) for d in depts if d["name"].lower() in low),
            key=lambda x: x[0],
        )
        if mentioned:
            chosen = mentioned[0][1]
            if default and chosen["id"] != default["id"]:
                reason = (f"Meko memory overrides the default ({default['name']}): "
                          f"{' '.join(hint.split())[:240]}")
            else:
                reason = f"Default routing confirmed by Meko memory: {' '.join(hint.split())[:240]}"

    if not chosen:
        trace.record(issue_id, "routed", "router", "No department matched", reason)
        return
    db.execute("UPDATE issues SET department_id=%s WHERE id=%s", (chosen["id"], issue_id))
    trace.record(issue_id, "routed", "router", f"Routed to {chosen['name']}", reason)
