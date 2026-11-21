import os
from decimal import Decimal
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from psycopg.rows import dict_row

from app.core import auth, database
from app.db.migrate import apply_migrations
from app.main import app


@pytest.fixture
def client(monkeypatch):
    dsn = os.getenv("DAYLOOP_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("Set DAYLOOP_TEST_DATABASE_URL to run PostgreSQL integration tests")
    schema = sql.Identifier("dayloop_test_" + uuid4().hex)
    with psycopg.connect(dsn, row_factory=dict_row) as conn:
        # Even DDL is rolled back. A unique search path isolates concurrent test runs.
        with conn.transaction(force_rollback=True):
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(schema))
            conn.execute(sql.SQL("SET LOCAL search_path TO {}, pg_catalog").format(schema))

            @contextmanager
            def request_connection():
                with conn.transaction():
                    yield conn

            class TestPool:
                connection = staticmethod(request_connection)

            monkeypatch.setattr(database, "get_pool", TestPool)
            monkeypatch.setattr(auth, "get_settings", lambda: {"auth_mode": "development", "app_env": "development"})
            apply_migrations()
            with TestClient(app, raise_server_exceptions=False) as http:
                http.headers["X-DayLoop-Dev-User"] = "test"
                yield http


def item(response):
    assert response.is_success, response.text
    return response.json()["item"]


def test_hierarchy_rejects_cycles_and_accepts_same_parent(client):
    parent = item(client.post("/api/v1/tasks", json={"title": "Parent"}))["id"]
    child = item(client.post(f"/api/v1/tasks/{parent}/subtasks", json={"title": "Child"}))["id"]
    assert client.patch(f"/api/v1/tasks/{child}", json={"parent_task_id": parent}).status_code == 200
    assert client.patch(f"/api/v1/tasks/{parent}", json={"parent_task_id": child}).status_code == 422


def test_dependency_replacement(client):
    task = item(client.post("/api/v1/tasks", json={"title": "Launch"}))["id"]
    dep = item(client.post("/api/v1/tasks", json={"title": "Design"}))["id"]
    response = client.put(f"/api/v1/tasks/{task}/dependencies", json={"depends_on": [dep]})
    assert response.status_code == 200
    assert [row["id"] for row in response.json()["items"]] == [dep]
    assert client.put(f"/api/v1/tasks/{dep}/dependencies", json={"depends_on": [task]}).status_code == 422
    assert client.put(f"/api/v1/tasks/{task}/dependencies", json={"depends_on": []}).json()["items"] == []


def test_completed_task_round_trip(client):
    task = item(client.post("/api/v1/tasks", json={"title": "Review", "status": "completed", "start_at": "2026-11-01T10:00:00Z"}))
    assert task["start_at"]
    assert task["completed_at"]
    saved = item(client.patch(f"/api/v1/tasks/{task['id']}", json={"status": "completed"}))
    assert saved["completed_at"] == task["completed_at"]


def test_profile_name_survives_next_request(client):
    item(client.put("/api/v1/profile", json={"display_name": "Jay", "username": "jay", "age": 30, "role": "working"}))
    assert item(client.get("/api/v1/profile"))["display_name"] == "Jay"


def test_dismissed_notifications_stay_dismissed(client):
    from app.worker import process_due_notifications
    item(client.post("/api/v1/notifications/reminders", json={"title": "Break", "scheduled_at": "2020-01-01T12:00:00Z"}))
    assert process_due_notifications() == 1
    notification = client.get("/api/v1/notifications").json()["items"][0]
    item(client.patch(f"/api/v1/notifications/{notification['id']}/dismiss"))
    assert client.get("/api/v1/notifications").json()["items"] == []


def test_invalid_calendar_offset_combination(client):
    values = {"title": "Lunch", "start_at": "2026-05-05T12:00:00", "end_at": "2026-05-05T13:00:00Z"}
    assert client.post("/api/v1/calendar/events", json=values).status_code == 422
    assert client.get("/api/v1/calendar/events", params={"start": values["start_at"], "end": values["end_at"]}).status_code == 422


def test_invalid_block_replacement_preserves_note(client):
    note = item(client.post("/api/v1/notes", json={"title": "Draft"}))["id"]
    url = f"/api/v1/notes/{note}"
    blocks = [{"type": "paragraph", "content": {"text": "Draft"}}]
    assert client.put(url + "/blocks", json={"blocks": blocks}).is_success
    for payload in [{}, {"blocks": [None]}, {"blocks": [{"type": "paragraph", "content": {"text": []}}]}]:
        assert client.put(url + "/blocks", json=payload).status_code == 422
    assert client.get(url).json()["blocks"][0]["content"]["text"] == "Draft"


