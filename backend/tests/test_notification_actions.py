from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.features.notifications import routes


def test_task_action_uses_user_scoped_record(monkeypatch):
    notification_id = uuid4()
    task_id = uuid4()
    user_id = uuid4()
    calls = []

    def fetch(query, parameters):
        calls.append((query, parameters))
        if query.startswith("SELECT"):
            return {"id": notification_id, "source_type": "task", "source_id": task_id,
                    "title": "Task", "body": "Due"}
        return {"id": notification_id}

    monkeypatch.setattr(routes, "fetch_one", fetch)
    monkeypatch.setattr(routes, "update_task", lambda uid, tid, body: calls.append((uid, tid, body)))
    assert routes.act_on_notification(notification_id, {"action": "complete"}, {"id": user_id}) == {"saved": True}
    assert calls[0][1] == (notification_id, user_id)
    assert (user_id, task_id, {"status": "completed"}) in calls


def test_unknown_action_rejected(monkeypatch):
    monkeypatch.setattr(routes, "fetch_one", lambda *args: {
        "id": uuid4(), "source_type": "task", "source_id": uuid4(), "title": "Task", "body": "Due"
    })
    with pytest.raises(HTTPException) as error:
        routes.act_on_notification(uuid4(), {"action": "delete"}, {"id": uuid4()})
    assert error.value.status_code == 422
