"""Connectivity check for Meko. Prints every tool and its argument schema.

    python -m scripts.list_meko_tools

If the argument names differ from what server/meko.py sends, edit meko.py.
"""
import json

import meko


def main() -> None:
    if not meko.enabled():
        raise SystemExit("MEKO_API_KEY is not set")
    for t in meko.list_tools():
        schema = getattr(t, "input_schema", None) or getattr(t, "inputSchema", None) or {}
        print(f"\n== {t.name}\n{t.description}\n{json.dumps(schema.get('properties', {}), indent=2)}")
        print("required:", schema.get("required", []))


if __name__ == "__main__":
    main()
