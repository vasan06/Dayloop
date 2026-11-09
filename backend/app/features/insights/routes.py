from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("/overview")
def get_overview(
    days: int = Query(default=30, ge=7, le=180), user: dict = Depends(get_current_user)
) -> dict:
    """Daily activity series and headline counters that power the dashboard and analytics."""
    owner = user["id"]
    timezone = (
        fetch_one("SELECT COALESCE(timezone,'Asia/Kolkata') AS tz FROM users WHERE id=%s", (owner,))
        or {"tz": "Asia/Kolkata"}
    )["tz"]
    series = fetch_all(
        "WITH d AS (SELECT (now() AT TIME ZONE %(tz)s)::date - g AS day "
        "FROM generate_series(%(days)s - 1, 0, -1) AS g) "
        "SELECT d.day, "
        "(SELECT COUNT(*) FROM tasks t WHERE t.user_id=%(u)s AND t.deleted_at IS NULL "
        " AND (t.completed_at AT TIME ZONE %(tz)s)::date = d.day) AS tasks_completed, "
        "(SELECT COUNT(*) FROM tasks t WHERE t.user_id=%(u)s AND t.deleted_at IS NULL "
        " AND (t.created_at AT TIME ZONE %(tz)s)::date = d.day) AS tasks_created, "
        "(SELECT COUNT(*) FROM habit_entries e JOIN habits h ON h.id=e.habit_id "
        " WHERE h.user_id=%(u)s AND e.status='completed' AND e.entry_date = d.day) AS habits_done, "
        "COALESCE((SELECT SUM(amount) FROM finance_transactions f WHERE f.user_id=%(u)s "
        " AND f.voided_at IS NULL AND f.transaction_type='income' AND f.transaction_date = d.day),0) AS income, "
        "COALESCE((SELECT SUM(amount) FROM finance_transactions f WHERE f.user_id=%(u)s "
        " AND f.voided_at IS NULL AND f.transaction_type='expense' AND f.transaction_date = d.day),0) AS expenses "
        "FROM d ORDER BY d.day",
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
