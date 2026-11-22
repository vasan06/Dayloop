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
        WITH days AS (
            SELECT (now() AT TIME ZONE %(tz)s)::date - g AS day
            FROM generate_series(%(days)s - 1, 0, -1) AS g
        )
        SELECT d.day, completed.n AS tasks_completed, created.n AS tasks_created,
               habits.n AS habits_done, projects.n AS projects_created, events.n AS events_count, notes.n AS notes_created,
               COALESCE(income.total, 0) AS income, COALESCE(expenses.total, 0) AS expenses,
               completed.example AS completed_task, created.example AS created_task, habits.example AS completed_habit,
               projects.example AS created_project, events.example AS scheduled_event, notes.example AS created_note,
               income.largest AS largest_income, income.description AS income_description,
               expenses.largest AS largest_expense, expenses.description AS expense_description
        FROM days d
        CROSS JOIN LATERAL (
            SELECT count(*) AS n, min(t.title) AS example FROM tasks t
            WHERE t.user_id=%(u)s AND t.deleted_at IS NULL AND (t.completed_at AT TIME ZONE %(tz)s)::date = d.day
        ) completed
        CROSS JOIN LATERAL (
            SELECT count(*) AS n, min(t.title) AS example FROM tasks t
            WHERE t.user_id=%(u)s AND t.deleted_at IS NULL AND (t.created_at AT TIME ZONE %(tz)s)::date = d.day
        ) created
        CROSS JOIN LATERAL (
            SELECT count(*) AS n, min(h.name) AS example FROM habit_entries e JOIN habits h ON h.id=e.habit_id
            WHERE h.user_id=%(u)s AND e.status='completed' AND e.entry_date = d.day
        ) habits
        CROSS JOIN LATERAL (
            SELECT count(*) AS n, min(p.name) AS example FROM projects p
            WHERE p.user_id=%(u)s AND p.archived_at IS NULL AND (p.created_at AT TIME ZONE %(tz)s)::date = d.day
        ) projects
        CROSS JOIN LATERAL (
            SELECT count(*) AS n, min(c.title) AS example FROM calendar_events c
            WHERE c.user_id=%(u)s AND (c.start_at AT TIME ZONE %(tz)s)::date = d.day
        ) events
        CROSS JOIN LATERAL (
            SELECT count(*) AS n, min(n.title) AS example FROM note_pages n
            WHERE n.user_id=%(u)s AND n.deleted_at IS NULL AND (n.created_at AT TIME ZONE %(tz)s)::date = d.day
        ) notes
        CROSS JOIN LATERAL (
            SELECT sum(f.amount) AS total, max(f.amount) AS largest,
                   (array_agg(f.description ORDER BY f.amount DESC, f.id))[1] AS description
            FROM finance_transactions f WHERE f.user_id=%(u)s AND f.currency='INR'
            AND f.voided_at IS NULL AND f.transaction_type='income' AND f.transaction_date = d.day
        ) income
        CROSS JOIN LATERAL (
            SELECT sum(f.amount) AS total, max(f.amount) AS largest,
                   (array_agg(f.description ORDER BY f.amount DESC, f.id))[1] AS description
            FROM finance_transactions f WHERE f.user_id=%(u)s AND f.currency='INR'
            AND f.voided_at IS NULL AND f.transaction_type='expense' AND f.transaction_date = d.day
        ) expenses
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
