"""Apply schema.sql and the vector indexes. Safe to run repeatedly.

    python -m scripts.migrate
"""
import logging
import re
from pathlib import Path

import db

log = logging.getLogger("rezolv.migrate")

# YugabyteDB needs ybhnsw (and NONCONCURRENTLY). Plain Postgres + pgvector uses hnsw.
VECTOR_INDEXES = [
    ("reports_embedding_idx", "reports"),
    ("issues_embedding_idx", "issues"),
]


def statements(sql: str) -> list[str]:
    sql = re.sub(r"^\s*--.*$", "", sql, flags=re.M)
    return [s.strip() for s in re.split(r";\s*\n|;\s*$", sql) if s.strip()]


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    db.init(wait_seconds=180)
    for stmt in statements(Path(__file__).resolve().parent.parent.joinpath("schema.sql").read_text()):
        db.execute(stmt)
    for name, table in VECTOR_INDEXES:
        for method, concurrently in (("ybhnsw", "NONCONCURRENTLY "), ("hnsw", "")):
            try:
                db.execute(
                    f"CREATE INDEX {concurrently}IF NOT EXISTS {name} "
                    f"ON {table} USING {method} (embedding vector_cosine_ops)"
                )
                log.info("index %s ready (%s)", name, method)
                break
            except Exception as e:
                log.warning("index %s with %s failed: %s", name, method, str(e).splitlines()[0])
        else:
            log.warning("index %s skipped; vector search will use a sequential scan", name)
    log.info("schema ready")
    db.close()


if __name__ == "__main__":
    main()
