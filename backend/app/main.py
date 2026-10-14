"""
NEXORA Backend — FastAPI application factory.

Startup sequence:
1. Settings are validated (raises at import if misconfigured)
2. Database engine is initialized
3. Alembic migrations checked (readiness endpoint) 
4. API routers mounted

All endpoints live under /api/v1.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import api_router
from app.core.config import get_settings

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.DEBUG if not get_settings().is_production else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Lifespan ──────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    settings = get_settings()
    logger.info(
        "NEXORA backend starting (env=%s, db=%s)",
        settings.app_env,
        # Log only the host part to avoid leaking credentials
        settings.database_url.split("@")[-1] if "@" in settings.database_url else "???",
    )
    yield
    logger.info("NEXORA backend shutting down")


# ── Application ───────────────────────────────────────────────────────────────

settings = get_settings()

app = FastAPI(
    title="NEXORA API",
    version="1.0.0",
    description="NEXORA personal productivity backend — /api/v1",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handlers ─────────────────────────────────────────────────


@app.exception_handler(Exception)
async def _unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Catch-all — prevents stack traces leaking to clients in production."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "ok": False,
            "code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred.",
            "details": [],
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(api_router, prefix=settings.api_v1_prefix)
