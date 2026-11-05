from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def get_notifications(unread_only: bool = False, user: dict = Depends(get_current_user)) -> dict:
    condition = " AND read_at IS NULL" if unread_only else ""
    return {
        "items": fetch_all(
            "SELECT id,title,body,source_type,source_id,read_at,created_at FROM notifications "
            "WHERE user_id=%s" + condition + " ORDER BY created_at DESC LIMIT 100",
            (user["id"],),
        )
    }


@router.post("/reminders", status_code=201)
def create_reminder(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    try:
        scheduled_at = datetime.fromisoformat(str(payload.get("scheduled_at")))
    except ValueError as error:
        raise HTTPException(
            status_code=422, detail="Reminder time must be an ISO timestamp."
        ) from error
    if scheduled_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="Reminder time must include a timezone offset.")
    if payload.get("channel", "in_app") != "in_app":
        raise HTTPException(
            status_code=422,
            detail="Email and browser push delivery adapters are not configured yet.",
        )
    title = str(payload.get("title", "")).strip()
    if not title or len(title) > 180:
        raise HTTPException(status_code=422, detail="Reminder title is required.")
    return {
        "item": fetch_one(
            "INSERT INTO notification_jobs (user_id,title,body,source_type,source_id,channel,scheduled_at) "
            "VALUES (%s,%s,%s,%s,%s,'in_app',%s) RETURNING id,title,body,scheduled_at,status",
            (
                user["id"],
                title,
                payload.get("body", ""),
                payload.get("source_type"),
                payload.get("source_id"),
                scheduled_at,
            ),
        )
    }


@router.patch("/{notification_id}/read")
def mark_read(notification_id: str, user: dict = Depends(get_current_user)) -> dict:
    notification = fetch_one(
        "UPDATE notifications SET read_at=COALESCE(read_at,now()) "
        "WHERE id=%s AND user_id=%s RETURNING id,read_at",
        (notification_id, user["id"]),
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"item": notification}
