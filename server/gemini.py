"""Gemini wrapper: transcribe + classify, embed, free-form JSON/text.

Rate-limit protection (the key is shared by the whole team):
  * separate spacing for text/audio calls (GEMINI_RPM) and embeddings (GEMINI_EMBED_RPM)
  * retry with backoff on 429/5xx, then a circuit breaker pauses that kind of call for a minute
  * a daily call budget (GEMINI_DAILY_BUDGET) after which we use the offline fallbacks
  * results are cached: the same report text is never analysed or embedded twice
    (embeddings also persist in .cache/embeddings.json, so re-seeding costs nothing)

With no GEMINI_API_KEY, or when calls are blocked, it falls back to a keyword heuristic and a
hashed bag-of-words embedding so the pipeline still runs. Do not mix mock and real embeddings
in one database: re-seed after the key is set.
"""
import hashlib
import json
import logging
import math
import re
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from config import settings

log = logging.getLogger("rezolv.gemini")

EMBED_DIM = 768
CATEGORIES = ("water", "electricity", "internet", "food", "safety", "sensitive", "other")
CACHE_FILE = Path(__file__).resolve().parent / ".cache" / "embeddings.json"


class Analysis(BaseModel):
    lang: str
    text_original: str
    text_en: str
    title: str
    category: Literal["water", "electricity", "internet", "food", "safety", "sensitive", "other"]
    severity: int
    is_sensitive: bool
    urgent: bool = False


_PROMPT = """You are the intake agent of a campus grievance system in India.
Analyse the student's report ({source}). Return JSON with:
- lang: ISO code of the language spoken/written (hi, en, ta, ...)
- text_original: the report in its original language (the transcript if audio)
- text_en: faithful English translation
- title: neutral English title, max 8 words, no names
- category: one of water, electricity, internet, food, safety, sensitive, other
  ("sensitive" = harassment, ragging, abuse, discrimination, mental-health crisis)
- severity: 1 (minor) to 5 (urgent / health risk)
- is_sensitive: true if the student's identity must be protected
- urgent: true ONLY if there is an immediate danger to a person (threat, assault, self-harm, weapon, fire). Never true for ordinary faults
Never invent names. Do not include personal identifiers in title."""

_client = None
_tracking = threading.local()


def begin_tracking() -> None:
    """Start counting Gemini tokens for the current thread (one report's pipeline)."""
    _tracking.tokens = 0


def end_tracking() -> int:
    n = getattr(_tracking, "tokens", 0) or 0
    _tracking.tokens = None
    return n


def _count(resp) -> None:
    if getattr(_tracking, "tokens", None) is None:
        return
    usage = getattr(resp, "usage_metadata", None)
    _tracking.tokens += int(getattr(usage, "total_token_count", 0) or 0)


def enabled() -> bool:
    return bool(settings.gemini_api_key)


def _gc():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ---------- rate limiting ----------

class _Gate:
    """Spaces calls apart, backs off on 429, and pauses for a while after repeated failures."""

    def __init__(self, name: str, rpm: int):
        self.name = name
        self.gap = 60.0 / max(1, rpm)
        self.lock = threading.Lock()
        self.next_at = 0.0
        self.blocked_until = 0.0
        self.calls = 0
        self.failures = 0

    def wait_turn(self) -> None:
        with self.lock:
            now = time.monotonic()
            at = max(now, self.next_at)
            self.next_at = at + self.gap
        if at > now:
            time.sleep(at - now)

    def blocked_for(self) -> float:
        return max(0.0, self.blocked_until - time.monotonic())


_gates = {
    "text": _Gate("text", settings.gemini_rpm),
    "embed": _Gate("embed", settings.gemini_embed_rpm),
}
_day = {"date": "", "used": 0}
_day_lock = threading.Lock()


def _budget_left() -> bool:
    today = time.strftime("%Y-%m-%d")
    with _day_lock:
        if _day["date"] != today:
            _day.update(date=today, used=0)
        return _day["used"] < settings.gemini_daily_budget


def _spend() -> None:
    with _day_lock:
        _day["used"] += 1


