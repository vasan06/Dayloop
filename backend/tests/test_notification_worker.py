from contextlib import contextmanager
from datetime import UTC, datetime
from uuid import uuid4

from app import worker


def test_due_habit_job_creates_inbox_entry_and_next_reminder(monkeypatch):
    job_id, user_id, habit_id, notification_id = (uuid4() for _ in range(4))
    job = {"id": job_id, "user_id": user_id, "source_id": habit_id,
           "source_type": "habit", "title": "Habit reminder", "body": "Check in",
           "scheduled_at": datetime.now(UTC)}
    habit = {"id": habit_id, "name": "Walk", "description": "", "question": "",
             "timezone": "Asia/Kolkata", "reminder_config": {"type": "daily", "time": "09:00"}}
    calls = []

    class Result:
        def __init__(self, rows):
            self.rows = rows

        def fetchall(self):
            return self.rows

        def fetchone(self):
            return self.rows[0] if self.rows else None

    class Connection:
        def execute(self, query, params=()):
            calls.append((query, params))
            if query.startswith("SELECT id,user_id"):
                return Result([job])
            if query.startswith("INSERT INTO notifications"):
                return Result([{"id": notification_id}])
            if query.startswith("SELECT id,name"):
                return Result([habit])
            return Result([])

    @contextmanager
    def connection():
        yield Connection()

    rescheduled = []
    monkeypatch.setattr(worker, "get_connection", connection)
    monkeypatch.setattr(worker, "sync_habit_reminder", lambda conn, uid, record: rescheduled.append((uid, record)))

    assert worker.process_due_notifications() == 1
    assert any(query.startswith("INSERT INTO notifications") and params[0] == user_id for query, params in calls)
    assert any(query.startswith("UPDATE notification_jobs SET status='sent'") and params == (job_id,) for query, params in calls)
    assert rescheduled == [(user_id, habit)]
