from __future__ import annotations

import calendar
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo


def _clock(config: dict) -> time:
    raw = str(config.get("time") or "09:00")
    try:
        hour, minute = (int(part) for part in raw.split(":", 1))
        return time(hour=max(0, min(hour, 23)), minute=max(0, min(minute, 59)))
    except (TypeError, ValueError):
        return time(9, 0)


def _monthly_days(config: dict, fallback: list[int]) -> list[int]:
    raw = config.get("days")
    if not isinstance(raw, list):
        raw = [config.get("day")] if config.get("day") is not None else fallback
    days = sorted({int(day) for day in raw if str(day).isdigit() and 1 <= int(day) <= 31})
    return days or fallback


def next_habit_reminder(config: dict | None, timezone_name: str, after: datetime | None = None) -> datetime | None:
    config = config if isinstance(config, dict) else {}
    kind = str(config.get("type") or "none")
    if kind == "none":
        return None
    try:
        zone = ZoneInfo(timezone_name)
    except Exception:
        zone = ZoneInfo("Asia/Kolkata")
    now = after.astimezone(zone) if after and after.tzinfo else datetime.now(zone)
    clock = _clock(config)

    def at(day: date) -> datetime:
        return datetime.combine(day, clock, tzinfo=zone)

    if kind == "daily":
        candidate = at(now.date())
        return candidate if candidate > now else at(now.date() + timedelta(days=1))

    if kind == "custom":
        raw = config.get("weekdays")
        weekdays = sorted({int(day) for day in raw if isinstance(day, int) and 0 <= day <= 6}) if isinstance(raw, list) else []
        if not weekdays:
            return None
        for offset in range(0, 15):
            day = now.date() + timedelta(days=offset)
            candidate = at(day)
            if day.weekday() in weekdays and candidate > now:
                return candidate
        return None

    days = _monthly_days(config, [1] if kind == "monthly_once" else [1, 15])
    if kind not in {"monthly_once", "monthly_twice"}:
        return None
    year, month = now.year, now.month
    for _ in range(0, 14):
        last_day = calendar.monthrange(year, month)[1]
        for number in days:
            candidate = at(date(year, month, min(number, last_day)))
            if candidate > now:
                return candidate
        month += 1
        if month == 13:
            year += 1
            month = 1
    return None


def sync_habit_reminder(connection, user_id, habit: dict) -> datetime | None:
    connection.execute(
        "UPDATE notification_jobs SET status='cancelled' "
        "WHERE user_id=%s AND source_type='habit' AND source_id=%s AND status='pending'",
        (user_id, habit["id"]),
    )
    scheduled_at = next_habit_reminder(
        habit.get("reminder_config"),
        str(habit.get("timezone") or "Asia/Kolkata"),
    )
    if scheduled_at is None:
        return None
    body = str(habit.get("question") or habit.get("description") or "Time for your habit.")
    connection.execute(
        "INSERT INTO notification_jobs "
        "(user_id,title,body,source_type,source_id,channel,scheduled_at) "
        "VALUES (%s,%s,%s,'habit',%s,'in_app',%s)",
        (user_id, f"Habit reminder: {habit['name']}", body, habit["id"], scheduled_at),
    )
    return scheduled_at
