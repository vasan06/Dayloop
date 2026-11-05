from contextlib import contextmanager
from functools import lru_cache

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_pool() -> ConnectionPool:
    settings = get_settings()
    database_url = settings["database_url"]
    if not database_url:
        raise RuntimeError("DATABASE_URL is required before using persistent features.")
    return ConnectionPool(
        conninfo=database_url,
        min_size=1,
        max_size=8,
        kwargs={"row_factory": dict_row},
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