def stats() -> dict:
    return {
        "model": settings.gemini_model,
        "calls_today": _day["used"],
        "daily_budget": settings.gemini_daily_budget,
        "text_paused_s": round(_gates["text"].blocked_for()),
        "embed_paused_s": round(_gates["embed"].blocked_for()),
    }


def _is_rate_limit(e: Exception) -> bool:
    s = str(e)
    return "429" in s or "RESOURCE_EXHAUSTED" in s or "503" in s or "UNAVAILABLE" in s


def _call(kind: str, fn, *, patient: bool = False):
    """Run one Gemini request under the limiter. Returns None when the call is skipped or fails.

    patient=True (voice notes, which have no offline fallback) waits out a pause instead of skipping.
    """
    gate = _gates[kind]
    if not enabled() or not _budget_left():
        return None
    if gate.blocked_for() > 0:
        if not patient or gate.blocked_for() > 120:
            return None
        time.sleep(gate.blocked_for())
    for attempt in range(3):
        gate.wait_turn()
        gate.calls += 1
        _spend()
        try:
            out = fn()
            gate.failures = 0
            return out
        except Exception as e:
            if not _is_rate_limit(e):
                log.warning("Gemini %s call failed: %s", kind, str(e)[:200])
                return None
            gate.failures += 1
            delay = 4 * (2 ** attempt)
            log.warning("Gemini %s rate-limited (attempt %d), backing off %ds", kind, attempt + 1, delay)
            time.sleep(delay)
    gate.blocked_until = time.monotonic() + 60
    log.error("Gemini %s paused for 60s after repeated rate limits", kind)
    return None


# ---------- transcribe + classify ----------

def _ffmpeg() -> str:
    """The system ffmpeg if there is one, otherwise the static binary shipped by imageio-ffmpeg."""
    import shutil

    found = shutil.which("ffmpeg")
    if found:
        return found
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def to_mp3(data: bytes, suffix: str = ".webm") -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d, "in" + suffix), Path(d, "out.mp3")
        src.write_bytes(data)
        subprocess.run(
            [_ffmpeg(), "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", str(dst)],
            check=True,
            capture_output=True,
        )
        return dst.read_bytes()


def _generate_analysis(contents):
    from google.genai import types

    def go():
        resp = _gc().models.generate_content(
            model=settings.gemini_model,
            contents=contents,
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Analysis),
        )
        _count(resp)
        return Analysis.model_validate_json(resp.text)

    return go


_analysis_cache: dict[str, Analysis] = {}


def analyze_audio(mp3: bytes) -> Analysis:
    if not enabled():
        raise RuntimeError("GEMINI_API_KEY is required to transcribe voice notes")
    from google.genai import types

    key = hashlib.sha1(mp3).hexdigest()
    if key in _analysis_cache:
        return _analysis_cache[key]
    out = _call(
        "text",
        _generate_analysis([_PROMPT.format(source="audio recording"), types.Part.from_bytes(data=mp3, mime_type="audio/mp3")]),
        patient=True,
    )
    if out is None:
        raise RuntimeError("Gemini unavailable (rate limited or over budget); try the report again later")
    _analysis_cache[key] = out
    return out


def analyze_text(text: str) -> Analysis:
    key = hashlib.sha1(text.strip().lower().encode()).hexdigest()
    if key in _analysis_cache:
        return _analysis_cache[key]
    out = _call("text", _generate_analysis([_PROMPT.format(source="typed text"), text]))
    if out is None:
        return _heuristic(text)
    _analysis_cache[key] = out
    return out


_KEYWORDS = {
    "sensitive": ("harass", "ragging", "assault", "abuse", "stalk", "molest", "touch"),
    "water": ("water", "paani", "pani", "tap", "pump", "leak"),
    "electricity": ("power", "electric", "light", "bijli", "fan", "outage"),
    "internet": ("wifi", "wi-fi", "internet", "network", "router"),
    "food": ("food", "mess", "canteen", "khana", "hygiene", "meal"),
    "safety": ("unsafe", "theft", "fight", "fire", "dark", "cctv"),
}


