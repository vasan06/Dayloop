from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one, get_connection
from app.features.habits.metrics import calculate_habit_metrics
from app.services.streaks import calculate_habit_streak, measurable_status

router = APIRouter(prefix="/habits", tags=["habits"])


@router.get("/insights")
def habit_insights(days: int = 42, user: dict = Depends(get_current_user)) -> dict:
    days = max(7, min(days, 366))
    rows = fetch_all(
        "SELECT e.entry_date,e.status,h.id AS habit_id FROM habit_entries e JOIN habits h ON h.id=e.habit_id "
        "WHERE h.user_id=%s AND h.archived_at IS NULL AND e.entry_date >= CURRENT_DATE - (%s::int - 1) ORDER BY e.entry_date",
        (user["id"], days),
    )
    by_day: dict = {}
    for row in rows:
        day = str(row["entry_date"])
        item = by_day.setdefault(day, {"completed": 0, "skipped": 0, "scheduled": 0, "active": 0, "streaking": 0})
        status = row["status"]
        if status == "completed":
            item["completed"] += 1
            item["streaking"] += 1
        elif status == "skipped":
            item["skipped"] += 1
        if status in {"completed", "skipped"}:
            item["active"] += 1
    series = []
    from datetime import date, timedelta
    today = date.today()
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        value = by_day.get(str(day), {"completed": 0, "skipped": 0, "scheduled": 0, "active": 0, "streaking": 0})
        series.append({"day": str(day), **value, "completion_rate": round(value["completed"] / max(1, value["completed"] + value["skipped"]) * 100)})
    return {"days": days, "series": series, "streaks": []}


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
    if fetch_one("SELECT id FROM habits WHERE user_id=%s AND lower(name)=lower(%s) AND archived_at IS NULL", (user["id"], name)):
        raise HTTPException(status_code=409, detail="A habit with this name already exists.")
    schedule_type = payload.get("schedule_type", "daily")
    if schedule_type not in {"daily", "weekly", "custom"}:
        raise HTTPException(status_code=422, detail="Unsupported habit schedule.")
    habit_type = payload.get("habit_type", "positive")
    measurement_type = payload.get("measurement_type", "boolean")
    if habit_type not in {"positive", "negative"} or measurement_type not in {
        "boolean",
        "quantity",
        "duration",
        "text",
    }:
        raise HTTPException(status_code=422, detail="Unsupported habit type or measurement.")
    target_type = payload.get("target_type", "at_least")
    if target_type not in {"at_least", "at_most"}:
        raise HTTPException(status_code=422, detail="Target type must be at_least or at_most.")
    schedule_config = payload.get("schedule_config", {})
    weekdays = schedule_config.get("weekdays", []) if isinstance(schedule_config, dict) else None
    if weekdays is None or any(not isinstance(day, int) or day < 0 or day > 6 for day in weekdays):
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
                __import__("json").dumps(payload.get("reminder_config", {})),
                __import__("json").dumps(payload.get("frequency_config", schedule_config)),
                payload.get("color"),
                bool(payload.get("daily_note_required", False)),
            ),
        ).fetchone()
        connection.execute(
            "INSERT INTO habit_schedules (habit_id,schedule_type,schedule_config) VALUES (%s,%s,%s::jsonb)",
            (habit["id"], schedule_type, __import__("json").dumps(schedule_config)),
        )
    return {"item": habit}


