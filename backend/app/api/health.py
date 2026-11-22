from fastapi import APIRouter, Header, HTTPException

from app.core.config import get_settings
from app.core.database import fetch_one

router = APIRouter(tags=["system"])


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "dayloop-api"}


@router.get("/health/ready")
def readiness_check(x_dayloop_admin_key: str | None = Header(default=None)) -> dict:
    expected = get_settings()["admin_key"]
    if not expected:
        raise HTTPException(status_code=503, detail="Readiness access is not configured.")
    if x_dayloop_admin_key != expected:
        raise HTTPException(status_code=401, detail="Invalid admin key.")
    database = fetch_one("SELECT current_database() AS name, now() AS checked_at, "
                         "pg_database_size(current_database()) AS size_bytes")
    return {"status": "ready", "database": database}