def _heuristic(text: str) -> Analysis:
    low = text.lower()
    category = next((c for c, kws in _KEYWORDS.items() if any(k in low for k in kws)), "other")
    return Analysis(
        lang="en",
        text_original=text,
        text_en=text,
        title=" ".join(text.split()[:8]) or "Campus issue",
        category=category,
        severity=3,
        is_sensitive=category == "sensitive",
    )


# ---------- embeddings ----------

_embed_cache: dict[str, list[float]] | None = None
_embed_lock = threading.Lock()


def _load_cache() -> dict[str, list[float]]:
    global _embed_cache
    if _embed_cache is None:
        try:
            _embed_cache = json.loads(CACHE_FILE.read_text())
        except Exception:
            _embed_cache = {}
    return _embed_cache


def _save_cache() -> None:
    try:
        CACHE_FILE.parent.mkdir(exist_ok=True)
        CACHE_FILE.write_text(json.dumps(_embed_cache))
    except Exception:
        log.warning("could not write the embedding cache")


def _normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def embed(text: str) -> list[float]:
    key = hashlib.sha1(f"{settings.gemini_embed_model}|{text.strip().lower()}".encode()).hexdigest()
    with _embed_lock:
        hit = _load_cache().get(key)
    if hit:
        return hit

    def go():
        from google.genai import types

        resp = _gc().models.embed_content(
            model=settings.gemini_embed_model,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM, task_type="SEMANTIC_SIMILARITY"),
        )
        return _normalize(list(resp.embeddings[0].values))

    vec = _call("embed", go)
    if vec is None:
        return _mock_embed(text)  # not cached: it must not pollute the real-embedding cache
    with _embed_lock:
        _load_cache()[key] = vec
        _save_cache()
    return vec


def embed_many(texts: list[str]) -> list[float]:
    """Average the embeddings of several phrasings of one text (original + English translation).

    Distinct, uncached phrasings go out in a single request, so Hinglish costs one call, not two.
    """
    texts = list(dict.fromkeys(t.strip() for t in texts if t and t.strip()))
    if len(texts) <= 1:
        return embed(texts[0] if texts else "")
    keys = [hashlib.sha1(f"{settings.gemini_embed_model}|{t.lower()}".encode()).hexdigest() for t in texts]
    with _embed_lock:
        cache = _load_cache()
        missing = [(t, k) for t, k in zip(texts, keys) if k not in cache]
    if missing:
        def go():
            from google.genai import types

            resp = _gc().models.embed_content(
                model=settings.gemini_embed_model,
                contents=[t for t, _ in missing],
                config=types.EmbedContentConfig(output_dimensionality=EMBED_DIM, task_type="SEMANTIC_SIMILARITY"),
            )
            return [_normalize(list(e.values)) for e in resp.embeddings]

        vecs = _call("embed", go)
        if vecs is None:
            return _mock_embed(" ".join(texts))
        with _embed_lock:
            for (_, k), v in zip(missing, vecs):
                _load_cache()[k] = v
            _save_cache()
    with _embed_lock:
        vs = [_load_cache()[k] for k in keys]
    return _normalize([sum(x) for x in zip(*vs)])


def _mock_embed(text: str) -> list[float]:
    v = [0.0] * EMBED_DIM
    for tok in re.findall(r"\w+", text.lower()):
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        v[h % EMBED_DIM] += 1.0
    return _normalize(v)


# ---------- free-form ----------

def generate_text(prompt: str) -> str | None:
    def go():
        resp = _gc().models.generate_content(model=settings.gemini_model, contents=prompt)
        _count(resp)
        return resp.text

    return _call("text", go)


def generate_json(prompt: str):
    from google.genai import types

    def go():
        resp = _gc().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        _count(resp)
        return json.loads(resp.text)

    return _call("text", go)


_structured_cache: dict[str, object] = {}


def generate_structured(prompt: str, schema):
    """One structured-output call, cached by prompt. Returns a `schema` instance or None."""
    key = hashlib.sha1((schema.__name__ + prompt).encode()).hexdigest()
    if key in _structured_cache:
        return _structured_cache[key]
    from google.genai import types

    def go():
        resp = _gc().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=schema),
        )
        _count(resp)
        return schema.model_validate_json(resp.text)

    out = _call("text", go)
    if out is not None:
        _structured_cache[key] = out
    return out
