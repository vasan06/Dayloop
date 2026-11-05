from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_settings
from app.features.attachments.routes import router as attachments_router
from app.features.calendar.routes import router as calendar_router
from app.features.finance.routes import router as finance_router
from app.features.goals.routes import router as goals_router
from app.features.habits.routes import router as habits_router
from app.features.notes.routes import router as notes_router
from app.features.notifications.routes import router as notifications_router
from app.features.projects.routes import router as projects_router
from app.features.profile.routes import router as profile_router
from app.features.search.routes import router as search_router
from app.features.tasks.routes import router as tasks_router
from app.features.trackers.routes import router as trackers_router


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="DayLoop API",
        version="0.3.0",
        description="Personal life management API for DayLoop.",
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings["allowed_origins"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-DayLoop-Dev-User"],
    )
    routers = [
        health_router,
        projects_router,
        profile_router,
        tasks_router,
        notes_router,
        habits_router,
        finance_router,
        goals_router,
        trackers_router,
        calendar_router,
        notifications_router,
        search_router,
        attachments_router,
    ]
    for router in routers:
        application.include_router(router, prefix="/api/v1")
    return application


app = create_app()
