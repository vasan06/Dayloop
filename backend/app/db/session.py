"""
NEXORA Backend — Async SQLAlchemy engine and session factory.

Use `get_db` as a FastAPI dependency to obtain an AsyncSession.
The engine is created lazily on first use and reused across requests.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

_settings = get_settings()

# Create the async engine once at module import time (lazy-init safe because
# get_settings() is cached and always returns the same object).
engine = create_async_engine(
    _settings.database_url,
    echo=not _settings.is_production,  # log SQL in dev/test; silent in prod
    pool_size=_settings.db_pool_size,
    max_overflow=_settings.db_max_overflow,
    pool_timeout=_settings.db_pool_timeout,
    pool_pre_ping=True,  # detect stale connections
)

# Session factory — creates AsyncSession objects bound to the engine.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # avoid lazy-load errors after commit
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — yields an AsyncSession for a single request.

    The session is committed by the endpoint (or service layer) on success;
    rolled back automatically on exception; always closed on exit.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
