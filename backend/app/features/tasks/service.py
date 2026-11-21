from uuid import UUID

from fastapi import HTTPException

from app.core.database import fetch_all, fetch_one, get_connection

TASK_FIELDS = {
    "title",
    "description",
    "status",
    "priority",
    "due_at",
    "start_at",
    "project_id",
    "parent_task_id",
}


def validate_uuid(value: str | None, field_name: str) -> str | None:
    if value is None:
        return None
    try:
        return str(UUID(str(value)))
    except (ValueError, TypeError, AttributeError) as error:
        raise HTTPException(
            status_code=422, detail=f"{field_name} must be a valid UUID."
        ) from error


def list_tasks(
    user_id: str, project_id: str | None = None, status: str | None = None
) -> list[dict]:
    conditions = ["user_id = %s", "deleted_at IS NULL"]
    parameters: list = [user_id]
    if project_id:
        conditions.append("project_id = %s")
        parameters.append(validate_uuid(project_id, "project_id"))
    if status:
        conditions.append("status = %s")
        parameters.append(status)
    return fetch_all(
        f"SELECT id, project_id, parent_task_id, title, description, status, priority, "
        f"start_at, due_at, completed_at, created_at, updated_at FROM tasks "
        f"WHERE {' AND '.join(conditions)} ORDER BY position, created_at DESC",
        tuple(parameters),
    )


def create_task(user_id: str, payload: dict) -> dict:
    title = str(payload.get("title", "")).strip()
    if not title or len(title) > 240:
        raise HTTPException(
            status_code=422, detail="Task title is required (maximum 240 characters)."
        )
    if fetch_one("SELECT id FROM tasks WHERE user_id=%s AND lower(title)=lower(%s) AND deleted_at IS NULL", (user_id, title)):
        raise HTTPException(status_code=409, detail="A task with this name already exists. Use a different name.")
    project_id = validate_uuid(payload.get("project_id"), "project_id")
    parent_id = validate_uuid(payload.get("parent_task_id"), "parent_task_id")
    if payload.get("status", "not_started") not in {
        "inbox",
        "not_started",
        "in_progress",
        "waiting",
        "completed",
        "cancelled",
    }:
        raise HTTPException(status_code=422, detail="Unsupported task status.")
    if payload.get("priority", "normal") not in {"low", "normal", "high", "urgent"}:
        raise HTTPException(status_code=422, detail="Unsupported task priority.")
    if project_id and not fetch_one(
        "SELECT id FROM projects WHERE id=%s AND user_id=%s AND archived_at IS NULL",
        (project_id, user_id),
    ):
        raise HTTPException(status_code=404, detail="Project not found.")
    if parent_id and not fetch_one(
        "SELECT id FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (parent_id, user_id),
    ):
        raise HTTPException(status_code=404, detail="Parent task not found.")
    return fetch_one(
        "INSERT INTO tasks (user_id, project_id, parent_task_id, title, description, status, priority, start_at, due_at, completed_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,CASE WHEN %s THEN now() END) RETURNING *",
        (
            user_id,
            project_id,
            parent_id,
            title,
            payload.get("description", ""),
            payload.get("status", "not_started"),
            payload.get("priority", "normal"),
            payload.get("start_at"),
            payload.get("due_at"),
            payload.get("status") == "completed",
        ),
    )


def update_task(user_id: str, task_id: str, payload: dict) -> dict:
    task_id = validate_uuid(task_id, "task_id")
    changes = {key: value for key, value in payload.items() if key in TASK_FIELDS}
    if not changes:
        raise HTTPException(status_code=422, detail="No supported task fields were supplied.")
    if "title" in changes and (
        not str(changes["title"]).strip() or len(str(changes["title"])) > 240
    ):
        raise HTTPException(status_code=422, detail="Task title must contain 1–240 characters.")
    if "status" in changes and changes["status"] not in {
        "inbox",
        "not_started",
        "in_progress",
        "waiting",
        "completed",
        "cancelled",
    }:
        raise HTTPException(status_code=422, detail="Unsupported task status.")
    if "priority" in changes and changes["priority"] not in {"low", "normal", "high", "urgent"}:
        raise HTTPException(status_code=422, detail="Unsupported task priority.")
    if "project_id" in changes:
        changes["project_id"] = validate_uuid(changes["project_id"], "project_id")
        if changes["project_id"] and not fetch_one(
            "SELECT id FROM projects WHERE id=%s::uuid AND user_id=%s AND archived_at IS NULL",
            (changes["project_id"], user_id),
        ):
            raise HTTPException(status_code=404, detail="Project not found.")
    with get_connection() as connection:
        assignments = ", ".join(f"{field} = %s" for field in changes)
        if "status" in changes:
            assignments += (
                ", completed_at = COALESCE(completed_at, now())"
                if changes["status"] == "completed" else ", completed_at = NULL"
            )
        if "parent_task_id" in changes:
            # Serialize tree edits so concurrent moves cannot turn siblings into a cycle.
            connection.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user_id,))
            parent_id = validate_uuid(changes["parent_task_id"], "parent_task_id")
            if parent_id == task_id:
                raise HTTPException(status_code=422, detail="A task cannot be its own parent.")
            if parent_id and not connection.execute(
                "SELECT id FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
                (parent_id, user_id),
            ).fetchone():
                raise HTTPException(status_code=404, detail="Parent task not found.")
            if parent_id and connection.execute(
                "WITH RECURSIVE descendants(id) AS (SELECT id FROM tasks WHERE parent_task_id=%s AND user_id=%s AND deleted_at IS NULL "
                "UNION SELECT t.id FROM tasks t JOIN descendants d ON t.parent_task_id=d.id WHERE t.user_id=%s AND t.deleted_at IS NULL) "
                "SELECT 1 FROM descendants WHERE id=%s LIMIT 1",
                (task_id, user_id, user_id, parent_id),
            ).fetchone():
                raise HTTPException(
                    status_code=422, detail="A task cannot be moved beneath one of its descendants."
                )
            changes["parent_task_id"] = parent_id
        updated = connection.execute(
            f"UPDATE tasks SET {assignments}, updated_at=now() "
            "WHERE user_id=%s AND id=%s AND deleted_at IS NULL RETURNING *",
            (*changes.values(), user_id, task_id),
        ).fetchone()
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found.")
    return updated


