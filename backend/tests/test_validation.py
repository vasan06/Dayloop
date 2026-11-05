from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.features.finance.routes import parse_amount
from app.features.tasks.service import create_task, update_task, validate_uuid
from app.main import app


def test_health_endpoint_is_available():
    response = TestClient(app).get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_task_api_requires_identity():
    response = TestClient(app).get("/api/v1/tasks")
    assert response.status_code == 401


def test_core_feature_routes_are_registered():
    paths = TestClient(app).get("/openapi.json").json()["paths"]
    assert "/api/v1/projects" in paths
    assert "/api/v1/tasks" in paths
    assert "/api/v1/notes" in paths
    assert "/api/v1/habits" in paths
    assert "/api/v1/finance/transactions" in paths
    assert "/api/v1/goals" in paths
    assert "/api/v1/trackers" in paths
    assert "/api/v1/calendar/events" in paths
    assert "/api/v1/search" in paths
    assert "/api/v1/notifications" in paths
    assert "/api/v1/attachments" in paths


def test_task_title_is_required_before_database_access():
    with pytest.raises(HTTPException) as error:
        create_task("00000000-0000-0000-0000-000000000001", {})
    assert error.value.status_code == 422


def test_invalid_task_id_is_rejected():
    with pytest.raises(HTTPException) as error:
        update_task("00000000-0000-0000-0000-000000000001", "not-a-uuid", {"title": "Test"})
    assert error.value.status_code == 422


def test_uuid_validation_returns_canonical_value():
    value = validate_uuid("00000000-0000-0000-0000-000000000001", "task_id")
    assert value == "00000000-0000-0000-0000-000000000001"


def test_invalid_uuid_is_rejected():
    with pytest.raises(HTTPException) as error:
        validate_uuid("bad-id", "task_id")
    assert error.value.status_code == 422


def test_finance_uses_decimal_amounts():
    assert parse_amount("123.45") == Decimal("123.45")


@pytest.mark.parametrize("value", ["0", "-1", "1.234", "NaN", "Infinity"])
def test_finance_rejects_invalid_amounts(value):
    with pytest.raises(HTTPException) as error:
        parse_amount(value)
    assert error.value.status_code == 422
