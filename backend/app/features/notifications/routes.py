from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection
from app.features.habits.reminders import upcoming_habit_alerts
from app.features.habits.routes import save_entry
from app.features.tasks.service import update_task
from app.schemas.inputs import ReminderFields
from app.services.streaks import local_today, timezone_for_stored_value

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/{notification_id}/action")
def act_on_notification(notification_id: UUID, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    """Apply an authenticated action to the notification's original record."""
    action = payload.get("action")
    notification = fetch_one(
        "SELECT id,source_type,source_id,title,body FROM notifications "
        "WHERE id=%s AND user_id=%s AND dismissed_at IS NULL",
        (notification_id, user["id"]),
    )
    if not notification:
        raise HTTPException(404, "Notification not found or already handled.")
    source = notification["source_type"]
    source_id = notification["source_id"]
    if action == "snooze":
        minutes = payload.get("minutes", 15)
        if not isinstance(minutes, int) or not 1 <= minutes <= 1440:
            raise HTTPException(422, "Snooze must be between 1 and 1440 minutes.")
        with get_connection() as connection:
            handled = connection.execute(
                "UPDATE notifications SET dismissed_at=now(),read_at=COALESCE(read_at,now()) "
                "WHERE id=%s AND user_id=%s AND dismissed_at IS NULL RETURNING id",
                (notification_id, user["id"]),
            ).fetchone()
            if not handled:
                raise HTTPException(409, "Notification already handled.")
            connection.execute(
                "INSERT INTO notification_jobs (user_id,title,body,source_type,source_id,channel,scheduled_at) "
                "VALUES (%s,%s,%s,%s,%s,'in_app',now()+(%s * interval '1 minute'))",
                (user["id"], notification["title"], notification["body"], source, source_id, minutes),
            )
        return {"saved": True}
    if not source_id:
        raise HTTPException(422, "This notification has no actionable record.")
    if source == "task" and action == "complete":
        update_task(user["id"], source_id, {"status": "completed"})
    elif source == "habit" and action in {"complete", "skip"}:
        habit = fetch_one(
            "SELECT timezone FROM habits WHERE id=%s AND user_id=%s AND archived_at IS NULL",
            (source_id, user["id"]),
        )
        if not habit:
            raise HTTPException(404, "Habit not found.")
        day = local_today(timezone_for_stored_value(habit["timezone"]).key)
        entry = {"status": "completed" if action == "complete" else "skipped",
                 "value": payload.get("value"), "note": payload.get("note", "")}
        save_entry(source_id, day, entry, user)
    else:
        raise HTTPException(422, "Unsupported action for this notification.")
    fetch_one(
        "UPDATE notifications SET dismissed_at=now(),read_at=COALESCE(read_at,now()) "
        "WHERE id=%s AND user_id=%s AND dismissed_at IS NULL RETURNING id",
        (notification_id, user["id"]),
    )
    return {"saved": True}


@router.get("/center")
def notification_center(user: dict = Depends(get_current_user)) -> dict:
    items = fetch_all(
        "SELECT id,title,body,source_type,source_id,read_at,created_at "
        "FROM notifications "
        "WHERE user_id=%s AND dismissed_at IS NULL "
        "ORDER BY created_at DESC LIMIT 100",
        (user["id"],),
    )
    tasks = fetch_all(
        "SELECT id,title,due_at,status FROM tasks "
        "WHERE user_id=%s AND deleted_at IS NULL "
        "AND status NOT IN ('completed','cancelled') AND due_at IS NOT NULL "
        "ORDER BY due_at ASC LIMIT 50",
        (user["id"],),
    )
    events = fetch_all(
        "SELECT id,title,description,start_at,end_at,completed_at FROM calendar_events "
        "WHERE user_id=%s AND completed_at IS NULL AND end_at >= now() ORDER BY start_at ASC LIMIT 50",
        (user["id"],),
    )
    upcoming = fetch_all(
        "SELECT id,title,body,source_type,source_id,scheduled_at FROM notification_jobs "
        "WHERE user_id=%s AND status='pending' AND channel='in_app' "
        "AND scheduled_at > now() - interval '7 days' AND scheduled_at <= now() + interval '30 days' "
        "ORDER BY scheduled_at ASC LIMIT 50",
        (user["id"],),
    )
    habits = fetch_all(
        "SELECT id,name,description,question,timezone,reminder_config FROM habits "
        "WHERE user_id=%s AND archived_at IS NULL AND reminder_config->>'type' IS DISTINCT FROM 'none' "
        "ORDER BY created_at DESC LIMIT 100",
        (user["id"],),
    )
    now = datetime.now(UTC)
    native_habits = [alert for habit in habits for alert in upcoming_habit_alerts(habit, now)]
    return {"items": items, "tasks": tasks, "events": events, "upcoming": upcoming,
            "native_habits": native_habits}


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user)) -> dict:
    fetch_all(
        "UPDATE notifications SET read_at=COALESCE(read_at,now()) "
        "WHERE user_id=%s AND dismissed_at IS NULL AND read_at IS NULL "
        "RETURNING id",
        (user["id"],),
    )
    return {"saved": True}


@router.get("")
def get_notifications(unread_only: bool = False, user: dict = Depends(get_current_user)) -> dict:
    condition = " AND read_at IS NULL" if unread_only else ""
    return {
        "items": fetch_all(
            "SELECT id,title,body,source_type,source_id,read_at,created_at FROM notifications "
            "WHERE user_id=%s AND dismissed_at IS NULL" + condition + " ORDER BY created_at DESC LIMIT 100",
            (user["id"],),
        )
    }


@router.post("/reminders", status_code=201)
def create_reminder(payload: ReminderFields, user: dict = Depends(get_current_user)) -> dict:
    return {
        "item": fetch_one(
            "INSERT INTO notification_jobs (user_id,title,body,source_type,source_id,channel,scheduled_at) "
            "VALUES (%s,%s,%s,%s,%s,'in_app',%s) RETURNING id,title,body,scheduled_at,status",
            (
                user["id"],
                payload["title"],
                payload.get("body", ""),
                payload.get("source_type"),
                payload.get("source_id"),
                payload["scheduled_at"],
            ),
        )
    }


@router.patch("/{notification_id}/read")
def mark_read(notification_id: UUID, user: dict = Depends(get_current_user)) -> dict:
    notification = fetch_one(
        "UPDATE notifications SET read_at=COALESCE(read_at,now()) "
        "WHERE id=%s AND user_id=%s RETURNING id,read_at",
        (notification_id, user["id"]),
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"item": notification}


@router.patch("/{notification_id}/dismiss")
def dismiss_notification(notification_id: UUID, user: dict = Depends(get_current_user)) -> dict:
    notification = fetch_one(
        "UPDATE notifications SET dismissed_at=now(),read_at=COALESCE(read_at,now()) "
        "WHERE id=%s AND user_id=%s AND dismissed_at IS NULL "
        "RETURNING id,dismissed_at",
        (notification_id, user["id"]),
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"item": notification}
