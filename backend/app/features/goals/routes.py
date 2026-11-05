from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_all, fetch_one

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("")
def get_goals(user: dict = Depends(get_current_user)) -> dict:
    return {
        "items": fetch_all(
            "SELECT * FROM goals WHERE user_id=%s ORDER BY target_date NULLS LAST,created_at DESC",
            (user["id"],),
        )
    }


@router.post("", status_code=201)
def create_goal(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    title = str(payload.get("title", "")).strip()
    if not title or len(title) > 160:
        raise HTTPException(status_code=422, detail="Goal title is required.")
    return {
        "item": fetch_one(
            "INSERT INTO goals (user_id,title,description,goal_type,target_value,unit,start_date,target_date) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *",
            (
                user["id"],
                title,
                payload.get("description", ""),
                payload.get("goal_type", "personal"),
                payload.get("target_value"),
                payload.get("unit"),
                payload.get("start_date"),
                payload.get("target_date"),
            ),
        )
    }


@router.patch("/{goal_id}")
def update_goal(goal_id: str, payload: dict, user: dict = Depends(get_current_user)) -> dict:
    allowed = {
        "title",
        "description",
        "target_value",
        "current_value",
        "unit",
        "target_date",
        "status",
    }
    changes = {key: value for key, value in payload.items() if key in allowed}
    if not changes:
        raise HTTPException(status_code=422, detail="No goal changes were provided.")
    if "status" in changes and changes["status"] not in {
        "active",
        "completed",
        "paused",
        "cancelled",
    }:
        raise HTTPException(status_code=422, detail="Unsupported goal status.")
    assignments = ", ".join(key + "=%s" for key in changes)
    goal = fetch_one(
        "UPDATE goals SET "
        + assignments
        + ",updated_at=now() WHERE id=%s AND user_id=%s RETURNING *",
        tuple(changes.values()) + (goal_id, user["id"]),
    )
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found.")
    return {"item": goal}
