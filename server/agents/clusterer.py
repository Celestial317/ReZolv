"""clusterer: join an existing issue or create a new one (YugabyteDB vector search)."""
import db
from agents import trace
from config import settings


def refresh_counts(issue_id) -> None:
    db.execute(
        """UPDATE issues i SET report_count = s.n, impact_score = LEAST(100, s.n * 3 + COALESCE(s.sev, 3) * 8)
           FROM (SELECT COUNT(*) AS n, MAX(severity) AS sev FROM reports WHERE issue_id = %s) s
           WHERE i.id = %s""",
        (issue_id, issue_id),
    )


def run(report: dict, analysis, embedding: list[float]) -> tuple[dict, bool]:
    """Returns (issue, created). `issue` has id, code, title, category, location_id, is_sensitive."""
    vec = db.vec(embedding)
    # ybhnsw applies WHERE after the index scan, so fetch a few extra rows and filter here.
    candidates = db.fetchall(
        """SELECT id, code, title, category, location_id, is_sensitive, status,
                  embedding <=> %s::vector AS distance
           FROM issues
           WHERE status <> 'resolved' AND category = %s AND is_sensitive = %s AND embedding IS NOT NULL
           ORDER BY embedding <=> %s::vector LIMIT 10""",
        (vec, analysis.category, analysis.is_sensitive, vec),
    )
    match = next(
        (c for c in candidates
         if c["distance"] < settings.cluster_max_distance and c["location_id"] == report["location_id"]),
        None,
    )
    if match:
        db.execute("UPDATE reports SET issue_id=%s WHERE id=%s", (match["id"], report["id"]))
        refresh_counts(match["id"])
        trace.record(
            match["id"], "merged", "clusterer",
            f"New report merged into {match['code']}",
            f"Same category and location, embedding distance {match['distance']:.2f} "
            f"(limit {settings.cluster_max_distance:.2f}).",
        )
        return match, False

    loc = db.fetchone("SELECT name FROM locations WHERE id=%s", (report["location_id"],))
    loc_name = loc["name"] if loc else "campus"
    sensitive = analysis.is_sensitive
    # Sealed issues never carry the report's own words in the title.
    title = f"Sensitive concern at {loc_name}" if sensitive else analysis.title
    best = candidates[0]["distance"] if candidates else None
    issue = db.fetchone(
        """INSERT INTO issues (code, title, category, location_id, status, is_sensitive, embedding)
           VALUES ('RZV-' || nextval('issue_code_seq'), %s, %s, %s, %s, %s, %s::vector)
           RETURNING id, code, title, category, location_id, is_sensitive, status""",
        (title, analysis.category, report["location_id"],
         "sealed" if sensitive else "open", sensitive, vec),
    )
    db.execute("UPDATE reports SET issue_id=%s WHERE id=%s", (issue["id"], report["id"]))
    refresh_counts(issue["id"])
    why = ("No open issue with the same category and location within the distance limit"
           + (f" (closest was {best:.2f})." if best is not None else " (none exist yet)."))
    trace.record(issue["id"], "created", "clusterer", f"Created {issue['code']}: {title}", why)
    return issue, True
