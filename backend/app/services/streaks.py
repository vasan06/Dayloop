from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException

DEFAULT_TIMEZONE = "Asia/Kolkata"
DAY = timedelta(days=1)


def validate_timezone(value: object) -> str:
    try:
        if not isinstance(value, str):
            raise ValueError
        ZoneInfo(value)
    except (ValueError, ZoneInfoNotFoundError) as error:
        raise HTTPException(422, "Choose a valid IANA timezone.") from error
    return value


def timezone_for_stored_value(value: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(value or DEFAULT_TIMEZONE)
    except (ValueError, ZoneInfoNotFoundError):
        # Older profiles and habits accepted free-form timezone names.
        return ZoneInfo(DEFAULT_TIMEZONE)


def local_today(timezone: str) -> date:
    return datetime.now(timezone_for_stored_value(timezone)).date()


def habit_is_scheduled(day: date, schedule_type: str, schedule_config: dict) -> bool:
    if schedule_type == "daily":
        return True
    weekdays = schedule_config.get("weekdays") if isinstance(schedule_config, dict) else None
    return isinstance(weekdays, list) and day.weekday() in weekdays


def measurable_status(value: float | None, target: float | None, target_type: str) -> str:
    if value is None:
        return "missed"
    if target is None:
        return "completed"
    if target_type == "at_most":
        return "completed" if value <= target else "failed"
    return "completed" if value >= target else "failed"


def streak_history(entries: list[dict], schedule_type: str, schedule_config: dict, today: date) -> dict:
    by_date = {e["entry_date"]: e["status"] for e in entries if e["entry_date"] <= today}
    current = []
    previous = []
    longest = 0
    last_break = None
    events = []
    day = min(by_date, default=today)
    while day <= today:
        status = by_date.get(day)
        if habit_is_scheduled(day, schedule_type, schedule_config):
            event = None
            if status == "completed":
                event = "continued" if current else ("resumed" if previous else "started")
                current.append(day)
                longest = max(longest, len(current))
            elif status == "skipped":
                event = status
            elif status or day < today:
                if current:
                    previous, current = current, []
                last_break = day
                if status or (previous and previous[-1] == day - DAY):
                    event = status or "missed"
            if event:
                events.append({"event_type": event, "event_date": day, "streak_length": len(current)})
        day += DAY
    return {"current": current, "previous": previous, "longest": longest, "last_break": last_break, "events": events}


def calculate_habit_streak(entries: list[dict], schedule_type: str, schedule_config: dict, timezone: str, today: date | None = None) -> dict:
    today = today or local_today(timezone)
    history = streak_history(entries, schedule_type, schedule_config, today)
    current = history["current"]
    return {
        "current": len(current),
        "start": str(current[0]) if current else None,
        "last_update": str(today),
        "break_date": str(history["last_break"]) if history["last_break"] else None,
    }
