from fastapi import APIRouter

from app.core.database import fetch_one

router = APIRouter(tags=["system"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "dayloop-api"}


@router.get("/health/ready")
def readiness_check() -> dict:
    database = fetch_one("SELECT current_database() AS name, now() AS checked_at")
    return {"status": "ready", "database": database}
