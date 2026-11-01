"""intake: voice/text -> {lang, text_original, text_en, category, severity, is_sensitive, urgent}.

Hinglish: the stored embedding is the average of the original text and its English translation, so a
code-mixed line ("paani nahi aa raha 2nd floor pe") lands next to the same complaint written in English.
Both phrasings go out in one embedding request.

Urgency can only be raised here, never lowered: a danger keyword or Gemini's flag sets it, nothing clears it.
"""
import logging
import re

import db
import gemini
import storage

log = logging.getLogger("rezolv.intake")

# Words that mean immediate danger to a person. Catches what the model might miss in Hinglish.
_DANGER = re.compile(
    r"\b(kill|suicide|self[- ]?harm|hurt myself|end my life|rape|raped|assault(ed)?|molest\w*|weapon|knife|gun|"
    r"threat\w*|blackmail\w*|marna|maar dunga|jaan se|bachao)\b",
    re.I,
)


def run(report: dict) -> tuple[gemini.Analysis, list[float]]:
    if report["voice_key"]:
        suffix = "." + report["voice_key"].rsplit(".", 1)[-1]
        mp3 = gemini.to_mp3(storage.download(report["voice_key"]), suffix)
        analysis = gemini.analyze_audio(mp3)
    else:
        analysis = gemini.analyze_text(report["text_original"] or "")

    sensitive = report["is_sensitive"] or analysis.is_sensitive
    text = f"{analysis.text_original} {analysis.text_en}"
    urgent = bool(analysis.urgent or _DANGER.search(text))
    if urgent:
        sensitive = True  # danger to a person is always handled as sensitive
    category = "sensitive" if sensitive else analysis.category
    severity = 5 if urgent else min(5, max(1, analysis.severity))
    embedding = gemini.embed_many([analysis.text_original, analysis.text_en or analysis.text_original])

    db.execute(
        """UPDATE reports SET text_original=%s, lang=%s, text_en=%s, category=%s, severity=%s,
                              is_sensitive=%s, embedding=%s::vector WHERE id=%s""",
        (analysis.text_original, analysis.lang, analysis.text_en, category, severity,
         sensitive, db.vec(embedding), report["id"]),
    )
    analysis.category = category
    analysis.severity = severity
    analysis.is_sensitive = sensitive
    analysis.urgent = urgent
    return analysis, embedding
