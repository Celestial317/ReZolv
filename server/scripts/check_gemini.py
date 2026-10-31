"""Connectivity check for Gemini. Lists models your key can call and tests one embedding.

    python -m scripts.check_gemini
"""
import gemini
from config import settings


def main() -> None:
    if not gemini.enabled():
        raise SystemExit("GEMINI_API_KEY is not set")
    print("Models that support generateContent (pick one for GEMINI_MODEL):")
    for m in gemini._gc().models.list():
        if "generateContent" in (m.supported_actions or []):
            print("  ", m.name.removeprefix("models/"))
    vec = gemini.embed("no water on the second floor")
    print(f"\nEmbedding ({settings.gemini_embed_model}): {len(vec)} dims")
    print("Analysis:", gemini.analyze_text("Hostel B mein dusri manzil par paani nahi aa raha").model_dump())


if __name__ == "__main__":
    main()
