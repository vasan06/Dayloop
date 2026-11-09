from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection
from app.features.habits.metrics import calculate_habit_metrics

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("")
def get_habits(user: dict = Depends(get_current_user)) -> dict:
    habits = fetch_all(
        "SELECT h.*, s.schedule_type,s.schedule_config FROM habits h "
        "LEFT JOIN LATERAL (SELECT schedule_type,schedule_config FROM habit_schedules "
        "WHERE habit_id=h.id ORDER BY effective_from DESC LIMIT 1) s ON true "
        "WHERE h.user_id=%s AND h.archived_at IS NULL ORDER BY h.created_at DESC",
        (user["id"],),
    )
    if not habits:
        return {"items": []}
    entries = fetch_all(
        "SELECT habit_id,entry_date,status FROM habit_entries "
        "WHERE habit_id=ANY(%s::uuid[]) AND entry_date >= CURRENT_DATE-365",
        ([habit["id"] for habit in habits],),
    )
    entries_by_habit: dict = {}
    for entry in entries:
        entries_by_habit.setdefault(entry["habit_id"], []).append(entry)
    for habit in habits:
        habit.update(calculate_habit_metrics(habit, entries_by_habit.get(habit["id"], [])))
    return {"items": habits}


@router.post("", status_code=201)
def create_habit(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    if not name or len(name) > 120:
        raise HTTPException(
            status_code=422, detail="Habit name is required (maximum 120 characters)."
        )
    schedule_type = payload.get("schedule_type", "daily")
    if schedule_type not in {"daily", "weekly", "custom"}:
        raise HTTPException(status_code=422, detail="Unsupported habit schedule.")
    habit_type = payload.get("habit_type", "positive")
    measurement_type = payload.get("measurement_type", "boolean")
    if habit_type not in {"positive", "negative"} or measurement_type not in {
        "boolean",
        "quantity",
        "duration",
    }:
        raise HTTPException(status_code=422, detail="Unsupported habit type or measurement.")
    schedule_config = payload.get("schedule_config", {})
    weekdays = schedule_config.get("weekdays", []) if isinstance(schedule_config, dict) else None
    if weekdays is None or any(not isinstance(day, int) or day < 0 or day > 6 for day in weekdays):
        raise HTTPException(
            status_code=422, detail="Schedule weekdays must be a list of numbers from 0 to 6."
        )
    with get_connection() as connection:
        habit = connection.execute(
            "INSERT INTO habits (user_id,name,description,habit_type,measurement_type,target_value,unit,timezone) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                name,
                payload.get("description", ""),
                habit_type,
                measurement_type,
                payload.get("target_value"),
                payload.get("unit"),
                payload.get("timezone", "Asia/Kolkata"),
            ),
        ).fetchone()
        connection.execute(
            "INSERT INTO habit_schedules (habit_id,schedule_type,schedule_config) VALUES (%s,%s,%s::jsonb)",
            (habit["id"], schedule_type, __import__("json").dumps(schedule_config)),
        )
    return {"item": habit}


@router.get("/{habit_id}/entries")
def get_entries(habit_id: str, user: dict = Depends(get_current_user)) -> dict:
    if not fetch_one("SELECT id FROM habits WHERE id=%s AND user_id=%s", (habit_id, user["id"])):
        raise HTTPException(status_code=404, detail="Habit not found.")
    return {
        "items": fetch_all(
            "SELECT entry_date,status,value,note,updated_at FROM habit_entries "
            "WHERE habit_id=%s ORDER BY entry_date DESC LIMIT 366",
            (habit_id,),
        )
    }


@router.put("/{habit_id}/entries/{entry_date}")
def save_entry(
    habit_id: str, entry_date: str, payload: dict, user: dict = Depends(get_current_user)
) -> dict:
    if payload.get("status") not in {"completed", "skipped", "missed", "failed"}:
        raise HTTPException(status_code=422, detail="Unsupported habit entry status.")
    if not fetch_one("SELECT id FROM habits WHERE id=%s AND user_id=%s", (habit_id, user["id"])):
        raise HTTPException(status_code=404, detail="Habit not found.")
    entry = fetch_one(
        "INSERT INTO habit_entries (habit_id,entry_date,status,value,note) VALUES (%s,%s,%s,%s,%s) "
        "ON CONFLICT (habit_id,entry_date) DO UPDATE SET status=EXCLUDED.status,value=EXCLUDED.value,"
        "note=EXCLUDED.note,updated_at=now() RETURNING *",
        (habit_id, entry_date, payload["status"], payload.get("value"), payload.get("note", "")),
    )
    return {"item": entry}


@router.delete("/{habit_id}", status_code=204)
def archive_habit(habit_id: str, user: dict = Depends(get_current_user)) -> Response:
    habit = fetch_one(
        "UPDATE habits SET archived_at=now() WHERE id=%s AND user_id=%s AND archived_at IS NULL RETURNING id",
        (habit_id, user["id"]),
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found.")
    return Response(status_code=204)
