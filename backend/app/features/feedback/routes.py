from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.core.database import fetch_one

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("")
def create_feedback(payload: dict, user: dict = Depends(get_current_user)) -> dict:
    message = str(payload.get("message", "")).strip()
    page = str(payload.get("page", "")).strip()[:240]
    if len(message) < 3:
        raise HTTPException(status_code=422, detail="Tell us a little more before sending.")
    if len(message) > 4000:
        raise HTTPException(status_code=422, detail="Feedback must be under 4000 characters.")
    item = fetch_one(
        "INSERT INTO user_feedback (user_id,message,page) VALUES (%s,%s,%s) RETURNING id,created_at",
        (user["id"], message, page),
    )
    return {"item": item}
