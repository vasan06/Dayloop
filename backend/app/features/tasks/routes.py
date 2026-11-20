from fastapi import APIRouter, Depends, HTTPException, Response

from app.core.auth import get_current_user
from app.core.database import fetch_one
from app.features.tasks.service import (
    create_task,
    delete_task,
    list_subtasks,
    list_tasks,
    set_task_dependencies,
    update_task,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("")
def get_tasks(
    project_id: str | None = None, status: str | None = None, user: dict = Depends(get_current_user)
) -> dict:
    return {"items": list_tasks(user["id"], project_id, status)}


@router.post("", status_code=201)
def post_task(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    return {"item": create_task(user["id"], payload)}


@router.get("/{task_id}/subtasks")
def get_subtasks(task_id: str, user: dict = Depends(get_current_user)) -> dict:
    return {"items": list_subtasks(user["id"], task_id)}


@router.post("/{task_id}/subtasks", status_code=201)
def post_subtask(task_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    child_payload = {**payload, "parent_task_id": task_id}
    return {"item": create_task(user["id"], child_payload)}


@router.patch("/{task_id}")
def patch_task(task_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    return {"item": update_task(user["id"], task_id, payload)}


@router.delete("/{task_id}", status_code=204)
def remove_task(task_id: str, user: dict = Depends(get_current_user)) -> Response:
    delete_task(user["id"], task_id)
    return Response(status_code=204)


@router.put("/{task_id}/dependencies")
def put_dependencies(task_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    return {"items": set_task_dependencies(user["id"], task_id, payload.get("depends_on", []))}


@router.get("/{task_id}/notes")
def get_task_notes(task_id: str, user: dict = Depends(get_current_user)) -> dict:
    task = fetch_one(
        "SELECT id FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (task_id, user["id"]),
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    note = fetch_one(
        "SELECT blocks,updated_at FROM task_notes WHERE task_id=%s AND user_id=%s",
        (task_id, user["id"]),
    )
    return {"items": note["blocks"] if note else [], "updated_at": note["updated_at"] if note else None}


@router.put("/{task_id}/notes")
def save_task_notes(task_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    task = fetch_one(
        "SELECT id FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (task_id, user["id"]),
    )
    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")
    blocks = payload.get("blocks")
    if not isinstance(blocks, list) or len(blocks) > 1000:
        raise HTTPException(status_code=422, detail="Task notes must contain at most 1000 blocks.")
    import json
    note = fetch_one(
        "INSERT INTO task_notes(task_id,user_id,blocks) VALUES (%s,%s,%s::jsonb) "
        "ON CONFLICT (task_id,user_id) DO UPDATE SET blocks=EXCLUDED.blocks,updated_at=now() "
        "RETURNING blocks,updated_at",
        (task_id, user["id"], json.dumps(blocks)),
    )
    return {"items": note["blocks"], "updated_at": note["updated_at"]}
