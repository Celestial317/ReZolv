"""root_cause: causes are measured, not guessed.

For a new issue B at a place, look at the other kinds of issue A at the same place. A time-lag test asks:
how often does a B issue start within 48 hours after an A issue, compared with the same number of A events
placed at random times over the same period? Only patterns that clearly beat chance are kept. Gemini then
explains a passing pattern in one sentence. It never decides whether the pattern exists.

The measured numbers (hits, trials, baseline rate, p-value) are stored on issue_links and cited as evidence.
"""
import logging
import random
from datetime import datetime, timedelta, timezone

import db
import gemini
from agents import trace

log = logging.getLogger("rezolv.root_cause")

WINDOW = timedelta(hours=48)
OBS_DAYS = 90        # observation period for the test
SHUFFLES = 500
MIN_TRIALS = 3       # a pattern needs at least this many cause events
MIN_RATE = 0.60      # and must follow the cause at least this often
MIN_LIFT = 0.25      # and beat the chance rate by this much
MAX_P = 0.05


def _times(location_id, category: str) -> list[datetime]:
    rows = db.fetchall(
        """SELECT created_at FROM issues
           WHERE location_id=%s AND category=%s AND NOT is_sensitive
             AND created_at > now() - make_interval(days => %s) ORDER BY created_at""",
        (location_id, category, OBS_DAYS),
    )
    return [r["created_at"] for r in rows]


def _followed(a_times: list[datetime], b_times: list[datetime]) -> int:
    return sum(1 for a in a_times if any(a < b <= a + WINDOW for b in b_times))


def lag_counts(location_id, cause_category: str, effect_category: str) -> tuple[int, int]:
    """(hits, trials): cause events followed by an effect event within 48 h."""
    a, b = _times(location_id, cause_category), _times(location_id, effect_category)
    return _followed(a, b), len(a)


def lag_test(location_id, cause_category: str, effect_category: str) -> dict | None:
    a, b = _times(location_id, cause_category), _times(location_id, effect_category)
    trials = len(a)
    if trials < MIN_TRIALS or not b:
        return None
    hits = _followed(a, b)
    rng = random.Random(f"{location_id}|{cause_category}|{effect_category}")
    end = datetime.now(timezone.utc)
    span = OBS_DAYS * 86400
    beat, total = 0, 0
    for _ in range(SHUFFLES):
        fake = [end - timedelta(seconds=rng.random() * span) for _ in range(trials)]
        h = _followed(fake, b)
        total += h
        beat += h >= hits
    baseline = total / SHUFFLES / trials
    p = (1 + beat) / (1 + SHUFFLES)
    rate = hits / trials
    passed = rate >= MIN_RATE and rate - baseline >= MIN_LIFT and p <= MAX_P
    return {"hits": hits, "trials": trials, "rate": rate, "baseline": baseline, "p": p, "passed": passed}


def _explain(cause_cat: str, effect_cat: str, place: str, stat: dict) -> str:
    facts = (f"{stat['hits']} of {stat['trials']} {cause_cat} issues at {place} were followed by a {effect_cat} "
             f"issue within 48 hours; random timing would give about {stat['baseline']:.0%}.")
    out = gemini.generate_text(
        f"Facts measured from campus data: {facts}\n"
        f"In one plain sentence, say why a {cause_cat} problem could cause a {effect_cat} problem in a campus "
        "building. Use only these facts and common sense. Do not invent numbers or names."
    )
    return " ".join((out or "").split())[:300] or facts


def run(issue_id) -> None:
    issue = db.fetchone(
        "SELECT id, code, category, location_id, created_at FROM issues WHERE id=%s AND NOT is_sensitive", (issue_id,)
    )
    if not issue or not issue["location_id"]:
        return
    place = db.fetchone("SELECT name FROM locations WHERE id=%s", (issue["location_id"],))["name"]
    others = db.fetchall(
        """SELECT DISTINCT category FROM issues
           WHERE location_id=%s AND category <> %s AND NOT is_sensitive
             AND created_at > now() - make_interval(days => %s)""",
        (issue["location_id"], issue["category"], OBS_DAYS),
    )
    for o in others:
        cause_cat = o["category"]
        trigger = db.fetchone(
            """SELECT id, code, title FROM issues
               WHERE location_id=%s AND category=%s AND NOT is_sensitive AND created_at < %s
                 AND created_at >= %s - INTERVAL '48 hours' ORDER BY created_at DESC LIMIT 1""",
            (issue["location_id"], cause_cat, issue["created_at"], issue["created_at"]),
        )
        if not trigger:
            continue  # nothing that could be the cause just happened: skip the test and the LLM
        stat = lag_test(issue["location_id"], cause_cat, issue["category"])
        if not stat or not stat["passed"]:
            continue
        known = db.fetchone(
            """SELECT k.reason FROM issue_links k JOIN issues c ON c.id = k.cause_issue_id
               JOIN issues e ON e.id = k.effect_issue_id
               WHERE c.category=%s AND e.category=%s AND e.location_id=%s AND k.hits IS NOT NULL LIMIT 1""",
            (cause_cat, issue["category"], issue["location_id"]),
        )
        why = known["reason"] if known else _explain(cause_cat, issue["category"], place, stat)
        db.execute(
            """INSERT INTO issue_links (cause_issue_id, effect_issue_id, reason, confidence, hits, trials, baseline_rate, p_value)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (cause_issue_id, effect_issue_id) DO UPDATE
               SET reason=EXCLUDED.reason, confidence=EXCLUDED.confidence, hits=EXCLUDED.hits,
                   trials=EXCLUDED.trials, baseline_rate=EXCLUDED.baseline_rate, p_value=EXCLUDED.p_value""",
            (trigger["id"], issue["id"], why, stat["rate"], stat["hits"], stat["trials"], stat["baseline"], stat["p"]),
        )
        measured = (f"Measured: {stat['hits']} of {stat['trials']} {cause_cat} issues at {place} were followed by "
                    f"this kind of issue within 48 h, against about {stat['baseline']:.0%} by chance "
                    f"(p = {stat['p']:.3f}).")
        trace.record(
            issue["id"], "root_cause", "root_cause",
            f"Likely caused by {trigger['code']}: {trigger['title']}",
            f"{why} {measured}",
            evidence=[{"type": "lag_stat", "location_id": str(issue["location_id"]), "cause_category": cause_cat,
                       "effect_category": issue["category"], "hits": stat["hits"], "trials": stat["trials"]},
                      {"type": "issue", "id": str(trigger["id"])}],
        )
