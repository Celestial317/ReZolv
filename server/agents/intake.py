"""intake: voice/text -> {lang, text_original, text_en, category, severity, is_sensitive}."""
import logging

import db
import gemini
import storage

log = logging.getLogger("rezolv.intake")


def run(report: dict) -> tuple[gemini.Analysis, list[float]]:
    if report["voice_key"]:
        suffix = "." + report["voice_key"].rsplit(".", 1)[-1]
        mp3 = gemini.to_mp3(storage.download(report["voice_key"]), suffix)
        analysis = gemini.analyze_audio(mp3)
    else:
        analysis = gemini.analyze_text(report["text_original"] or "")

    sensitive = report["is_sensitive"] or analysis.is_sensitive
    category = "sensitive" if sensitive else analysis.category
    severity = min(5, max(1, analysis.severity))
    embedding = gemini.embed(analysis.text_en or analysis.text_original)

    db.execute(
        """UPDATE reports SET text_original=%s, lang=%s, text_en=%s, category=%s, severity=%s,
                              is_sensitive=%s, embedding=%s::vector WHERE id=%s""",
        (analysis.text_original, analysis.lang, analysis.text_en, category, severity,
         sensitive, db.vec(embedding), report["id"]),
    )
    analysis.category = category
    analysis.severity = severity
    analysis.is_sensitive = sensitive
    return analysis, embedding
