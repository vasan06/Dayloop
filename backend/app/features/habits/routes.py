from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.types.json import Jsonb

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection
from app.features.habits.metrics import (
    calculate_habit_metrics,
    habit_start_date,
    normalize_zero_target_entries,
)
from app.features.habits.reminders import sync_habit_reminder
from app.schemas.inputs import HabitFields
from app.services.streaks import (
    habit_is_scheduled,
    local_today,
    measurable_status,
    streak_history,
    timezone_for_stored_value,
    validate_timezone,
)

router = APIRouter(prefix="/habits", tags=["habits"])


def load_habits(user_id):
    habits = fetch_all(
        "SELECT h.*, s.schedule_type,s.schedule_config FROM habits h "
        "LEFT JOIN LATERAL (SELECT schedule_type,schedule_config FROM habit_schedules "
        "WHERE habit_id=h.id ORDER BY effective_from DESC,id DESC LIMIT 1) s ON true "
        "WHERE h.user_id=%s AND h.archived_at IS NULL ORDER BY h.created_at DESC",
        (user_id,),
    )
    grouped = {habit["id"]: [] for habit in habits}
    if grouped:
        entries = fetch_all(
            "SELECT habit_id,entry_date,status,note,updated_at FROM habit_entries "
            "WHERE habit_id=ANY(%s::uuid[]) ORDER BY entry_date",
            (list(grouped),),
        )
        for entry in entries:
            grouped[entry["habit_id"]].append(entry)
    return habits, grouped


def user_timezone(user_id):
    user = fetch_one("SELECT timezone FROM users WHERE id=%s", (user_id,))
    return timezone_for_stored_value(user["timezone"]).key


@router.get("/insights")
def habit_insights(days: int = 42, user: dict = Depends(get_current_user)) -> dict:
    days = max(7, min(days, 366))
    today = local_today(user_timezone(user["id"]))
    series = {
        today - timedelta(days=offset): dict(completed=0, skipped=0, missed=0, scheduled=0, active=0, streaking=0)
        for offset in reversed(range(days))
    }
    habits, entries = load_habits(user["id"])
    streaks = []
    for habit in habits:
        habit_day = local_today(habit["timezone"])
        history = normalize_zero_target_entries(habit, entries[habit["id"]], habit_day)
        by_day = {entry["entry_date"]: entry["status"] for entry in history}
        start = habit_start_date(habit, today)
        for day, point in series.items():
            status = by_day.get(day)
            scheduled = day >= start and habit_is_scheduled(day, habit["schedule_type"] or "daily", habit["schedule_config"] or {})
            if scheduled or status:
                point["scheduled"] += 1
                point["active"] += int(status is not None)
                point["completed"] += int(status == "completed")
                point["streaking"] += int(status == "completed")
                point["skipped"] += int(status == "skipped")
                point["missed"] += int(status in {"failed", "missed"} or (status is None and day < today))
        streaks.append({"habit_id": habit["id"], "name": habit["name"], **calculate_habit_metrics(habit, history)})
    return {
        "days": days,
        "series": [{"day": day, **point, "completion_rate": round(100 * point["completed"] / max(1, point["scheduled"]))}
                   for day, point in series.items()],
        "streaks": streaks,
    }


@router.get("")
def get_habits(user: dict = Depends(get_current_user)) -> dict:
    habits, entries = load_habits(user["id"])
    for habit in habits:
        habit.update(calculate_habit_metrics(habit, entries[habit["id"]]))
    return {"items": habits}


def measurement(value):
    if value is None:
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise HTTPException(422, "Provide a valid numeric measurement.") from error
    if not number.is_finite() or not 0 <= number < 100_000_000_000 or number.as_tuple().exponent < -3:
        raise HTTPException(422, "Provide a non-negative measurement with up to three decimal places.")
    return number


def validate_habit_fields(payload):
    if "timezone" in payload:
        validate_timezone(payload["timezone"])
    for field in ("reminder_config", "frequency_config"):
        if field in payload and not isinstance(payload[field], dict):
            raise HTTPException(422, f"{field} must be an object.")
    if "target_value" in payload:
        payload["target_value"] = measurement(payload["target_value"])


