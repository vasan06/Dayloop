from datetime import date, timedelta

from app.services.streaks import habit_is_scheduled, local_today, streak_history, timezone_for_stored_value


def habit_start_date(habit: dict, fallback: date) -> date:
    created = habit.get("created_at")
    return created.astimezone(timezone_for_stored_value(habit.get("timezone"))).date() if created else fallback


def calculate_habit_metrics(habit: dict, entries: list[dict], today: date | None = None) -> dict:
    today = today or local_today(habit.get("timezone"))
    schedule = habit.get("schedule_type") or "daily"
    config = habit.get("schedule_config") or {}
    history = streak_history(entries, schedule, config, today)
    current = history["current"]
    previous = history["previous"]
    by_date = {entry["entry_date"]: entry["status"] for entry in entries}
    start = habit_start_date(habit, today - timedelta(days=29))
    days = [today - timedelta(days=offset) for offset in range(30)]
    eligible = [d for d in days if (d >= start or d in by_date) and habit_is_scheduled(d, schedule, config) and by_date.get(d) != "skipped"]
    completed_days = sum(by_date.get(d) == "completed" for d in eligible)
    return {
        "current_streak": len(current),
        "completed_today": by_date.get(today) == "completed",
        "current_streak_start": current[0] if current else None,
        "current_streak_end": current[-1] if current else None,
        "previous_streak_start": previous[0] if previous else None,
        "previous_streak_end": previous[-1] if previous else None,
        "previous_streak_days": len(previous),
        "last_break_date": history["last_break"],
        "consistency_30d": round(100 * completed_days / len(eligible)) if eligible else 0,
        "scheduled_days_30d": len(eligible),
    }