def test_task_notes_validate_editor_shape(client):
    task = item(client.post("/api/v1/tasks", json={"title": "Research"}))["id"]
    url = f"/api/v1/tasks/{task}/notes"
    assert client.put(url, json={"blocks": [None]}).status_code == 422


def test_relative_attachment_storage_is_stable(tmp_path, monkeypatch):
    from app.features.attachments import routes
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(routes, "get_settings", lambda: {"attachment_root": "../storage/attachments"})
    assert routes.get_storage_root() == Path(__file__).resolve().parents[2] / "storage" / "attachments"

def test_note_title_and_blocks_save_together(client):
    note = item(client.post("/api/v1/notes", json={"title": "A"}))["id"]
    url = f"/api/v1/notes/{note}"
    assert client.put(url + "/blocks", json={"blocks": [], "title": "B"}).is_success
    assert client.get(url).json()["item"]["title"] == "B"
    assert client.put(url + "/blocks", json={"blocks": [None], "title": "C"}).status_code == 422
    assert client.get(url).json()["item"]["title"] == "B"


def test_habit_schedule_and_failure_count_in_insights(client):
    from app.services.streaks import local_today
    day = str(local_today("Asia/Kolkata"))
    task = item(client.post("/api/v1/habits", json={"name": "Run"}))
    item(client.post("/api/v1/habits", json={"name": "Read"}))
    item(client.put(f"/api/v1/habits/{task['id']}/entries/{day}", json={"status": "completed"}))
    data = client.get("/api/v1/habits/insights").json()
    assert data["series"][-1]["scheduled"] == 2
    assert data["series"][-1]["completion_rate"] == 50
    assert len(data["streaks"]) == 2
    assert client.get("/api/v1/habits/streaks/overview").json()["events"]


def test_habit_rejects_invalid_schedule_and_timezone(client):
    for value in [{"timezone": "Unknown"}, {"schedule_config": {"weekdays": 1}}, {"schedule_type": "weekly"}]:
        assert client.post("/api/v1/habits", json={"name": "Read", **value}).status_code == 422


def test_habit_updates_adapt_json_and_validate_measurements(client):
    h = item(client.post("/api/v1/habits", json={"name": "Steps", "measurement_type": "quantity", "target_value": 10}))
    url = f"/api/v1/habits/{h['id']}"
    assert item(client.patch(url, json={"reminder_config": {"type": "none"}}))["reminder_config"] == {"type": "none"}
    assert client.put(url+"/entries/2026-01-01", json={"status": "completed", "value": "no"}).status_code == 422
    assert item(client.put(url+"/entries/2026-01-01", json={"status": "completed", "value": 8}))["status"] == "failed"
    assert client.delete(url).status_code == 204
    assert client.put(url+"/entries/2026-01-01", json={"status": "completed", "value": 10}).status_code == 404


def test_finance_currency_does_not_mix_amounts(client):
    for currency, amount in [("USD", "1.25"), ("INR", "20.00")]:
        item(client.post("/api/v1/finance/transactions", json={"transaction_type": "income", "currency": currency, "amount": amount, "transaction_date":"2026-11-01"}))
    assert Decimal(str(client.get("/api/v1/finance/summary?month=2026-11").json()["income"])) == 20
    assert Decimal(str(client.get("/api/v1/finance/summary?month=2026-11&currency=USD").json()["income"])) == Decimal("1.25")

@pytest.mark.parametrize(("path", "body"), [
    ("tasks", {"title": None}), ("projects", {"name": "A", "status": []}),
    ("goals", {"title": "A", "goal_type": "unknown"}),
    ("trackers", {"name": "A" * 121}), ("habits", {"name": None}),
    ("calendar/events", {"title": None, "start_at": "2026-11-01T10:00Z", "end_at": "2026-11-01T12:00Z"}),
])
def test_invalid_form_data_is_a_client_error(client, path, body):
    assert client.post("/api/v1/" + path, json=body).status_code == 422


def test_boolean_tracker_rejects_non_boolean_values(client):
    tracker = item(client.post("/api/v1/trackers", json={"name": "Meditated", "metric_type": "boolean"}))
    url = f"/api/v1/trackers/{tracker['id']}/entries"
    assert client.post(url, json={"numeric_value": 3}).status_code == 422
    assert client.post(url, json={"numeric_value": 0}).is_success


