from datetime import datetime
from zoneinfo import ZoneInfo

from app.features.habits.reminders import next_habit_reminder


ZONE = ZoneInfo("Asia/Kolkata")


def test_daily_reminder_uses_today_when_time_is_future():
    after = datetime(2026, 11, 21, 8, 30, tzinfo=ZONE)
    result = next_habit_reminder({"type": "daily", "time": "09:00"}, "Asia/Kolkata", after)
    assert result == datetime(2026, 11, 21, 9, 0, tzinfo=ZONE)


def test_daily_reminder_rolls_to_tomorrow_after_time_passes():
    after = datetime(2026, 11, 21, 10, 0, tzinfo=ZONE)
    result = next_habit_reminder({"type": "daily", "time": "09:00"}, "Asia/Kolkata", after)
    assert result == datetime(2026, 11, 22, 9, 0, tzinfo=ZONE)


def test_monthly_twice_uses_next_configured_day():
    after = datetime(2026, 11, 10, 10, 0, tzinfo=ZONE)
    result = next_habit_reminder(
        {"type": "monthly_twice", "time": "18:30", "days": [1, 15]},
        "Asia/Kolkata",
        after,
    )
    assert result == datetime(2026, 11, 15, 18, 30, tzinfo=ZONE)


def test_custom_weekdays_find_next_matching_day():
    after = datetime(2026, 11, 21, 10, 0, tzinfo=ZONE)  # Saturday
    result = next_habit_reminder(
        {"type": "custom", "time": "07:15", "weekdays": [0, 2]},
        "Asia/Kolkata",
        after,
    )
    assert result == datetime(2026, 11, 23, 7, 15, tzinfo=ZONE)


def test_none_disables_reminders():
    assert next_habit_reminder({"type": "none"}, "Asia/Kolkata") is None
