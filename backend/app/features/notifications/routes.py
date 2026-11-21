from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one
from app.schemas.inputs import ReminderFields

router = APIRouter(prefix="/notifications", tags=["notifications"])


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
    return {"items": items, "tasks": tasks, "events": events}


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
