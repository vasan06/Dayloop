import re

from fastapi import APIRouter, Depends, HTTPException
from psycopg.errors import UniqueViolation

from app.core.auth import get_current_user
from app.core.database import fetch_one
from app.schemas.inputs import ProfileFields

router = APIRouter(prefix="/profile", tags=["profile"])
ALLOWED_ROLES = {"school_student", "student", "working", "freelancer", "entrepreneur", "organization", "educator", "other"}


@router.get("")
def get_profile(user: dict = Depends(get_current_user)) -> dict:
    return {"item": fetch_one(
        "SELECT email,display_name,username,age,role,photo_url,timezone,"
        " onboarding_completed,tour_completed FROM users WHERE id=%s",
        (user["id"],),
    )}


@router.put("")
def update_profile(payload: ProfileFields, user: dict = Depends(get_current_user)) -> dict:
    username = str(payload.get("username", "")).strip().lower()
    name = str(payload.get("display_name", username)).strip() or username
    role = str(payload.get("role", "")).strip()
    age = payload["age"]
    if not re.fullmatch(r"[a-z0-9_]{3,24}", username):
        raise HTTPException(status_code=422, detail="Username must be 3ÔÇô24 letters, numbers or underscores.")
    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=422, detail="Choose a valid role.")
    if not name or len(name) > 80:
        raise HTTPException(status_code=422, detail="Enter your name (up to 80 characters).")
    updates = ["display_name=%s", "username=%s", "age=%s", "role=%s"]
    parameters: list = [name, username, age, role]
    if "timezone" in payload:
        timezone = str(payload["timezone"]).strip()[:64]
        if timezone:
            updates.append("timezone=%s")
            parameters.append(timezone)
    if "onboarding_completed" in payload:
        updates.append("onboarding_completed=%s")
        parameters.append(payload["onboarding_completed"])
    if "tour_completed" in payload:
        updates.append("tour_completed=%s")
        parameters.append(payload["tour_completed"])
    parameters.append(user["id"])
    try:
        item = fetch_one(
            f"UPDATE users SET {','.join(updates)},updated_at=now() "
            "WHERE id=%s RETURNING email,display_name,username,age,role,photo_url,timezone,"
            "onboarding_completed,tour_completed",
            tuple(parameters),
        )
    except UniqueViolation as error:
        raise HTTPException(status_code=409, detail="That username is already taken.") from error
    return {"item": item}
