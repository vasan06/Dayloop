from fastapi import APIRouter, Depends, Response

from app.core.auth import get_current_user
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
