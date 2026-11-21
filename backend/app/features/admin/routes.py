from fastapi import APIRouter, Header, HTTPException

from app.core.config import get_settings
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(x_dayloop_admin_key: str | None = Header(default=None)) -> None:
    expected = get_settings().get("admin_key", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Admin access is not configured.")
    if x_dayloop_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key.")


@router.get("/overview")
def overview(_: None = Header(default=None, alias="X-Ignored"), x_dayloop_admin_key: str | None = Header(default=None)) -> dict:
    require_admin(x_dayloop_admin_key)
    counts = fetch_one(
        "SELECT "
        "(SELECT COUNT(*) FROM users) AS users,"
        "(SELECT COUNT(*) FROM users WHERE last_seen_at > now()-interval '15 minutes') AS active_sessions,"
        "(SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL) AS tasks,"
        "(SELECT COUNT(*) FROM habits WHERE archived_at IS NULL) AS habits,"
        "(SELECT COUNT(*) FROM projects WHERE archived_at IS NULL) AS projects,"
        "(SELECT COUNT(*) FROM note_pages WHERE deleted_at IS NULL) AS notes,"
        "(SELECT COUNT(*) FROM user_feedback) AS feedback"
    )
    creations = fetch_all(
        "SELECT day::date, COALESCE(COUNT(u.id),0) AS users FROM generate_series(current_date-13,current_date,interval '1 day') day "
        "LEFT JOIN users u ON u.created_at::date=day::date GROUP BY day ORDER BY day"
    )
    activity = fetch_all(
        "SELECT day::date, COALESCE(COUNT(t.id),0) AS tasks FROM generate_series(current_date-13,current_date,interval '1 day') day "
        "LEFT JOIN tasks t ON t.created_at::date=day::date GROUP BY day ORDER BY day"
    )
    return {"counts": counts, "user_creations": creations, "task_creations": activity}


@router.get("/users")
def users(x_dayloop_admin_key: str | None = Header(default=None)) -> dict:
    require_admin(x_dayloop_admin_key)
    items = fetch_all(
        "SELECT u.id,u.created_at,u.last_seen_at,u.admin_disabled,"
        "(SELECT COUNT(*) FROM tasks t WHERE t.user_id=u.id) AS tasks_created,"
        "(SELECT COUNT(*) FROM tasks t WHERE t.user_id=u.id AND t.deleted_at IS NOT NULL) AS tasks_deleted,"
        "(SELECT COUNT(*) FROM habits h WHERE h.user_id=u.id) AS habits_created,"
        "(SELECT COUNT(*) FROM habits h WHERE h.user_id=u.id AND h.archived_at IS NOT NULL) AS habits_archived,"
        "(SELECT COUNT(*) FROM projects p WHERE p.user_id=u.id) AS projects_created,"
        "(SELECT COUNT(*) FROM projects p WHERE p.user_id=u.id AND p.archived_at IS NOT NULL) AS projects_archived,"
        "(SELECT COUNT(*) FROM note_pages n WHERE n.user_id=u.id) AS notes_created,"
        "(SELECT COUNT(*) FROM note_pages n WHERE n.user_id=u.id AND n.deleted_at IS NOT NULL) AS notes_deleted "
        "FROM users u ORDER BY u.created_at DESC LIMIT 250"
    )
    return {"items": items}


@router.patch("/users/{user_id}")
def update_user(user_id: str, payload: dict, x_dayloop_admin_key: str | None = Header(default=None)) -> dict:
    require_admin(x_dayloop_admin_key)
    allowed_roles = {"school_student","student","working","freelancer","entrepreneur","organization","educator","other"}
    updates = []
    params = []
    if "admin_disabled" in payload:
        updates.append("admin_disabled=%s")
        params.append(bool(payload["admin_disabled"]))
    if "role" in payload:
        role = str(payload["role"])
        if role not in allowed_roles:
            raise HTTPException(status_code=422, detail="Unsupported role.")
        updates.append("role=%s")
        params.append(role)
    if not updates:
        raise HTTPException(status_code=422, detail="No supported user fields supplied.")
    params.append(user_id)
    item = fetch_one(
        f"UPDATE users SET {','.join(updates)},updated_at=now() WHERE id=%s RETURNING id,admin_disabled,last_seen_at",
        tuple(params),
    )
    if not item:
        raise HTTPException(status_code=404, detail="User not found.")
    fetch_one(
        "INSERT INTO admin_audit_log(action,target_type,target_id,detail) VALUES ('update','user',%s,%s::jsonb) RETURNING id",
        (user_id, __import__("json").dumps(payload)),
    )
    return {"item": item}


@router.get("/feedback")
def feedback(x_dayloop_admin_key: str | None = Header(default=None)) -> dict:
    require_admin(x_dayloop_admin_key)
    return {"items": fetch_all(
        "SELECT f.id,f.message,f.page,f.created_at FROM user_feedback f "
        "ORDER BY f.created_at DESC LIMIT 250"
    )}


@router.delete("/feedback/{feedback_id}", status_code=204)
def delete_feedback(feedback_id: str, x_dayloop_admin_key: str | None = Header(default=None)):
    require_admin(x_dayloop_admin_key)
    fetch_one("DELETE FROM user_feedback WHERE id=%s RETURNING id", (feedback_id,))
    fetch_one(
        "INSERT INTO admin_audit_log(action,target_type,target_id) VALUES ('delete','feedback',%s) RETURNING id",
        (feedback_id,),
    )
    return None


@router.get("/audit")
def audit(x_dayloop_admin_key: str | None = Header(default=None)) -> dict:
    require_admin(x_dayloop_admin_key)
    return {"items": fetch_all("SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 250")}
