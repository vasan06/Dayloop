"""Integration tests for the PostgreSQL change feed on a migrated test database."""

import os
from uuid import uuid4

import psycopg
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg.rows import dict_row

from app.features.sync import routes


def test_transaction_cursor_holds_later_commits_until_earlier_transactions_finish(monkeypatch):
    database_url = os.environ.get("DAYLOOP_TEST_POSTGRES_URL")
    if not database_url:
        pytest.skip("Set DAYLOOP_TEST_POSTGRES_URL to a migrated PostgreSQL test database.")

    owner = uuid4()
    other_owner = uuid4()
    app = FastAPI()
    app.include_router(routes.router)
    app.dependency_overrides[routes.get_current_user] = lambda: {"id": owner}

    def fetch_all(query, params):
        with psycopg.connect(database_url, row_factory=dict_row) as connection:
            return connection.execute(query, params).fetchall()

    def append(connection, key, user_id=owner):
        connection.execute(
            "INSERT INTO sync_change_log(user_id, entity, record_key, action) "
            "VALUES (%s, 'tasks', %s, 'upsert')",
            (user_id, key),
        )

    monkeypatch.setattr(routes, "fetch_all", fetch_all)
    client = TestClient(app)

    try:
        with psycopg.connect(database_url) as first, psycopg.connect(database_url) as second:
            # Allocate the first transaction ID before the second transaction
            # publishes a lower event sequence and commits.
            first.execute("SELECT pg_current_xact_id()")
            append(second, "second")
            append(second, "other-account", other_owner)
            second.commit()
            pending = client.get("/sync/changes", params={"after_tx": "0"}).json()
            assert pending["items"] == []

            append(first, "first")
            first.commit()

        before = client.get("/sync/changes", params={"after_tx": "0", "limit": 1}).json()
        assert [item["record_key"] for item in before["items"]] == ["first"]
        assert before["has_more"] is True
        after = client.get("/sync/changes", params={
            "after_tx": before["next_transaction"],
            "after_sequence": before["next_sequence"],
        }).json()
        assert [item["record_key"] for item in after["items"]] == ["second"]
        assert after["has_more"] is False
        legacy = client.get("/sync/changes").json()
        assert [item["record_key"] for item in legacy["items"]] == ["second", "first"]
    finally:
        with psycopg.connect(database_url) as connection:
            connection.execute("DELETE FROM sync_change_log WHERE user_id IN (%s,%s)", (owner, other_owner))