def test_goal_crud_keeps_fields_and_owner(client):
    url = "/api/v1/goals"
    goal = item(client.post(url, json={"title": "Learn", "current_value": 1, "target_value": 3, "status": "paused"}))
    assert goal["status"] == "paused" and Decimal(str(goal["current_value"])) == 1
    detail = url + "/" + goal["id"]
    other = {"X-DayLoop-Dev-User": "other"}
    assert client.patch(detail, headers=other, json={"title": "Private"}).status_code == 404
    assert client.delete(detail, headers=other).status_code == 404
    changes = {"title": "Read", "goal_type": "learning", "start_date": "2026-11-01", "status": "active"}
    saved = item(client.patch(detail, json=changes))
    assert all(saved[key] == value for key, value in changes.items())
    assert Decimal(str(item(client.post(detail + "/increment"))["current_value"])) == 2
    assert item(client.post(detail + "/increment"))["status"] == "completed"
    assert client.post(detail + "/increment").status_code == 409
    assert client.get(url).json()["items"][0]["id"] == goal["id"]
    assert client.delete(detail).status_code == 204
    assert client.get(url).json()["items"] == []


def test_tracker_crud_preserves_recorded_type_and_owner(client):
    url = "/api/v1/trackers"
    tracker = item(client.post(url, json={"name": "Water", "unit": "L"}))
    detail = url + "/" + tracker["id"]
    assert item(client.patch(detail, json={"metric_type": "duration"}))["metric_type"] == "duration"
    item(client.post(detail + "/entries", json={"numeric_value": 2}))
    assert client.patch(detail, json={"metric_type": "boolean"}).status_code == 409
    other = {"X-DayLoop-Dev-User": "other"}
    assert client.patch(detail, headers=other, json={"unit": None}).status_code == 404
    assert client.delete(detail, headers=other).status_code == 404
    changes = {"name": "Study", "frequency": "weekly", "unit": "hours", "target_value": 0}
    saved = item(client.patch(detail, json=changes))
    saved["target_value"] = Decimal(str(saved["target_value"]))
    assert all(saved[key] == value for key, value in changes.items())
    assert client.get(url).json()["items"][0]["name"] == "Study"
    assert len(client.get(detail + "/entries").json()["items"]) == 1
    assert client.delete(detail).status_code == 204
    assert client.get(url).json()["items"] == []
    assert client.post(detail + "/entries", json={"numeric_value": 1}).status_code == 404
    assert client.patch(detail, json={"name": "Again"}).status_code == 404


def test_project_dates_survive_creation(client):
    project = item(client.post("/api/v1/projects", json={"name": "Ship", "start_date": "2026-11-01", "due_date": "2026-11-20"}))
    assert project["start_date"] == "2026-11-01"
    assert project["due_date"] == "2026-11-20"


def test_invalid_identifier_errors(client):
    assert client.get("/api/v1/notes/no-such-id").status_code == 422
    assert client.delete("/api/v1/projects/no-such-id").status_code == 422

def test_task_rename_keeps_same_unique_name_rule_as_create(client):
    item(client.post("/api/v1/tasks", json={"title": "Read"}))
    other = item(client.post("/api/v1/tasks", json={"title": "Write"}))
    assert client.patch(f"/api/v1/tasks/{other['id']}", json={"title": " read "}).status_code == 409


def test_invalid_profile_data_does_not_finish_onboarding(client):
    data = {"display_name": "Jay", "username": "jay", "age": 30, "role": "working"}
    item(client.put("/api/v1/profile", json={**data, "onboarding_completed": "false"}))
    assert item(client.get("/api/v1/profile"))["onboarding_completed"] is False
    assert client.put("/api/v1/profile", json={**data, "age": 15.5}).status_code == 422


def test_reminder_requires_valid_source_identifier(client):
    response = client.post("/api/v1/notifications/reminders", json={
        "title": "Lunch", "source_type": "task", "source_id": "invalid", "scheduled_at": "2026-11-30T10:00:00Z",
    })
    assert response.status_code == 422


def test_sync_change_feed_scoped_and_paginated(client):
    initial = client.get("/api/v1/sync/cursor")
    assert initial.status_code == 200
    cursor = initial.json()["cursor"]
    created = item(client.post("/api/v1/tasks", json={"title": "Offline sync task"}))
    task_id = created["id"]

    first = client.get(f"/api/v1/sync/changes?after={cursor}&limit=1")
    assert first.status_code == 200
    first_body = first.json()
    assert len(first_body["items"]) == 1
    assert first_body["items"][0]["entity"] == "tasks"
    assert first_body["items"][0]["record_key"] == task_id

    assert client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"}).status_code == 200
    second = client.get(f"/api/v1/sync/changes?after={first_body['next_cursor']}")
    assert second.status_code == 200
    assert any(row["entity"] == "tasks" and row["record_key"] == task_id for row in second.json()["items"])

    client.headers["X-DayLoop-Dev-User"] = "second-account"
    other = client.get("/api/v1/sync/changes?after=0")
    assert other.status_code == 200
    assert not any(row["record_key"] == task_id for row in other.json()["items"])
