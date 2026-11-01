"""anonymity: does the report itself give the student away?

Hiding the account is not enough in a small class: "I'm the only girl in CSE-B" identifies the writer. Before a
sensitive report is sent the app asks this check. Pattern rules catch room and roll numbers, phone numbers and
emails with no Gemini call. One Gemini call looks for context that singles a person out (class, section,
nicknames, unique events) and proposes vaguer wording. Without Gemini, only the pattern rules run.
"""
from typing import Literal

from pydantic import BaseModel

import gemini
from agents.safe_review import IDENTIFIERS, redact

RANK = {"low": 0, "medium": 1, "high": 2}


class Span(BaseModel):
    text: str
    reason: str


class Verdict(BaseModel):
    risk: Literal["low", "medium", "high"]
    spans: list[Span]
    suggestion: str


def pattern_spans(text: str) -> list[Span]:
    return [Span(text=m.group(0), reason=f"This looks like {label}.")
            for pattern, label in IDENTIFIERS for m in pattern.finditer(text)]


def check(text: str) -> Verdict:
    spans = pattern_spans(text)
    risk = "high" if spans else "low"
    suggestion = redact(text) if spans else text

    out = gemini.generate_structured(
        "A student is about to send an anonymous sensitive complaint to a college. Find any wording that could let "
        "classmates or staff work out WHO wrote it: names, nicknames, class or section, hostel room, dates or events "
        "only the writer would know, a detail that makes them the only one of their kind. Ordinary facts about the "
        "problem are fine. Return risk (low, medium or high), the risky spans copied exactly from the text with a "
        "short reason, and a suggestion that rewrites the text with the risky parts made vaguer, keeping the meaning "
        f"and the original language.\n\nText:\n{text[:1500]}",
        Verdict,
    )
    if out is not None:
        seen = {s.text.lower() for s in spans}
        spans += [s for s in out.spans if s.text.lower() not in seen and s.text in text]
        if RANK[out.risk] >= RANK[risk]:
            risk = out.risk
            suggestion = out.suggestion or suggestion
    if spans and risk == "low":
        risk = "medium"
    return Verdict(risk=risk, spans=spans, suggestion=suggestion)
