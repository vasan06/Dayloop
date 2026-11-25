from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/changes")
def get_changes(
    after: int = Query(default=0, ge=0, le=9223372036854775807),
    limit: int = Query(default=200, ge=1, le=500),
    user: dict = Depends(get_current_user),
    after_tx: int | None = Query(default=None, ge=0, le=18446744073709551615),
    after_sequence: int = Query(default=0, ge=0, le=9223372036854775807),
) -> dict:
    """Only the authenticated account's committed PostgreSQL changes."""
    if after_tx is not None:
        return get_transaction_changes(user["id"], after_tx, after_sequence, limit)
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


def get_transaction_changes(user_id, after_tx: int, after_sequence: int, limit: int) -> dict:
    # A sequence can predate a transaction that commits first. Scan by
    # transaction ID and stop before the oldest still-open transaction.
    rows = fetch_all(
        "SELECT sequence,entity,record_key,action,changed_at,transaction_id::text AS transaction_id "
        "FROM sync_change_log WHERE user_id=%s "
        "AND (transaction_id,sequence)>(%s::xid8,%s::bigint) "
        "AND transaction_id<pg_snapshot_xmin(pg_current_snapshot()) "
        "ORDER BY transaction_id,sequence LIMIT %s",
        (user_id, str(after_tx), after_sequence, limit + 1),
    )
    items = rows[:limit]
    return {
        "items": items,
        "next_transaction": items[-1]["transaction_id"] if items else str(after_tx),
        "next_sequence": str(items[-1]["sequence"] if items else after_sequence),
        "has_more": len(rows) > limit,
    }


@router.get("/cursor")
def get_cursor(user: dict = Depends(get_current_user)) -> dict:
    row = fetch_one(
        "SELECT COALESCE(MAX(sequence),0) AS cursor FROM sync_change_log WHERE user_id=%s",
        (user["id"],),
    )
    return {"cursor": int(row["cursor"]) if row else 0}
