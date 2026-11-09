"""
NEXORA Backend — Health and readiness endpoints.

GET /api/v1/health/live   — liveness probe (always 200 while process is up)
GET /api/v1/health/ready  — readiness probe (checks DB connectivity)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.common import SuccessResponse

router = APIRouter()


@router.get(
    "/live",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness probe",
)
async def liveness() -> SuccessResponse:
    """Returns 200 as long as the process is running."""
    return SuccessResponse(message="alive")


@router.get(
    "/ready",
    response_model=SuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Readiness probe",
)
async def readiness(db: AsyncSession = Depends(get_db)) -> SuccessResponse:
    """
    Returns 200 when the app can serve traffic.

    Verifies the database connection with a lightweight query.
    Returns 503 (unhealthy) if the DB is unreachable.
    """
    await db.execute(text("SELECT 1"))
    return SuccessResponse(message="ready")