@router.post("", status_code=201)
def create_habit(payload: HabitFields, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    if not name or len(name) > 120:
        raise HTTPException(
            status_code=422, detail="Habit name is required (maximum 120 characters)."
        )
    if fetch_one("SELECT id FROM habits WHERE user_id=%s AND lower(name)=lower(%s) AND archived_at IS NULL", (user["id"], name)):
        raise HTTPException(status_code=409, detail="A habit with this name already exists.")
    schedule_type = payload.get("schedule_type", "daily")
    if schedule_type not in ("daily", "weekly", "custom"):
        raise HTTPException(status_code=422, detail="Unsupported habit schedule.")
    validate_habit_fields(payload)
    habit_type = payload.get("habit_type", "positive")
    measurement_type = payload.get("measurement_type", "boolean")
    target_type = payload.get("target_type", "at_least")
    schedule_config = payload.get("schedule_config", {})
    weekdays = schedule_config.get("weekdays", []) if isinstance(schedule_config, dict) else None
    if not isinstance(weekdays, list) or (schedule_type != "daily" and not weekdays) or any(type(day) is not int or not 0 <= day <= 6 for day in weekdays):
        raise HTTPException(
            status_code=422, detail="Schedule weekdays must be a list of numbers from 0 to 6."
        )
    with get_connection() as connection:
        habit = connection.execute(
            "INSERT INTO habits (user_id,name,description,question,habit_type,measurement_type,"
            "target_value,target_type,unit,timezone,reminder_config,frequency_config,color,daily_note_required) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s) RETURNING *",
            (
                user["id"],
                name,
                payload.get("description", ""),
                payload.get("question", ""),
                habit_type,
                measurement_type,
                payload.get("target_value"),
                target_type,
                payload.get("unit"),
                payload.get("timezone", "Asia/Kolkata"),
                Jsonb(payload.get("reminder_config", {})),
                Jsonb(payload.get("frequency_config", schedule_config)),
                payload.get("color"),
                bool(payload.get("daily_note_required", False)),
            ),
        ).fetchone()
        connection.execute(
            "INSERT INTO habit_schedules (habit_id,schedule_type,schedule_config) VALUES (%s,%s,%s::jsonb)",
            (habit["id"], schedule_type, Jsonb(schedule_config)),
        )
        sync_habit_reminder(connection, user["id"], habit)
    return {"item": habit}


@router.patch("/{habit_id}")
def update_habit(habit_id: UUID, payload: HabitFields, user: dict = Depends(get_current_user)) -> dict:
    current = fetch_one("SELECT * FROM habits WHERE id=%s AND user_id=%s AND archived_at IS NULL", (habit_id, user["id"]))
    if not current:
        raise HTTPException(status_code=404, detail="Habit not found.")
    name = str(payload.get("name", current["name"])).strip()
    if not name or len(name) > 120:
        raise HTTPException(status_code=422, detail="Habit name is required (maximum 120 characters).")
    duplicate = fetch_one("SELECT id FROM habits WHERE user_id=%s AND lower(name)=lower(%s) AND id<>%s AND archived_at IS NULL", (user["id"], name, habit_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="A habit with this name already exists.")

    current_schedule = fetch_one(
        "SELECT schedule_type,schedule_config FROM habit_schedules "
        "WHERE habit_id=%s ORDER BY effective_from DESC,id DESC LIMIT 1",
        (habit_id,),
    ) or {"schedule_type": "daily", "schedule_config": {}}
    schedule_type = payload.get("schedule_type", current_schedule["schedule_type"])
    schedule_config = payload.get("schedule_config", current_schedule["schedule_config"] or {})
    if schedule_type not in ("daily", "weekly", "custom"):
        raise HTTPException(status_code=422, detail="Unsupported habit schedule.")
    weekdays = schedule_config.get("weekdays", []) if isinstance(schedule_config, dict) else None
    if not isinstance(weekdays, list) or (schedule_type != "daily" and not weekdays) or any(type(day) is not int or not 0 <= day <= 6 for day in weekdays):
        raise HTTPException(status_code=422, detail="Schedule weekdays must be a list of numbers from 0 to 6.")

    allowed = {
        "name", "description", "question", "habit_type", "measurement_type",
        "target_value", "target_type", "unit", "timezone", "reminder_config",
        "frequency_config", "color", "daily_note_required",
    }
    validate_habit_fields(payload)
    values = {key: payload[key] for key in allowed if key in payload}
    for field in ("reminder_config", "frequency_config"):
        if field in values:
            values[field] = Jsonb(values[field])
    values["name"] = name
    assignments = ",".join(f"{key}=%s" for key in values)
    schedule_changed = "schedule_type" in payload or "schedule_config" in payload

    with get_connection() as connection:
        updated = connection.execute(
            f"UPDATE habits SET {assignments},updated_at=now() WHERE id=%s AND user_id=%s RETURNING *",
            (*values.values(), habit_id, user["id"]),
        ).fetchone()
        if schedule_changed:
            connection.execute(
                "INSERT INTO habit_schedules (habit_id,schedule_type,schedule_config) VALUES (%s,%s,%s::jsonb)",
                (habit_id, schedule_type, Jsonb(schedule_config)),
            )
        sync_habit_reminder(connection, user["id"], updated)
    return {"item": updated}


@router.get("/streaks/overview")
def streak_overview(user: dict = Depends(get_current_user)) -> dict:
    timezone = user_timezone(user["id"])
    today = local_today(timezone)
    habits, entries = load_habits(user["id"])
    individual = []
    events = []
    longest = 0
    for habit in habits:
        habit_day = local_today(habit["timezone"])
        history = normalize_zero_target_entries(habit, entries[habit["id"]], habit_day)
        result = streak_history(history, habit["schedule_type"] or "daily", habit["schedule_config"] or {}, habit_day)
        current = result["current"]
        longest = max(longest, result["longest"])
        individual.append({
            "habit_id": habit["id"], "name": habit["name"], "current": len(current),
            "start": current[0] if current else None, "last_update": habit_day,
            "break_date": result["last_break"],
        })
        logged = {entry["entry_date"]: entry for entry in history}
        for event in result["events"][-100:]:
            entry = logged.get(event["event_date"], {})
            events.append({**event, "habit_id": habit["id"], "reason": entry.get("note", ""),
                           "created_at": entry.get("updated_at")})

    task_days = fetch_all(
        "SELECT (due_at AT TIME ZONE %s)::date AS day, bool_and(status='completed') AS complete FROM tasks "
        "WHERE user_id=%s AND deleted_at IS NULL AND status<>'cancelled' AND due_at IS NOT NULL "
        "AND (due_at AT TIME ZONE %s)::date <= %s GROUP BY day ORDER BY day DESC",
        (timezone, user["id"], timezone, today),
    )
    combined = 0
    for day in task_days:
        if day["complete"]:
            combined += 1
        elif day["day"] != today:
            break
    return {
        "timezone": timezone, "today": today,
        "combined": {"current": combined, "last_update": today},
        "habits": individual,
        "events": sorted(events, key=lambda e: e["event_date"], reverse=True)[:100],
        "longest": max(longest, combined),
    }


@router.get("/{habit_id}/entries")
def get_entries(habit_id: UUID, user: dict = Depends(get_current_user)) -> dict:
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
    habit_id: UUID, entry_date: date, payload: dict, user: dict = Depends(get_current_user)
) -> dict:
    if payload.get("status") not in ("completed", "skipped", "missed", "failed"):
        raise HTTPException(status_code=422, detail="Unsupported habit entry status.")
    habit = fetch_one("SELECT * FROM habits WHERE id=%s AND user_id=%s AND archived_at IS NULL", (habit_id, user["id"]))
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found.")
    status = payload["status"]
    note = payload.get("note", "")
    if not isinstance(note, str):
        raise HTTPException(422, "Habit notes must be text.")
    if status == "skipped" and not note.strip():
        raise HTTPException(status_code=422, detail="A skip requires a note.")
    if status == "completed" and (habit["daily_note_required"] or habit["measurement_type"] == "text") and not note.strip():
        raise HTTPException(422, "A note is required for this check-in.")
    value = measurement(payload.get("value"))
    if status == "completed" and habit["measurement_type"] in {"quantity", "duration"} and value is None:
        raise HTTPException(422, "A numeric measurement is required for this check-in.")
    if status == "missed" and habit["target_value"] == 0 and habit["measurement_type"] in {"quantity", "duration"}:
        status = "completed"
        value = 0
    if status == "completed" and habit["measurement_type"] in {"quantity", "duration"}:
        status = measurable_status(
            value,
            habit["target_value"],
            habit["target_type"],
        )
        if status == "missed":
            status = "failed"
    entry = fetch_one(
        "INSERT INTO habit_entries (habit_id,entry_date,status,value,note) VALUES (%s,%s,%s,%s,%s) "
        "ON CONFLICT (habit_id,entry_date) DO UPDATE SET status=EXCLUDED.status,value=EXCLUDED.value,"
        "note=EXCLUDED.note,updated_at=now() RETURNING *",
        (habit_id, entry_date, status, value, note),
    )
    return {"item": entry}


@router.delete("/{habit_id}", status_code=204)
def archive_habit(habit_id: UUID, user: dict = Depends(get_current_user)) -> Response:
    habit = fetch_one(
        "UPDATE habits SET archived_at=now() WHERE id=%s AND user_id=%s AND archived_at IS NULL RETURNING id",
        (habit_id, user["id"]),
    )
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found.")
    return Response(status_code=204)
