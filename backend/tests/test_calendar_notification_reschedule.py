from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.features.calendar import routes


def test_reschedule_event_preserves_owner_and_dates(monkeypatch):
    user_id = uuid4()
    event_id = uuid4()
    original = datetime(2026, 11, 22, 10, tzinfo=UTC)
    calls = []

    def fake_fetch(query, params):
        calls.append((query, params))
        if query.startswith("SELECT"):
            return {"start_at": original, "end_at": original + timedelta(hours=1)}
        return {"id": event_id, "start_at": params[0], "end_at": params[1]}

    monkeypatch.setattr(routes, "fetch_one", fake_fetch)
    start = "2026-11-23T11:00:00+00:00"
    end = "2026-11-23T12:00:00+00:00"
    result = routes.update_event(event_id, {"start_at": start, "end_at": end}, {"id": user_id})
    assert result["item"]["start_at"] == datetime.fromisoformat(start)
    assert calls[-1][1][-2:] == (event_id, user_id)
    assert "start_at=%s" in calls[-1][0]


def test_reschedule_event_rejects_naive_datetime(monkeypatch):
    user_id = uuid4()
    event_id = uuid4()
    monkeypatch.setattr(routes, "fetch_one", lambda query, params: {
        "start_at": datetime.now(UTC),
        "end_at": datetime.now(UTC) + timedelta(hours=1),
    })
    with pytest.raises(HTTPException) as error:
        routes.update_event(event_id, {"start_at": "2026-11-23T10:00:00"}, {"id": user_id})
    assert error.value.status_code == 422
