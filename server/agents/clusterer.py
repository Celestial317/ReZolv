"""clusterer: join an existing issue or create a new one (YugabyteDB vector search).

Sensitive reports only join other sensitive issues. A report that shares the student's name with the
committee ("named") is a formal complaint: it never merges, it becomes its own issue.
"""
import db
from agents import trace
from config import settings

HANDLING_RANK = {"named": 0, "now": 1, "wait": 2}  # lower = more visible to a human sooner


def refresh_counts(issue_id) -> None:
    db.execute(
        """UPDATE issues i SET report_count = s.n, impact_score = LEAST(100, s.n * 3 + COALESCE(s.sev, 3) * 8)
           FROM (SELECT COUNT(*) AS n, MAX(severity) AS sev FROM reports WHERE issue_id = %s) s
           WHERE i.id = %s""",
        (issue_id, issue_id),
    )


def run(report: dict, analysis, embedding: list[float]) -> tuple[dict, bool]:
    """Returns (issue, created). `issue` has id, code, title, category, location_id, is_sensitive, status."""
    vec = db.vec(embedding)
    sensitive = analysis.is_sensitive
    handling = (report.get("handling") or "now") if sensitive else None
    if analysis.urgent:
        handling = "now"  # urgent never waits, whatever the student chose

    match, candidates = None, []
    if handling != "named":
        # ybhnsw applies WHERE after the index scan, so fetch a few extra rows and filter here.
        candidates = db.fetchall(
            """SELECT id, code, title, category, location_id, is_sensitive, status, handling,
                      embedding <=> %s::vector AS distance
               FROM issues
               WHERE status <> 'resolved' AND category = %s AND is_sensitive = %s AND embedding IS NOT NULL
                 AND handling IS DISTINCT FROM 'named'
               ORDER BY embedding <=> %s::vector LIMIT 10""",
            (vec, analysis.category, sensitive, vec),
        )
        match = next(
            (c for c in candidates
             if c["distance"] < settings.cluster_max_distance and c["location_id"] == report["location_id"]),
            None,
        )
    if match:
        db.execute("UPDATE reports SET issue_id=%s WHERE id=%s", (match["id"], report["id"]))
        if sensitive and handling and HANDLING_RANK[handling] < HANDLING_RANK.get(match["handling"] or "wait", 2):
            db.execute("UPDATE issues SET handling=%s WHERE id=%s", (handling, match["id"]))
        refresh_counts(match["id"])
        trace.record(
            match["id"], "merged", "clusterer",
            f"New report merged into {match['code']}",
            f"Same category and location, embedding distance {match['distance']:.2f} "
            f"(limit {settings.cluster_max_distance:.2f}).",
            evidence=[
                {"type": "report", "id": str(report["id"])},
                {"type": "merge_distance", "report": str(report["id"]), "issue": str(match["id"]),
                 "distance": round(float(match["distance"]), 4), "limit": settings.cluster_max_distance},
            ],
        )
        return match, False

    loc = db.fetchone("SELECT name FROM locations WHERE id=%s", (report["location_id"],))
    loc_name = loc["name"] if loc else "campus"
    # Sensitive issues never carry the report's own words in the title.
    title = f"Sensitive concern at {loc_name}" if sensitive else analysis.title
    best = candidates[0]["distance"] if candidates else None
    status = "sealed" if sensitive and handling != "named" else "open"
    issue = db.fetchone(
        """INSERT INTO issues (code, title, category, location_id, status, is_sensitive, embedding, handling, urgent)
           VALUES ('RZV-' || nextval('issue_code_seq'), %s, %s, %s, %s, %s, %s::vector, %s, %s)
           RETURNING id, code, title, category, location_id, is_sensitive, status, handling""",
        (title, analysis.category, report["location_id"], status, sensitive, vec, handling, bool(analysis.urgent)),
    )
    db.execute("UPDATE reports SET issue_id=%s WHERE id=%s", (issue["id"], report["id"]))
    refresh_counts(issue["id"])
    why = ("No open issue with the same category and location within the distance limit"
           + (f" (closest was {best:.2f})." if best is not None else " (none exist yet).")
           if handling != "named" else "A named complaint is never merged with other reports.")
    trace.record(issue["id"], "created", "clusterer", f"Created {issue['code']}: {title}", why,
                 evidence=[{"type": "report", "id": str(report["id"])}])
    return issue, True
