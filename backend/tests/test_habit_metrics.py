from datetime import date

from app.features.habits.metrics import calculate_habit_metrics


def test_daily_habit_streak_uses_completed_days():
    habit = {"timezone": "Asia/Kolkata", "schedule_type": "daily", "schedule_config": {}}
    entries = [
        {"entry_date": date(2026, 11, 4), "status": "completed"},
        {"entry_date": date(2026, 11, 3), "status": "completed"},
    ]
    metrics = calculate_habit_metrics(habit, entries, date(2026, 11, 5))
    assert metrics["current_streak"] == 2
    assert metrics["completed_today"] is False


def test_habit_skip_does_not_break_streak():
    habit = {"timezone": "Asia/Kolkata", "schedule_type": "daily", "schedule_config": {}}
    entries = [
        {"entry_date": date(2026, 11, 4), "status": "skipped"},
        {"entry_date": date(2026, 11, 3), "status": "completed"},
    ]
    metrics = calculate_habit_metrics(habit, entries, date(2026, 11, 5))
    assert metrics["current_streak"] == 1


def test_weekly_habit_counts_only_selected_weekdays():
    habit = {
        "timezone": "Asia/Kolkata",
        "schedule_type": "weekly",
        "schedule_config": {"weekdays": [0, 2, 4]},
    }
    entries = [
        {"entry_date": date(2026, 11, 4), "status": "completed"},
        {"entry_date": date(2026, 11, 2), "status": "completed"},
    ]
    metrics = calculate_habit_metrics(habit, entries, date(2026, 11, 5))
    assert metrics["current_streak"] == 2
    assert metrics["scheduled_days_30d"] == 13
