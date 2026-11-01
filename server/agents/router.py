"""router: category -> department, learning from staff corrections.

Order of precedence:
  1. A correction staff made before for the same kind of issue (routing_corrections, also saved to Meko)
  2. A department named by Meko memory for this category and place
  3. The department's default categories
The reasoning quotes numbers recomputed from the database ("9 of 11 past water issues were fixed by Estates"),
and cites them as evidence so the verifier can check them.
"""
import db
import meko
from agents import trace


def dept_stats(category: str, dept_id, exclude_issue) -> tuple[int, int]:
    row = db.fetchone(
        """SELECT COUNT(*) FILTER (WHERE status='resolved') AS fixed, COUNT(*) AS total
           FROM issues WHERE category=%s AND department_id=%s AND id <> %s""",
        (category, dept_id, exclude_issue),
    )
    return row["fixed"], row["total"]


def run(issue_id) -> None:
    issue = db.fetchone(
        """SELECT i.id, i.code, i.category, i.location_id, l.name AS location
           FROM issues i LEFT JOIN locations l ON l.id = i.location_id WHERE i.id=%s""",
        (issue_id,),
    )
    depts = db.fetchall("SELECT id, name, categories FROM departments")
    default = next((d for d in depts if issue["category"] in d["categories"]), None) \
        or next((d for d in depts if "other" in d["categories"]), None)
    chosen, reason, evidence = default, f"Default routing for category '{issue['category']}'.", []

    fix = db.fetchone(
        """SELECT id, to_dept FROM routing_corrections
           WHERE category=%s AND location_id IS NOT DISTINCT FROM %s ORDER BY created_at DESC LIMIT 1""",
        (issue["category"], issue["location_id"]),
    )
    if fix:
        chosen = next((d for d in depts if d["id"] == fix["to_dept"]), default)
        reason = (f"Learned from a staff correction: earlier {issue['category']} issues at "
                  f"{issue['location'] or 'this place'} were moved to {chosen['name']}.")
        evidence.append({"type": "correction", "id": str(fix["id"])})
    else:
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
                said = " ".join(hint.split())[:240]
                if default and chosen["id"] != default["id"]:
                    reason = f"Meko memory overrides the default ({default['name']}): {said}"
                else:
                    reason = f"Default routing confirmed by Meko memory: {said}"
                evidence.append({"type": "memory", "text": said})

    if not chosen:
        trace.record(issue_id, "routed", "router", "No department matched", reason)
        return
    fixed, total = dept_stats(issue["category"], chosen["id"], issue["id"])
    if total:
        reason += f" Track record: {fixed} of {total} past {issue['category']} issues sent to {chosen['name']} were fixed."
        evidence.append({"type": "routing_stat", "department": chosen["name"], "category": issue["category"],
                         "fixed": fixed, "total": total})
    db.execute("UPDATE issues SET department_id=%s WHERE id=%s", (chosen["id"], issue_id))
    trace.record(issue_id, "routed", "router", f"Routed to {chosen['name']}", reason, evidence=evidence or None)
