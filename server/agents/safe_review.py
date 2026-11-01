"""safe_review: every Safe Voice report reaches a human within SAFE_REVIEW_DAYS.

A report that chose to wait, and never reached the release threshold, goes to the confidential officer after
the deadline as a summary with identifying details removed. Runs inside the 5-minute loop.
"""
import logging
import re

import db
import gemini
from agents import privacy, trace
from config import settings

log = logging.getLogger("rezolv.safe_review")

# Patterns that can identify a student. The same list backs the anonymity check in agents/anonymity.py.
IDENTIFIERS = [
    (re.compile(r"\b(room|rm|flat)\s*(no\.?|number|#)?\s*\d+[a-z]?\b", re.I), "a room number"),
    (re.compile(r"\b\d{2}[a-z]{2,5}\d{2,4}\b|\broll\s*(no\.?|number)?\s*[:#]?\s*\w*\d+\w*\b", re.I), "a roll number"),
    (re.compile(r"(?<!\d)(\+?91[- ]?)?[6-9]\d{9}(?!\d)"), "a phone number"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "an email address"),
    (re.compile(r"\bonly\s+(girl|boy|woman|man|student|one|female|male)\b(\s+(in|of|from|at)\s+[\w-]+)?", re.I),
     "a detail that singles you out"),
]


def redact(text: str) -> str:
    for pattern, _ in IDENTIFIERS:
        text = pattern.sub("[removed]", text)
    return text


def summarise(texts: list[str]) -> str:
    joined = "\n".join(f"- {redact(t)}" for t in texts if t)[:2000]
    out = gemini.generate_text(
        "Summarise these anonymous student complaints in 2 neutral sentences for a counsellor. "
        "Remove or generalise anything that could identify a person (names, rooms, classes, dates, nicknames). "
        f"Do not add facts.\n{joined}"
    )
    return (out or joined).strip()[:600]


def run_once() -> int:
    due = db.fetchall(
        """SELECT id, code FROM issues
           WHERE is_sensitive AND status = 'sealed' AND handling = 'wait' AND reviewed_at IS NULL
             AND created_at < now() - make_interval(days => %s)""",
        (settings.safe_review_days,),
    )
    for i in due:
        texts = [r["text_en"] or r["text_original"] for r in db.fetchall(
            "SELECT text_en, text_original FROM reports WHERE issue_id=%s", (i["id"],))]
        n = privacy.reporters(i["id"])
        db.execute(
            "UPDATE issues SET reviewed_at=now(), officer_id=COALESCE(officer_id, %s), safe_summary=%s WHERE id=%s",
            (privacy.officer_id(), summarise(texts), i["id"]),
        )
        trace.record(i["id"], "reviewed", "safe_review",
                     f"Sent to the officer after {settings.safe_review_days} days, with identifying details removed",
                     f"{n} student(s) waited and the threshold was not reached. Every report gets a human within a week.",
                     sync_meko=False, evidence=[{"type": "reporters", "issue": str(i["id"]), "count": n}])
    return len(due)
