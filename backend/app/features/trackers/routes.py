from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection
from app.schemas.inputs import TrackerChanges, TrackerEntry, TrackerFields

router = APIRouter(prefix="/trackers", tags=["trackers"])


@router.get("")
def get_trackers(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT * FROM tracker_definitions WHERE user_id=%s AND archived_at IS NULL ORDER BY created_at DESC",
            (user["id"],),
        )
    }


@router.post("", status_code=201)
def create_tracker(payload: TrackerFields, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    metric_type = payload.get("metric_type", "number")
    if not name or metric_type not in {"number", "duration", "boolean"}:
        raise HTTPException(
            status_code=422, detail="Provide a tracker name and supported metric type."
        )
    frequency = payload.get("frequency", "daily")
    if frequency not in {"daily", "weekly", "monthly"}:
        raise HTTPException(status_code=422, detail="Unsupported tracker frequency.")
    return {
        "item": fetch_one(
            "INSERT INTO tracker_definitions (user_id,name,metric_type,unit,target_value,frequency) "
            "VALUES (%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                name,
                metric_type,
                payload.get("unit"),
                payload.get("target_value"),
                frequency,
            ),
        )
    }


@router.get("/{tracker_id}/entries")
def get_entries(tracker_id: UUID, user: dict = Depends(get_current_user)) -> dict:
    if not fetch_one(
        "SELECT id FROM tracker_definitions WHERE id=%s AND user_id=%s AND archived_at IS NULL",
        (tracker_id, user["id"]),
    ):
        raise HTTPException(status_code=404, detail="Tracker not found.")
    return {
        "items": fetch_all(
            "SELECT id,recorded_at,numeric_value,text_value,notes FROM tracker_entries WHERE tracker_id=%s ORDER BY recorded_at DESC LIMIT 365",
            (tracker_id,),
        )
    }


def lock_tracker(connection, tracker_id: UUID, user_id: UUID) -> dict:
    tracker = connection.execute(
        "SELECT metric_type FROM tracker_definitions WHERE id=%s AND user_id=%s "
        "AND archived_at IS NULL FOR UPDATE",
        (tracker_id, user_id),
    ).fetchone()
    if not tracker:
        raise HTTPException(404, "Tracker not found.")
    return tracker


@router.patch("/{tracker_id}")
def update_tracker(tracker_id: UUID, payload: TrackerChanges, user: dict = Depends(get_current_user)) -> dict:
    allowed = {"name", "metric_type", "frequency", "unit", "target_value"}
    changes = {key: value for key, value in payload.items() if key in allowed}
    if not changes:
        raise HTTPException(422, "No tracker changes were provided.")
    with get_connection() as connection:
        tracker = lock_tracker(connection, tracker_id, user["id"])
        if "metric_type" in changes and changes["metric_type"] != tracker["metric_type"]:
            has_entries = connection.execute(
                "SELECT 1 FROM tracker_entries WHERE tracker_id=%s LIMIT 1", (tracker_id,)
            ).fetchone()
            if has_entries:
                raise HTTPException(409, "The measurement type is fixed after the first entry.")
        assignments = ", ".join(f"{key}=%s" for key in changes)
        saved = connection.execute(
            f"UPDATE tracker_definitions SET {assignments} WHERE id=%s AND user_id=%s RETURNING *",
            tuple(changes.values()) + (tracker_id, user["id"]),
        ).fetchone()
    return {"item": saved}


@router.delete("/{tracker_id}", status_code=204)
def archive_tracker(tracker_id: UUID, user: dict = Depends(get_current_user)) -> Response:
    archived = fetch_one(
        "UPDATE tracker_definitions SET archived_at=now() "
        "WHERE id=%s AND user_id=%s AND archived_at IS NULL RETURNING id",
        (tracker_id, user["id"]),
    )
    if not archived:
        raise HTTPException(404, "Tracker not found.")
    return Response(status_code=204)


@router.post("/{tracker_id}/entries", status_code=201)
def add_entry(tracker_id: UUID, payload: TrackerEntry, user: dict = Depends(get_current_user)) -> dict:
    with get_connection() as connection:
        tracker = lock_tracker(connection, tracker_id, user["id"])
        value = payload["numeric_value"]
        if tracker["metric_type"] == "boolean" and value not in (0, 1):
            raise HTTPException(422, "A yes/no tracker accepts 0 or 1.")
        if tracker["metric_type"] == "duration" and value < 0:
            raise HTTPException(422, "Duration cannot be negative.")
        entry = connection.execute(
            "INSERT INTO tracker_entries (tracker_id,numeric_value,text_value,notes) "
            "VALUES (%s,%s,%s,%s) RETURNING *",
            (tracker_id, value, payload.get("text_value"), payload.get("notes", "")),
        ).fetchone()
    return {"item": entry}
