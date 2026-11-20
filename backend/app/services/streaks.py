from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def local_today(timezone: str) -> date:
    try:
        zone = ZoneInfo(timezone)
    except Exception:
        zone = ZoneInfo("Asia/Kolkata")
    return datetime.now(zone).date()


def habit_is_scheduled(day: date, schedule_type: str, schedule_config: dict) -> bool:
    if schedule_type == "daily":
        return True
    if schedule_type == "weekly":
        weekdays = schedule_config.get("weekdays", [])
        return day.weekday() in weekdays
    if schedule_type == "custom":
        weekdays = schedule_config.get("weekdays")
        if weekdays:
            return day.weekday() in weekdays
    return False


def measurable_status(value: float | None, target: float | None, target_type: str) -> str:
    if value is None:
        return "missed"
    if target is None:
        return "completed"
    if target_type == "at_most":
        return "completed" if value <= target else "failed"
    return "completed" if value >= target else "failed"


def calculate_habit_streak(
    entries: list[dict],
    schedule_type: str,
    schedule_config: dict,
    timezone: str,
    today: date | None = None,
) -> dict:
    current_day = today or local_today(timezone)
    by_date = {entry["entry_date"]: entry for entry in entries}
    cursor = current_day
    length = 0
    start = None
    break_date = None

    while cursor >= current_day - timedelta(days=366):
        if habit_is_scheduled(cursor, schedule_type, schedule_config):
            entry = by_date.get(cursor)
            status = entry["status"] if entry else None
            if status == "completed":
                length += 1
                start = cursor
            elif status == "skipped":
                cursor -= timedelta(days=1)
                continue
            else:
                if status in {"failed", "missed"}:
                    break_date = cursor
                break
        cursor -= timedelta(days=1)

    return {
        "current": length,
        "start": str(start) if start else None,
        "last_update": str(current_day),
        "break_date": str(break_date) if break_date else None,
    }
