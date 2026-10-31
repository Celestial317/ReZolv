"""Gemini wrapper: transcribe + classify, embed, free-form JSON/text.

With no GEMINI_API_KEY (or if a text call fails) it falls back to a keyword
heuristic and a hashed bag-of-words embedding, so the pipeline still runs
end to end during setup. Do not mix mock and real embeddings in one database.
"""
import hashlib
import json
import logging
import math
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from config import settings

log = logging.getLogger("rezolv.gemini")

EMBED_DIM = 768
CATEGORIES = ("water", "electricity", "internet", "food", "safety", "sensitive", "other")


class Analysis(BaseModel):
    lang: str
    text_original: str
    text_en: str
    title: str
    category: Literal["water", "electricity", "internet", "food", "safety", "sensitive", "other"]
    severity: int
    is_sensitive: bool


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
Never invent names. Do not include personal identifiers in the title."""

_client = None


def enabled() -> bool:
    return bool(settings.gemini_api_key)


def _gc():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# ---------- transcribe + classify ----------

def to_mp3(data: bytes, suffix: str = ".webm") -> bytes:
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d, "in" + suffix), Path(d, "out.mp3")
        src.write_bytes(data)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", str(dst)],
            check=True,
            capture_output=True,
        )
        return dst.read_bytes()


def analyze_audio(mp3: bytes) -> Analysis:
    if not enabled():
        raise RuntimeError("GEMINI_API_KEY is required to transcribe voice notes")
    from google.genai import types

    resp = _gc().models.generate_content(
        model=settings.gemini_model,
        contents=[
            _PROMPT.format(source="audio recording"),
            types.Part.from_bytes(data=mp3, mime_type="audio/mp3"),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json", response_schema=Analysis
        ),
    )
    return Analysis.model_validate_json(resp.text)


def analyze_text(text: str) -> Analysis:
    if enabled():
        try:
            from google.genai import types

            resp = _gc().models.generate_content(
                model=settings.gemini_model,
                contents=[_PROMPT.format(source="typed text"), text],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json", response_schema=Analysis
                ),
            )
            return Analysis.model_validate_json(resp.text)
        except Exception:
            log.exception("Gemini analyze_text failed, using heuristic")
    return _heuristic(text)


_KEYWORDS = {
    "sensitive": ("harass", "ragging", "assault", "abuse", "stalk", "molest"),
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

def _normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def embed(text: str) -> list[float]:
    if enabled():
        try:
            from google.genai import types

            resp = _gc().models.embed_content(
                model=settings.gemini_embed_model,
                contents=text,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBED_DIM, task_type="SEMANTIC_SIMILARITY"
                ),
            )
            return _normalize(list(resp.embeddings[0].values))
        except Exception:
            log.exception("Gemini embed failed, using mock embedding")
    return _mock_embed(text)


def _mock_embed(text: str) -> list[float]:
    v = [0.0] * EMBED_DIM
    for tok in re.findall(r"\w+", text.lower()):
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        v[h % EMBED_DIM] += 1.0
    return _normalize(v)


# ---------- free-form ----------

def generate_text(prompt: str) -> str | None:
    if not enabled():
        return None
    try:
        return _gc().models.generate_content(model=settings.gemini_model, contents=prompt).text
    except Exception:
        log.exception("Gemini generate_text failed")
        return None


def generate_json(prompt: str):
    if not enabled():
        return None
    try:
        from google.genai import types

        resp = _gc().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return json.loads(resp.text)
    except Exception:
        log.exception("Gemini generate_json failed")
        return None
