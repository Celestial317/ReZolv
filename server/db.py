import time
from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import settings

_pool: ConnectionPool | None = None


def init(wait_seconds: int = 0) -> None:
    """Open the pool. Optionally wait for YugabyteDB to accept connections."""
    global _pool
    if _pool is not None:
        return
    pool = ConnectionPool(
        settings.database_url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row, "autocommit": True, "prepare_threshold": None},
        open=False,
    )
    deadline = time.time() + wait_seconds
    while True:
        try:
            pool.open(wait=True, timeout=5)
            break
        except Exception:
            if time.time() >= deadline:
                raise
            pool.close()
            time.sleep(3)
    _pool = pool


def close() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


def vec(values: list[float] | None) -> str | None:
    """Format an embedding for a `%s::vector` parameter."""
    if values is None:
        return None
    return "[" + ",".join(f"{v:.6f}" for v in values) + "]"


def fetchall(sql: str, params=None) -> list[dict]:
    with _pool.connection() as c:
        return c.execute(sql, params).fetchall()


def fetchone(sql: str, params=None) -> dict | None:
    with _pool.connection() as c:
        return c.execute(sql, params).fetchone()


def execute(sql: str, params=None) -> None:
    with _pool.connection() as c:
        c.execute(sql, params)


@contextmanager
def tx():
    """A single transaction on one connection."""
    with _pool.connection() as c:
        with c.transaction():
            yield c
