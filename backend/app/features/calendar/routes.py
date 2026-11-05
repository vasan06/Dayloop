from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events")
def get_events(
    start: datetime | None = None,
    end: datetime | None = None,
    user: dict = Depends(get_current_user),
) -> dict:
    if start and end and end < start:
        raise HTTPException(status_code=422, detail="Calendar end must be after start.")
    conditions = ["user_id=%s"]
    parameters: list = [user["id"]]
    if start:
        conditions.append("end_at >= %s")
        parameters.append(start)
    if end:
        conditions.append("start_at <= %s")
        parameters.append(end)
    return {
        "items": fetch_all(
            "SELECT * FROM calendar_events WHERE "
            + " AND ".join(conditions)
            + " ORDER BY start_at LIMIT 500",
            tuple(parameters),
        )
    }


@router.post("/events", status_code=201)
def create_event(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    try:
        start_at = datetime.fromisoformat(str(payload.get("start_at")))
        end_at = datetime.fromisoformat(str(payload.get("end_at")))
    except ValueError as error:
        raise HTTPException(
            status_code=422, detail="Event start and end must be ISO timestamps."
        ) from error
    title = str(payload.get("title", "")).strip()
    if not title or end_at < start_at or start_at.tzinfo is None or end_at.tzinfo is None:
        raise HTTPException(
            status_code=422, detail="Provide a title and timezone-aware start/end timestamps."
        )
    return {
        "item": fetch_one(
            "INSERT INTO calendar_events (user_id,title,description,start_at,end_at,timezone,recurrence_rule) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                title,
                payload.get("description", ""),
                start_at,
                end_at,
                payload.get("timezone", "Asia/Kolkata"),
                payload.get("recurrence_rule"),
            ),
        )
    }
