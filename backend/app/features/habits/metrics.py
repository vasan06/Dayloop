from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo


def habit_is_scheduled(day: date, schedule_type: str, schedule_config: dict) -> bool:
    if schedule_type == "daily":
        return True
    weekdays = schedule_config.get("weekdays", [])
    return day.weekday() in weekdays


def calculate_habit_metrics(habit: dict, entries: list[dict], today: date | None = None) -> dict:
    timezone = ZoneInfo(habit.get("timezone") or "Asia/Kolkata")
    local_today = today or datetime.now(timezone).date()
    schedule_type = habit.get("schedule_type") or "daily"
    schedule_config = habit.get("schedule_config") or {}
    by_date = {entry["entry_date"]: entry["status"] for entry in entries}
    completed_today = by_date.get(local_today) == "completed"
    cursor = local_today if completed_today else local_today - timedelta(days=1)
    current_streak = 0
    while cursor >= local_today - timedelta(days=365):
        if habit_is_scheduled(cursor, schedule_type, schedule_config):
            status = by_date.get(cursor)
            if status == "completed":
                current_streak += 1
            elif status == "skipped":
                pass
            else:
                break
        cursor -= timedelta(days=1)
    start_window = local_today - timedelta(days=29)
    scheduled_days = [
        start_window + timedelta(days=offset)
        for offset in range(30)
        if habit_is_scheduled(start_window + timedelta(days=offset), schedule_type, schedule_config)
    ]
    completed_days = sum(1 for day in scheduled_days if by_date.get(day) == "completed")
    return {
        "current_streak": current_streak,
        "completed_today": completed_today,
        "consistency_30d": round(completed_days / len(scheduled_days) * 100)
        if scheduled_days
        else 0,
        "scheduled_days_30d": len(scheduled_days),
    }
