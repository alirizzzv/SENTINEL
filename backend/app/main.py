"""SENTINEL enterprise backend (optional).

Receives anonymized, metadata-only scan events from extensions in an org and
serves team-level analytics + custom pattern management. Never sees prompt
content. SQLite by default; point DATABASE_URL at Postgres for production.

Run:  uvicorn app.main:app --reload   (from the backend/ directory)
Docs: http://localhost:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import analytics, patterns, sync


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SENTINEL Enterprise API",
    version="0.1.0",
    description="Anonymized, metadata-only AI-usage analytics for organizations.",
    lifespan=lifespan,
)

# Extensions post from chrome-extension:// origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync.router)
app.include_router(analytics.router)
app.include_router(patterns.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok", "service": "sentinel-backend"}
