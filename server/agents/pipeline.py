"""Background pipeline for one new report: intake -> cluster -> (privacy | route, memory, root cause)."""
import logging

import db
from agents import clusterer, intake, memory, privacy, root_cause, router, trace

log = logging.getLogger("rezolv.pipeline")


def process_report(report_id) -> None:
    try:
        _process(report_id)
    except Exception:
        log.exception("pipeline failed for report %s", report_id)


def _process(report_id) -> None:
    report = db.fetchone(
        """SELECT id, voice_key, text_original, is_sensitive, location_id
           FROM reports WHERE id=%s""",
        (report_id,),
    )
    analysis, embedding = intake.run(report)
    started = db.fetchone("SELECT clock_timestamp() AS t")["t"]
    issue, created = clusterer.run(report, analysis, embedding)
    if created:
        # Staff can see this event, so a sealed report's words are never included.
        heard = None if analysis.is_sensitive else f"Heard ({analysis.lang}): {analysis.text_en[:200]}"
        trace.record(
            issue["id"], "classified", "intake",
            f"Classified as {analysis.category}, severity {analysis.severity}/5", heard,
            created_at=started,
        )

    if analysis.is_sensitive:
        privacy.check(issue["id"])
        return
    if created:
        router.run(issue["id"])
        memory.suggest(issue["id"])
        root_cause.run(issue["id"])
