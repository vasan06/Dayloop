from datetime import date

from app.services.streaks import calculate_habit_streak, habit_is_scheduled, measurable_status


def test_at_least_passes_and_fails():
    assert measurable_status(20, 20, "at_least") == "completed"
    assert measurable_status(19, 20, "at_least") == "failed"


def test_at_most_passes_and_fails():
    assert measurable_status(20, 20, "at_most") == "completed"
    assert measurable_status(21, 20, "at_most") == "failed"


def test_skip_does_not_break_streak():
    entries = [
        {"entry_date": date(2026, 11, 20), "status": "skipped"},
        {"entry_date": date(2026, 11, 19), "status": "completed"},
    ]
    result = calculate_habit_streak(entries, "daily", {}, "UTC", date(2026, 11, 20))
    assert result["current"] == 1


def test_failure_resets_to_one():
    entries = [
        {"entry_date": date(2026, 11, 20), "status": "completed"},
    ]
    result = calculate_habit_streak(entries, "daily", {}, "UTC", date(2026, 11, 20))
    assert result["current"] == 1


def test_scheduled_weekday():
    assert habit_is_scheduled(date(2026, 11, 22), "weekly", {"weekdays": [6]})
    assert not habit_is_scheduled(date(2026, 11, 23), "weekly", {"weekdays": [6]})

def test_scheduled_streak_uses_actual_dates_and_distinct_previous_run():
    from app.features.habits.metrics import calculate_habit_metrics
    habit = {"timezone": "UTC", "schedule_type": "weekly", "schedule_config": {"weekdays": [0, 4]}}
    entries = [{"entry_date": date(2026, 11, day), "status": status} for day, status in [
        (2, "completed"), (6, "failed"), (9, "completed"), (13, "skipped"), (16, "completed")
    ]]
    today = date(2026, 11, 20)
    metrics = calculate_habit_metrics(habit, entries, today)
    assert metrics["current_streak"] == 2
    assert str(metrics["current_streak_start"]) == "2026-11-09"
    assert str(metrics["current_streak_end"]) == "2026-11-16"
    assert metrics["previous_streak_days"] == 1
    assert str(metrics["previous_streak_end"]) == "2026-11-02"
    assert calculate_habit_streak(entries, "weekly", habit["schedule_config"], "UTC", today)["current"] == 2


def test_explicit_failure_today_breaks_streak():
    from app.features.habits.metrics import calculate_habit_metrics
    entries = [{"entry_date": date(2026, 11, day), "status": status} for day, status in [(19, "completed"), (20, "failed")]]
    assert calculate_habit_metrics({"timezone": "UTC"}, entries, date(2026, 11, 20))["current_streak"] == 0
