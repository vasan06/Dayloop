from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one
from app.services.streaks import timezone_for_stored_value

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/overview")
def get_overview(
    days: int = Query(default=30, ge=1, le=365), user: dict = Depends(get_current_user)
) -> dict:
    """Daily activity series and headline counters that power the dashboard and analytics."""
    owner = user["id"]
    timezone = (
        fetch_one("SELECT COALESCE(timezone,'Asia/Kolkata') AS tz FROM users WHERE id=%s", (owner,))
        or {"tz": "Asia/Kolkata"}
    )["tz"]
    timezone = timezone_for_stored_value(timezone).key
    series = fetch_all(
        """
        WITH date_range AS (
            SELECT (now() AT TIME ZONE %(tz)s)::date AS last_day
        ), bounds AS (
            SELECT last_day - (%(days)s - 1) AS first_day, last_day,
                   -- Use a padded UTC range for timestamp filtering. Grouping by
                   -- local date and joining to days below handles DST transitions.
                   ((last_day - %(days)s)::timestamp AT TIME ZONE 'UTC') AS start_utc,
                   ((last_day + 2)::timestamp AT TIME ZONE 'UTC') AS end_utc
            FROM date_range
        ), days AS (
            SELECT b.last_day - g AS day
            FROM bounds b CROSS JOIN generate_series(%(days)s - 1, 0, -1) AS g
        ), completed AS (
            SELECT (t.completed_at AT TIME ZONE %(tz)s)::date AS day, count(*) AS n, min(t.title) AS example
            FROM tasks t CROSS JOIN bounds b
            WHERE t.user_id=%(u)s AND t.deleted_at IS NULL
                AND t.completed_at >= b.start_utc AND t.completed_at < b.end_utc
            GROUP BY 1
        ), created AS (
            SELECT (t.created_at AT TIME ZONE %(tz)s)::date AS day, count(*) AS n, min(t.title) AS example
            FROM tasks t CROSS JOIN bounds b
            WHERE t.user_id=%(u)s AND t.deleted_at IS NULL
                AND t.created_at >= b.start_utc AND t.created_at < b.end_utc
            GROUP BY 1
        ), habits AS (
            SELECT e.entry_date AS day, count(*) AS n, min(h.name) AS example
            FROM habit_entries e JOIN habits h ON h.id=e.habit_id CROSS JOIN bounds b
            WHERE h.user_id=%(u)s AND e.status='completed' AND e.entry_date BETWEEN b.first_day AND b.last_day
            GROUP BY 1
        ), projects AS (
            SELECT (p.created_at AT TIME ZONE %(tz)s)::date AS day, count(*) AS n, min(p.name) AS example
            FROM projects p CROSS JOIN bounds b
            WHERE p.user_id=%(u)s AND p.archived_at IS NULL
                AND p.created_at >= b.start_utc AND p.created_at < b.end_utc
            GROUP BY 1
        ), events AS (
            SELECT (c.start_at AT TIME ZONE %(tz)s)::date AS day, count(*) AS n, min(c.title) AS example
            FROM calendar_events c CROSS JOIN bounds b
            WHERE c.user_id=%(u)s AND c.start_at >= b.start_utc AND c.start_at < b.end_utc
            GROUP BY 1
        ), notes AS (
            SELECT (n.created_at AT TIME ZONE %(tz)s)::date AS day, count(*) AS n, min(n.title) AS example
            FROM note_pages n CROSS JOIN bounds b
            WHERE n.user_id=%(u)s AND n.deleted_at IS NULL
                AND n.created_at >= b.start_utc AND n.created_at < b.end_utc
            GROUP BY 1
        ), finance AS (
            SELECT f.transaction_date AS day, f.transaction_type, sum(f.amount) AS total, max(f.amount) AS largest,
                   (array_agg(f.description ORDER BY f.amount DESC, f.id))[1] AS description
            FROM finance_transactions f CROSS JOIN bounds b
            WHERE f.user_id=%(u)s AND f.currency='INR' AND f.voided_at IS NULL
                AND f.transaction_date BETWEEN b.first_day AND b.last_day
            GROUP BY 1, 2
        )
        SELECT d.day, COALESCE(completed.n, 0) AS tasks_completed, COALESCE(created.n, 0) AS tasks_created,
               COALESCE(habits.n, 0) AS habits_done, COALESCE(projects.n, 0) AS projects_created,
               COALESCE(events.n, 0) AS events_count, COALESCE(notes.n, 0) AS notes_created,
               COALESCE(income.total, 0) AS income, COALESCE(expenses.total, 0) AS expenses,
               completed.example AS completed_task, created.example AS created_task, habits.example AS completed_habit,
               projects.example AS created_project, events.example AS scheduled_event, notes.example AS created_note,
               income.largest AS largest_income, income.description AS income_description,
               expenses.largest AS largest_expense, expenses.description AS expense_description
        FROM days d
        LEFT JOIN completed ON completed.day = d.day
        LEFT JOIN created ON created.day = d.day
        LEFT JOIN habits ON habits.day = d.day
        LEFT JOIN projects ON projects.day = d.day
        LEFT JOIN events ON events.day = d.day
        LEFT JOIN notes ON notes.day = d.day
        LEFT JOIN finance income ON income.day = d.day AND income.transaction_type = 'income'
        LEFT JOIN finance expenses ON expenses.day = d.day AND expenses.transaction_type = 'expense'
        ORDER BY d.day
        """,
        {"tz": timezone, "days": days, "u": owner},
    )
    totals = fetch_one(
        "SELECT "
        "COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')) AS open_tasks, "
        "COUNT(*) FILTER (WHERE status='completed') AS completed_tasks, "
        "COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled') AND due_at < now()) AS overdue_tasks "
        "FROM tasks WHERE user_id=%s AND deleted_at IS NULL",
        (owner,),
    )
    return {"days": days, "series": series, "totals": totals}
