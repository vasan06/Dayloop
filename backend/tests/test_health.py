"""
NEXORA Backend — health endpoint unit tests.

These tests run without a real database (liveness) or with a mock DB session
(readiness) so they work in CI without a PostgreSQL instance.
"""

from __future__ import annotations

import os

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/nexora_test")
os.environ.setdefault("TEST_DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/nexora_test")
os.environ.setdefault("ACCESS_TOKEN_SECRET", "test_secret_32_chars_minimum_aaaa")
os.environ.setdefault("REFRESH_TOKEN_SECRET", "test_secret_32_chars_minimum_bbbb")

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


def test_liveness(client: TestClient) -> None:
    """GET /api/v1/health/live must return 200 with ok=True."""
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["message"] == "alive"
