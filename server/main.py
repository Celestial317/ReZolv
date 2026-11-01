import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from agents import promise_keeper, safe_review
from config import settings
from routes import admin, auth_routes, safe, student

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rezolv")


async def escalation_loop():
    while True:
        try:
            n = await asyncio.to_thread(promise_keeper.run_once)
            if n:
                log.info("promise_keeper escalated %d promise(s)", n)
            m = await asyncio.to_thread(safe_review.run_once)
            if m:
                log.info("safe_review sent %d waiting report(s) to the officer", m)
        except Exception:
            log.exception("escalation loop failed")
        await asyncio.sleep(settings.promise_loop_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init(wait_seconds=60)
    task = asyncio.create_task(escalation_loop())
    yield
    task.cancel()
    db.close()


app = FastAPI(title="ReZolv API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_routes.router)
app.include_router(student.router)
app.include_router(admin.router)
app.include_router(safe.router)


@app.get("/health")
def health():
    """Which integrations are configured. Does not call them."""
    import gemini
    import meko
    import solana_anchor
    import storage

    db.fetchone("SELECT 1")
    return {
        "db": True,
        "gemini": gemini.enabled(),
        "gemini_usage": gemini.stats() if gemini.enabled() else None,
        "meko": meko.enabled(),
        "storage": storage.enabled(),
        "solana": solana_anchor.enabled(),
    }
