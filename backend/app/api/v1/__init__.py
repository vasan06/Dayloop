"""
NEXORA Backend — API v1 router aggregation.

Each feature's router is registered here under its own prefix.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import health

api_router = APIRouter()

# System endpoints (no auth required)
api_router.include_router(health.router, prefix="/health", tags=["health"])

# Feature routers will be added here as slices are implemented:
# api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
# api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
