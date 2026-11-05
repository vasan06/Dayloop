from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def get_projects(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT p.*, COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS task_count "
            "FROM projects p LEFT JOIN tasks t ON t.project_id=p.id "
            "WHERE p.user_id=%s AND p.archived_at IS NULL GROUP BY p.id "
            "ORDER BY p.updated_at DESC",
            (user["id"],),
        )
    }


@router.post("", status_code=201)
def post_project(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    name = str(payload.get("name", "")).strip()
    if not name or len(name) > 120:
        raise HTTPException(
            status_code=422, detail="Project name is required (maximum 120 characters)."
        )
    if payload.get("status", "active") not in {"active", "on_hold", "completed"}:
        raise HTTPException(status_code=422, detail="Unsupported project status.")
    project = fetch_one(
        "INSERT INTO projects (user_id,name,description,color,status) VALUES (%s,%s,%s,%s,%s) RETURNING *",
        (
            user["id"],
            name,
            payload.get("description", ""),
            payload.get("color", "persimmon"),
            payload.get("status", "active"),
        ),
    )
    return {"item": project}


@router.patch("/{project_id}")
def patch_project(project_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    allowed = {"name", "description", "color", "status", "start_date", "due_date"}
    changes = {key: value for key, value in payload.items() if key in allowed}
    if not changes:
        raise HTTPException(status_code=422, detail="No supported project fields were supplied.")
    if "name" in changes and (not str(changes["name"]).strip() or len(str(changes["name"])) > 120):
        raise HTTPException(status_code=422, detail="Project name must contain 1–120 characters.")
    if "status" in changes and changes["status"] not in {"active", "on_hold", "completed"}:
        raise HTTPException(status_code=422, detail="Unsupported project status.")
    assignments = ", ".join(f"{key}=%s" for key in changes)
    project = fetch_one(
        f"UPDATE projects SET {assignments}, updated_at=now() WHERE id=%s AND user_id=%s "
        "AND archived_at IS NULL RETURNING *",
        tuple(changes.values()) + (project_id, user["id"]),
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"item": project}


@router.delete("/{project_id}", status_code=204)
def archive_project(project_id: str, user: dict = Depends(get_current_user)) -> Response:
    project = fetch_one(
        "UPDATE projects SET archived_at=now(), updated_at=now() "
        "WHERE id=%s AND user_id=%s AND archived_at IS NULL RETURNING id",
        (project_id, user["id"]),
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return Response(status_code=204)
