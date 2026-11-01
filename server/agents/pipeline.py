"""Background pipeline for one new report:
intake -> fraud check -> cluster -> (Safe Voice handling | route, memory, root cause).

Gemini tokens are counted per issue so the dashboard can compare a first-time issue with a repeat.
"""
import logging

import db
import gemini
import meko
from agents import clusterer, fraud, intake, memory, privacy, root_cause, router, trace

log = logging.getLogger("rezolv.pipeline")


def process_report(report_id) -> None:
    gemini.begin_tracking()
    issue_id = None
    try:
        issue_id = _process(report_id)
    except Exception:
        log.exception("pipeline failed for report %s", report_id)
    finally:
        tokens = gemini.end_tracking()
        if issue_id and tokens:
            db.execute("UPDATE issues SET tokens_used = tokens_used + %s WHERE id=%s", (tokens, issue_id))
            _log_tokens(issue_id, tokens)


def _log_tokens(issue_id, tokens: int) -> None:
    issue = db.fetchone("SELECT code, meko_conversation_id, is_sensitive FROM issues WHERE id=%s", (issue_id,))
    if issue and issue["meko_conversation_id"] and not issue["is_sensitive"]:
        meko.call_tool("track_token_usage", {
            "conversation_id": issue["meko_conversation_id"], "name": f"{issue['code']} pipeline",
            "input_tokens": tokens, "output_tokens": 0, "total_tokens": tokens,
        })


def _process(report_id):
    report = db.fetchone(
        """SELECT id, voice_key, text_original, is_sensitive, location_id, handling
           FROM reports WHERE id=%s""",
        (report_id,),
    )
    analysis, embedding = intake.run(report)
    started = db.fetchone("SELECT clock_timestamp() AS t")["t"]
    issue, created = clusterer.run(report, analysis, embedding)
    if created:
        # Staff can see this event, so a sensitive report's words are never included.
        heard = None if analysis.is_sensitive else f"Heard ({analysis.lang}): {analysis.text_en[:200]}"
        trace.record(
            issue["id"], "classified", "intake",
            f"Classified as {analysis.category}, severity {analysis.severity}/5", heard,
            created_at=started, evidence=[{"type": "report", "id": str(report_id)}],
        )
    fraud.check(report_id, issue["id"], embedding)

    if analysis.is_sensitive:
        privacy.handle(issue["id"], report_id, bool(analysis.urgent))
        return issue["id"]
    if created:
        router.run(issue["id"])
        memory.suggest(issue["id"])
        root_cause.run(issue["id"])
    return issue["id"]
