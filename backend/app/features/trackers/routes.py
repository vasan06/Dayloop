from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

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
def create_tracker(payload: dict, user: dict = Depends(get_current_user)) -> dict:
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
def get_entries(tracker_id: str, user: dict = Depends(get_current_user)) -> dict:
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


@router.post("/{tracker_id}/entries", status_code=201)
def add_entry(tracker_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    if not fetch_one(
        "SELECT id FROM tracker_definitions WHERE id=%s AND user_id=%s AND archived_at IS NULL",
        (tracker_id, user["id"]),
    ):
        raise HTTPException(status_code=404, detail="Tracker not found.")
    return {
        "item": fetch_one(
            "INSERT INTO tracker_entries (tracker_id,numeric_value,text_value,notes) VALUES (%s,%s,%s,%s) RETURNING *",
            (
                tracker_id,
                payload.get("numeric_value"),
                payload.get("text_value"),
                payload.get("notes", ""),
            ),
        )
    }