def delete_task(user_id: str, task_id: str) -> None:
    task_id = validate_uuid(task_id, "task_id")
    with get_connection() as connection:
        result = connection.execute(
            "WITH RECURSIVE task_tree(id) AS ("
            "SELECT id FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL "
            "UNION SELECT child.id FROM tasks child JOIN task_tree parent "
            "ON child.parent_task_id=parent.id WHERE child.user_id=%s AND child.deleted_at IS NULL) "
            "UPDATE tasks SET deleted_at=now(),updated_at=now() "
            "WHERE user_id=%s AND id IN (SELECT id FROM task_tree) RETURNING id",
            (task_id, user_id, user_id, user_id),
        ).fetchall()
    if not result:
        raise HTTPException(status_code=404, detail="Task not found.")


def set_task_dependencies(user_id: str, task_id: str, dependency_ids: list[str]) -> list[dict]:
    task_id = validate_uuid(task_id, "task_id")
    if not isinstance(dependency_ids, list) or any(not isinstance(value, str) for value in dependency_ids):
        raise HTTPException(status_code=422, detail="depends_on must be a list of task identifiers.")
    ids = list(dict.fromkeys(validate_uuid(value, "dependency_id") for value in dependency_ids))
    if task_id in ids:
        raise HTTPException(status_code=422, detail="A task cannot depend on itself.")
    with get_connection() as connection:
        connection.execute("SELECT id FROM users WHERE id=%s FOR UPDATE", (user_id,))
        if ids:
            found = connection.execute(
                "SELECT id FROM tasks WHERE user_id=%s AND id=ANY(%s::uuid[]) AND deleted_at IS NULL",
                (user_id, ids),
            ).fetchall()
            if len(found) != len(ids):
                raise HTTPException(status_code=404, detail="One or more dependency tasks were not found.")
        exists = connection.execute(
            "SELECT 1 FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
            (task_id, user_id),
        ).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Task not found.")
        cycle = (
            connection.execute(
                "WITH RECURSIVE chain(id) AS (SELECT unnest(%s::uuid[]) "
                "UNION SELECT d.depends_on_task_id FROM task_dependencies d JOIN chain c ON d.task_id=c.id) "
                "SELECT 1 FROM chain WHERE id=%s LIMIT 1",
                (ids, task_id),
            ).fetchone()
            if ids
            else None
        )
        if cycle:
            raise HTTPException(status_code=422, detail="These dependencies would create a cycle.")
        connection.execute("DELETE FROM task_dependencies WHERE task_id=%s", (task_id,))
        if ids:
            connection.execute(
                "INSERT INTO task_dependencies (task_id, depends_on_task_id) SELECT %s,unnest(%s::uuid[])",
                (task_id, ids),
            )
        return connection.execute(
            "SELECT d.depends_on_task_id AS id, t.title, t.status FROM task_dependencies d "
            "JOIN tasks t ON t.id=d.depends_on_task_id WHERE d.task_id=%s ORDER BY t.title",
            (task_id,),
        ).fetchall()


def list_subtasks(user_id: str, task_id: str) -> list[dict]:
    task_id = validate_uuid(task_id, "task_id")
    if not fetch_one(
        "SELECT id FROM tasks WHERE id=%s AND user_id=%s AND deleted_at IS NULL",
        (task_id, user_id),
    ):
        raise HTTPException(status_code=404, detail="Parent task not found.")
    return fetch_all(
        "SELECT id,title,status,priority,due_at,completed_at FROM tasks "
        "WHERE user_id=%s AND parent_task_id=%s AND deleted_at IS NULL "
        "ORDER BY position,created_at",
        (user_id, task_id),
    )
