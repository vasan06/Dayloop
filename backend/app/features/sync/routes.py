from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/changes")
def get_changes(
    after: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    user: dict = Depends(get_current_user),
) -> dict:
    """Only the authenticated account's committed PostgreSQL changes."""
    rows = fetch_all(
        "SELECT sequence,entity,record_key,action,changed_at "
        "FROM sync_change_log WHERE user_id=%s AND sequence>%s "
        "ORDER BY sequence ASC LIMIT %s",
        (user["id"], after, limit + 1),
    )
    has_more = len(rows) > limit
    items = rows[:limit]
    return {
        "items": items,
        "next_cursor": items[-1]["sequence"] if items else after,
        "has_more": has_more,
    }


@router.get("/cursor")
def get_cursor(user: dict = Depends(get_current_user)) -> dict:
    row = fetch_one(
        "SELECT COALESCE(MAX(sequence),0) AS cursor FROM sync_change_log WHERE user_id=%s",
        (user["id"],),
    )
    return {"cursor": int(row["cursor"]) if row else 0}
