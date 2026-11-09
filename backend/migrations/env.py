"""
Alembic migration environment for NEXORA Backend.

Uses async SQLAlchemy (psycopg driver) to run migrations.
The DB URL is read from the DATABASE_URL environment variable
(or .env file) — never from alembic.ini.
"""

from __future__ import annotations

import asyncio
import os
import sys
from logging.config import fileConfig

# Ensure the project root is on sys.path so `app` package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings

# ── Alembic Config object ─────────────────────────────────────────────────────
config = context.config

# Apply Python logging config from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import all models so metadata is fully populated ─────────────────────────
# Add each new model module here as slices land:
from app.db.base import Base  # noqa: F401  — registers the DeclarativeBase

# Future:
# from app.models.user import User  # noqa: F401
# from app.models.task import Task  # noqa: F401

target_metadata = Base.metadata

# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_url() -> str:
    settings = get_settings()
    return settings.database_url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection needed)."""
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode (requires a live DB connection)."""
    connectable = create_async_engine(
        _get_url(),
        poolclass=pool.NullPool,  # one connection per migration run
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
