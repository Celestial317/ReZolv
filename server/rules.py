"""College rules from the Meko knowledge base (the three SSCBS PDFs: code of conduct, hostel bulletin,
knowledge base). Escalations quote the passage that applies to the kind of issue.

A passage is only quoted when Meko ranks it as clearly relevant (RELEVANCE), so an unrelated paragraph is never
shown as "the rule". The chunk id is cited as evidence and the verifier searches again to confirm it exists.
"""
import logging
import re

import meko
from config import settings

log = logging.getLogger("rezolv.rules")

RELEVANCE = 0.5  # minimum Meko rerank score for a passage to be quoted

QUERIES = {
    "water": "plumbing water civil maintenance housekeeping problems hostel grievance Matron Manager unresolved Hostel Committee",
    "electricity": "electrical civil maintenance housekeeping problems hostel grievance Matron Manager unresolved Hostel Committee",
    "food": "food quality complaint hostel mess Matron Manager service provider",
    "internet": "IT network Wi-Fi problem who to contact System and Network Administrator",
    "safety": "safety security complaint who to contact grievance redressal",
    "other": "grievance process who to contact unresolved complaint",
}
ESCALATION_QUERY = "if still unresolved refer grievance to committee decision is final"

_cache: dict[str, dict | None] = {}


def _snippet(text: str, prefer: tuple[str, ...], limit: int = 300) -> str:
    """The most useful paragraph of a chunk, trimmed to a sentence boundary."""
    paras = [re.sub(r"\s+", " ", p).strip(" .•e") for p in re.split(r"\n\s*\n", text) if p.strip()]
    paras = [p for p in paras if len(p) > 25] or [re.sub(r"\s+", " ", text)]
    best = re.sub(r"^\d+\.\s*", "", max(paras, key=lambda p: sum(w in p.lower() for w in prefer)))
    if len(best) > limit:
        cut = best[:limit]
        best = cut[: cut.rfind(". ") + 1] if ". " in cut else cut.rstrip() + "..."
    return best if best.endswith((".", "...")) else best + "."


def search(query: str) -> list[dict]:
    cid = meko._memory_conversation()
    if not cid or not settings.meko_datapack_id:
        return []
    out = meko.call_tool("knowledgebase_search", {"query": query, "conversation_id": cid, "limit": 3})
    try:
        import json

        return json.loads(out).get("results", []) if out else []
    except ValueError:
        return []


def quote_for(query: str, key: str, prefer: tuple[str, ...] = ("report", "contact", "writing")) -> dict | None:
    """Best relevant passage for a query: {chunk_id, text, query}. None when nothing clearly applies."""
    if key in _cache:
        return _cache[key]
    hit = next((r for r in search(query) if (r.get("rerank_score") or 0) >= RELEVANCE), None)
    found = {"chunk_id": hit["id"], "text": _snippet(hit["chunk_text"], prefer), "query": query} if hit else None
    if found or meko.enabled():  # do not cache a miss caused by Meko being unreachable
        _cache[key] = found
    return found


PREFER = {"food": ("food", "quality"), "water": ("civil", "maintenance"), "electricity": ("electrical",),
          "internet": ("network", "wi-fi"), "safety": ("contact", "writing")}


def for_category(category: str) -> dict | None:
    return quote_for(QUERIES.get(category, QUERIES["other"]), f"cat:{category}",
                     PREFER.get(category, ("report", "contact", "writing")))


def escalation_rule() -> dict | None:
    return quote_for(ESCALATION_QUERY, "escalation", ("unresolved", "committee", "final"))


def exists(chunk_id: str, query: str) -> bool:
    """Used by the verifier: does the knowledge base still return this passage for the query?"""
    return any(r.get("id") == chunk_id for r in search(query))
