"""Measure the pipeline on a labelled test set. Only numbers computed here should be shown to judges.

    python -m scripts.eval

Reads eval/testset.json (20 reports with known category and known "same problem" groups) and reports:
  * category accuracy   Gemini's category against the label
  * routing accuracy    the default router rule (category -> department) against the label's department
  * merge precision / recall   two reports are merged when same category, same location and embedding distance < CLUSTER_MAX_DISTANCE
Costs about 40 Gemini calls (cached afterwards) and takes a couple of minutes because of the rate limiter.
Results are also written to eval/results.json.
"""
import itertools
import json
import math
from pathlib import Path

import gemini
from config import settings
from seed import DEPARTMENTS

ROOT = Path(__file__).resolve().parent.parent / "eval"


def cosine_distance(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    return 1 - dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


def main() -> None:
    if not gemini.enabled():
        raise SystemExit("GEMINI_API_KEY is not set: the evaluation would measure the offline fallback, not the pipeline")
    reports = json.loads((ROOT / "testset.json").read_text(encoding="utf8"))["reports"]
    dept_for = {c: d for d, cats in DEPARTMENTS.items() for c in cats}

    rows = []
    for r in reports:
        a = gemini.analyze_text(r["text"])
        rows.append({**r, "got": a.category, "vec": gemini.embed_many([a.text_original, a.text_en])})
        print(f"{r['category']:<12} -> {a.category:<12} {r['text'][:60]}")

    cat_ok = sum(r["got"] == r["category"] for r in rows)
    route_ok = sum(dept_for.get(r["got"]) == dept_for.get(r["category"]) for r in rows)

    tp = fp = fn = tn = 0
    for a, b in itertools.combinations(rows, 2):
        truth = a["group"] == b["group"]
        merged = a["got"] == b["got"] and a["location"] == b["location"] and cosine_distance(a["vec"], b["vec"]) < settings.cluster_max_distance
        tp += truth and merged
        fp += merged and not truth
        fn += truth and not merged
        tn += not truth and not merged
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    result = {
        "reports": len(rows),
        "category_accuracy_pct": round(100 * cat_ok / len(rows), 1),
        "routing_accuracy_pct": round(100 * route_ok / len(rows), 1),
        "merge_precision_pct": round(100 * precision, 1),
        "merge_recall_pct": round(100 * recall, 1),
        "pairs": {"true_merge": tp, "wrong_merge": fp, "missed_merge": fn, "correct_split": tn},
        "model": settings.gemini_model,
        "distance_limit": settings.cluster_max_distance,
    }
    (ROOT / "results.json").write_text(json.dumps(result, indent=2), encoding="utf8")
    print("\n" + json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
