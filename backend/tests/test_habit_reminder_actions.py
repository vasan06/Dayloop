from datetime import UTC, date, datetime
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.features.habits import routes
from app.features.habits.reminders import next_habit_reminder, upcoming_habit_alerts


def test_daily_reminder_uses_habit_timezone():
    now = datetime(2026, 11, 22, 2, 0, tzinfo=UTC)
    scheduled = next_habit_reminder({"type": "daily", "time": "09:00"}, "Asia/Kolkata", now)
    assert scheduled is not None
    assert scheduled.astimezone(UTC) == datetime(2026, 11, 22, 3, 30, tzinfo=UTC)


def test_android_schedule_includes_future_recurrences_while_app_is_closed():
    habit = {"id": uuid4(), "name": "Walk", "question": "Walk today?", "timezone": "Asia/Kolkata",
             "reminder_config": {"type": "daily", "time": "09:00"}}
    alerts = upcoming_habit_alerts(habit, datetime(2026, 11, 22, 2, 0, tzinfo=UTC), days=3)
    assert len(alerts) == 3
    assert alerts[0]["scheduled_at"].astimezone(UTC) == datetime(2026, 11, 22, 3, 30, tzinfo=UTC)
    assert len({alert["key"] for alert in alerts}) == 3


def test_habit_check_in_requires_note_and_numeric_progress(monkeypatch):
    habit_id, user_id = uuid4(), uuid4()
    habit = {"daily_note_required": True, "measurement_type": "quantity",
             "target_value": 10, "target_type": "at_least"}
    monkeypatch.setattr(routes, "fetch_one", lambda *args: habit)
    with pytest.raises(HTTPException) as missing_note:
        routes.save_entry(habit_id, date(2026, 11, 22), {"status": "completed", "value": 12}, {"id": user_id})
    assert missing_note.value.status_code == 422
    with pytest.raises(HTTPException) as missing_progress:
        routes.save_entry(habit_id, date(2026, 11, 22), {"status": "completed", "note": "Walked"}, {"id": user_id})
    assert missing_progress.value.status_code == 422
