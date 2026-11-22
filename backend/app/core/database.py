import os
from contextlib import contextmanager
from functools import lru_cache

from psycopg.conninfo import conninfo_to_dict
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_pool() -> ConnectionPool:
    settings = get_settings()
    database_url = settings["database_url"]
    if not database_url:
        raise RuntimeError("DATABASE_URL is required before using persistent features.")
    if settings["app_env"] == "production":
        connection_options = conninfo_to_dict(database_url)
        if connection_options.get("sslmode") not in {"require", "verify-ca", "verify-full"}:
            raise RuntimeError("Production DATABASE_URL must require PostgreSQL TLS (sslmode=require or stronger).")
    return ConnectionPool(
        conninfo=database_url,
        min_size=0,
        max_size=max(1, min(20, int(os.getenv("DAYLOOP_DB_POOL_MAX", "5")))),
        kwargs={"row_factory": dict_row},
        timeout=10,
        open=True,
    )


@contextmanager
def get_connection():
    with get_pool().connection() as connection:
        yield connection


def fetch_one(query: str, parameters: tuple = ()) -> dict | None:
    with get_connection() as connection:
        return connection.execute(query, parameters).fetchone()


def fetch_all(query: str, parameters: tuple = ()) -> list[dict]:
    with get_connection() as connection:
        return connection.execute(query, parameters).fetchall()


def execute(query: str, parameters: tuple = ()) -> None:
    with get_connection() as connection:
        connection.execute(query, parameters)