@router.patch("/{habit_id}")
def update_habit(habit_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    current = fetch_one("SELECT * FROM habits WHERE id=%s AND user_id=%s AND archived_at IS NULL", (habit_id, user["id"]))
    if not current:
        raise HTTPException(status_code=404, detail="Habit not found.")
    name = str(payload.get("name", current["name"])).strip()
    if not name or len(name) > 120:
        raise HTTPException(status_code=422, detail="Habit name is required (maximum 120 characters).")
    duplicate = fetch_one("SELECT id FROM habits WHERE user_id=%s AND lower(name)=lower(%s) AND id<>%s AND archived_at IS NULL", (user["id"], name, habit_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="A habit with this name already exists.")
    allowed = {
        "name", "description", "question", "habit_type", "measurement_type",
        "target_value", "target_type", "unit", "timezone", "reminder_config",
        "frequency_config", "color", "daily_note_required",
    }
    values = {key: payload[key] for key in allowed if key in payload}
    values["name"] = name
    assignments = ",".join(f"{key}=%s" for key in values)
    updated = fetch_one(f"UPDATE habits SET {assignments},updated_at=now() WHERE id=%s AND user_id=%s RETURNING *", (*values.values(), habit_id, user["id"]))
    return {"item": updated}


@router.get("/streaks/overview")
def streak_overview(user: dict = Depends(get_current_user)) -> dict:
    timezone_row = fetch_one(
        "SELECT COALESCE(timezone,'Asia/Kolkata') AS timezone FROM users WHERE id=%s",
        (user["id"],),
    )
    timezone = timezone_row["timezone"] if timezone_row else "Asia/Kolkata"
    today = __import__("app.services.streaks", fromlist=["local_today"]).local_today(timezone)
    habits = fetch_all(
        "SELECT h.*, s.schedule_type,s.schedule_config FROM habits h "
        "LEFT JOIN LATERAL (SELECT schedule_type,schedule_config FROM habit_schedules "
        "WHERE habit_id=h.id ORDER BY effective_from DESC LIMIT 1) s ON true "
        "WHERE h.user_id=%s AND h.archived_at IS NULL",
        (user["id"],),
    )
    individual = []
    combined_length = 0
    for habit in habits:
        entries = fetch_all(
            "SELECT entry_date,status,note,value FROM habit_entries "
            "WHERE habit_id=%s ORDER BY entry_date DESC LIMIT 366",
            (habit["id"],),
        )
        result = calculate_habit_streak(
            entries,
            habit.get("schedule_type") or "daily",
            habit.get("schedule_config") or {},
            timezone,
            today,
        )
        individual.append({
            "habit_id": habit["id"],
            "name": habit["name"],
            "current": result["current"],
            "start": result["start"],
            "last_update": result["last_update"],
            "break_date": result["break_date"],
        })

    cursor = today
    combined_length = 0
    while cursor >= today - timedelta(days=366):
        day_tasks = fetch_all(
            "SELECT status FROM tasks WHERE user_id=%s AND deleted_at IS NULL "
            "AND (due_at AT TIME ZONE %s)::date=%s",
            (user["id"], timezone, cursor),
        )
        if not day_tasks:
            cursor -= timedelta(days=1)
            continue
        if all(task["status"] in {"completed", "cancelled"} for task in day_tasks):
            combined_length += 1
        else:
            break
        cursor -= timedelta(days=1)

    events = fetch_all(
        "SELECT habit_id,event_type,event_date,streak_length,reason,created_at "
        "FROM streak_events WHERE user_id=%s ORDER BY event_date DESC LIMIT 100",
        (user["id"],),
    )
    return {
        "timezone": timezone,
        "today": str(today),
        "combined": {"current": combined_length, "last_update": str(today)},
        "habits": individual,
        "events": events,
        "longest": max([item["current"] for item in individual] or [combined_length]),
    }


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
    habit = fetch_one("SELECT * FROM habits WHERE id=%s AND user_id=%s", (habit_id, user["id"]))
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found.")
    status = payload["status"]
    if status == "skipped" and not str(payload.get("note", "")).strip():
        raise HTTPException(status_code=422, detail="A skip requires a note.")
    if status == "completed" and habit["measurement_type"] in {"quantity", "duration"}:
        status = measurable_status(
            payload.get("value"),
            float(habit["target_value"]) if habit["target_value"] is not None else None,
            habit["target_type"],
        )
        if status == "missed":
            status = "failed"
    entry = fetch_one(
        "INSERT INTO habit_entries (habit_id,entry_date,status,value,note) VALUES (%s,%s,%s,%s,%s) "
        "ON CONFLICT (habit_id,entry_date) DO UPDATE SET status=EXCLUDED.status,value=EXCLUDED.value,"
        "note=EXCLUDED.note,updated_at=now() RETURNING *",
        (habit_id, entry_date, status, payload.get("value"), payload.get("note", "")),
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
