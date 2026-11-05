from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user
from app.core.database import fetch_all

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search_workspace(
    q: str = Query(min_length=2, max_length=100), user: dict = Depends(get_current_user)
) -> dict:
    term = "%" + q.strip().replace("%", "\\%").replace("_", "\\_") + "%"
    if len(q.strip()) < 2:
        raise HTTPException(status_code=422, detail="Search requires at least two characters.")
    results = fetch_all(
        "SELECT 'task' AS entity_type,id,title,status AS detail FROM tasks "
        "WHERE user_id=%s AND deleted_at IS NULL AND title ILIKE %s "
        "UNION ALL SELECT 'project',id,name,status FROM projects "
        "WHERE user_id=%s AND archived_at IS NULL AND name ILIKE %s "
        "UNION ALL SELECT 'note',id,title,'page' FROM note_pages "
        "WHERE user_id=%s AND deleted_at IS NULL AND title ILIKE %s "
        "UNION ALL SELECT 'habit',id,name,habit_type FROM habits "
        "WHERE user_id=%s AND archived_at IS NULL AND name ILIKE %s "
        "UNION ALL SELECT 'goal',id,title,status FROM goals "
        "WHERE user_id=%s AND title ILIKE %s "
        "ORDER BY title LIMIT 50",
        (user["id"], term, user["id"], term, user["id"], term, user["id"], term, user["id"], term),
    )
    return {"query": q, "items": results}
