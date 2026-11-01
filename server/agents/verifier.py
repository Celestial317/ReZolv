"""verifier: check an agent's claims against the database before they are shown as fact.

Each decision cites evidence (see agents/trace.py). The verifier looks every item up in
YugabyteDB and recomputes the numbers the claim relies on:

  verified = true   every cited item exists and its numbers match
  verified = false  something cited is missing or the numbers do not match (contradicted)
  verified = null   nothing cited, or something could not be checked (shown as "unverified")

The checks are plain SQL, so they cost no Gemini calls. With VERIFIER_USE_LLM=true, free-text
suggested fixes are also judged by Gemini against the memory they quote.
"""
import json
import logging

import db
import gemini
from config import settings

log = logging.getLogger("rezolv.verifier")

OK, BAD, UNKNOWN = "ok", "bad", "unknown"


def _check(item: dict, issue_id) -> str:
    kind = item.get("type")
    if kind == "report":
        row = db.fetchone("SELECT issue_id FROM reports WHERE id=%s", (item["id"],))
        return OK if row else BAD
    if kind == "issue":
        return OK if db.fetchone("SELECT 1 AS x FROM issues WHERE id=%s", (item["id"],)) else BAD
    if kind == "promise":
        row = db.fetchone(
            "SELECT EXTRACT(EPOCH FROM (now() - due_at)) / 3600 AS late FROM promises WHERE id=%s", (item["id"],)
        )
        if not row:
            return BAD
        need = item.get("hours_late")
        return OK if need is None or row["late"] >= float(need) - 1 else BAD
    if kind == "merge_distance":
        row = db.fetchone(
            """SELECT r.embedding <=> i.embedding AS d, r.location_id = i.location_id AS same_loc
               FROM reports r, issues i WHERE r.id=%s AND i.id=%s AND r.embedding IS NOT NULL AND i.embedding IS NOT NULL""",
            (item["report"], item["issue"]),
        )
        if not row:
            return UNKNOWN
        close = abs(float(row["d"]) - float(item["distance"])) < 0.03
        return OK if close and row["d"] < float(item["limit"]) + 0.03 and row["same_loc"] else BAD
    if kind == "routing_stat":
        row = db.fetchone(
            """SELECT COUNT(*) FILTER (WHERE i.status='resolved') AS fixed, COUNT(*) AS total
               FROM issues i JOIN departments d ON d.id = i.department_id
               WHERE i.category=%s AND d.name=%s AND i.id <> %s""",
            (item["category"], item["department"], issue_id),
        )
        return OK if row["fixed"] == item["fixed"] and row["total"] == item["total"] else BAD
    if kind == "lag_stat":
        from agents import root_cause

        hits, trials = root_cause.lag_counts(item["location_id"], item["cause_category"], item["effect_category"])
        return OK if (hits, trials) == (item["hits"], item["trials"]) else BAD
    if kind == "reporters":
        row = db.fetchone("SELECT COUNT(DISTINCT pseudonym) AS n FROM reports WHERE issue_id=%s", (item["issue"],))
        return OK if row["n"] == item["count"] else BAD
    if kind == "correction":
        return OK if db.fetchone("SELECT 1 AS x FROM routing_corrections WHERE id=%s", (item["id"],)) else BAD
    if kind == "kb":
        import rules

        return OK if rules.exists(item["chunk_id"], item["query"]) else UNKNOWN
    if kind == "memory":
        # Only a stored Meko memory id can be confirmed. Free text from memory stays unverified.
        if not item.get("id"):
            return UNKNOWN
        import meko

        if not meko.enabled():
            return UNKNOWN
        return OK if meko.call_tool("memory_get_by_id", {"memory_id": item["id"], "conversation_id": item["conversation_id"]}) else UNKNOWN
    return UNKNOWN


def verify_event(event_id) -> bool | None:
    ev = db.fetchone("SELECT id, issue_id, type, summary, evidence FROM issue_events WHERE id=%s", (event_id,))
    if not ev or not ev["evidence"]:
        return None
    items = ev["evidence"] if isinstance(ev["evidence"], list) else json.loads(ev["evidence"])
    results = []
    for it in items:
        try:
            results.append(_check(it, ev["issue_id"]))
        except Exception:
            log.exception("could not check evidence %s", it)
            results.append(UNKNOWN)
    if BAD in results:
        verdict = False
    elif results and all(r == OK for r in results):
        verdict = True
    else:
        verdict = None
    if verdict is None and settings.verifier_use_llm and ev["type"] == "suggested_fix":
        verdict = _llm_supports(ev["summary"], items)
    db.execute("UPDATE issue_events SET verified=%s WHERE id=%s", (verdict, event_id))
    return verdict


def _llm_supports(claim: str, items: list) -> bool | None:
    quoted = " ".join(str(i.get("text", "")) for i in items if i.get("type") == "memory")
    if not quoted:
        return None
    out = gemini.generate_text(
        f"Claim: {claim}\nEvidence: {quoted}\nDoes the evidence support the claim? Answer exactly YES or NO."
    )
    if out is None:
        return None
    return True if out.strip().upper().startswith("YES") else None  # never marks a claim contradicted by itself


def label(verified: bool | None) -> str:
    return {True: "verified", False: "contradicted", None: "unverified"}[verified]
