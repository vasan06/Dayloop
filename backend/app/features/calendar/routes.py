from uuid import UUID

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

from app.schemas.inputs import EventFields

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events")
def get_events(
    start: datetime | None = None,
    end: datetime | None = None,
    user: dict = Depends(get_current_user),
) -> dict:
    if any(value is not None and value.tzinfo is None for value in (start, end)):
        raise HTTPException(status_code=422, detail="Calendar filters must include a timezone offset.")
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
def create_event(payload: EventFields, user: dict = Depends(get_current_user)) -> dict:
    start_at, end_at = payload["start_at"], payload["end_at"]
    if end_at < start_at:
        raise HTTPException(422, "Event end must be on or after its start.")
    return {
        "item": fetch_one(
            "INSERT INTO calendar_events (user_id,title,description,start_at,end_at,timezone,recurrence_rule) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                payload["title"],
                payload.get("description", ""),
                start_at,
                end_at,
                payload.get("timezone", "Asia/Kolkata"),
                payload.get("recurrence_rule"),
            ),
        )
    }


@router.patch("/events/{event_id}")
def update_event(event_id: UUID, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    updates = []
    parameters = []
    if "completed" in payload:
        updates.append("completed_at=CASE WHEN %s THEN COALESCE(completed_at,now()) ELSE NULL END")
        parameters.append(bool(payload["completed"]))
    if "start_at" in payload or "end_at" in payload:
        current = fetch_one(
            "SELECT start_at,end_at FROM calendar_events WHERE id=%s AND user_id=%s",
            (event_id, user["id"]),
        )
        if not current:
            raise HTTPException(status_code=404, detail="Event not found.")
        try:
            start = datetime.fromisoformat(payload["start_at"]) if "start_at" in payload else current["start_at"]
            end = datetime.fromisoformat(payload["end_at"]) if "end_at" in payload else current["end_at"]
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="Invalid event date/time.") from error
        if start.tzinfo is None or end.tzinfo is None or end < start:
            raise HTTPException(status_code=422, detail="Event dates must include a timezone and end after start.")
        updates.extend(["start_at=%s", "end_at=%s"])
        parameters.extend([start, end])
    if not updates:
        raise HTTPException(status_code=422, detail="No supported event changes were supplied.")
    parameters.extend([event_id, user["id"]])
    event = fetch_one(
        f"UPDATE calendar_events SET {','.join(updates)} WHERE id=%s AND user_id=%s RETURNING *",
        tuple(parameters),
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    return {"item": event}


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: UUID, user: dict = Depends(get_current_user)) -> Response:
    event = fetch_one(
        "DELETE FROM calendar_events WHERE id=%s AND user_id=%s RETURNING id",
        (event_id, user["id"]),
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")
    return Response(status_code=204)
