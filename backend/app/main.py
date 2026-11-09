import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException

from app.api.health import router as health_router
from app.core.config import get_settings
from app.features.attachments.routes import router as attachments_router
from app.features.calendar.routes import router as calendar_router
from app.features.finance.routes import router as finance_router
from app.features.goals.routes import router as goals_router
from app.features.habits.routes import router as habits_router
from app.features.insights.routes import router as insights_router
from app.features.notes.routes import router as notes_router
from app.features.notifications.routes import router as notifications_router
from app.features.profile.routes import router as profile_router
from app.features.projects.routes import router as projects_router
from app.features.search.routes import router as search_router
from app.features.tasks.routes import router as tasks_router
from app.features.trackers.routes import router as trackers_router

logger = logging.getLogger("dayloop.api")


def create_app() -> FastAPI:
    application = FastAPI(
        title="DayLoop API",
        version="0.3.0",
        description="Personal life management API for DayLoop.",
    )

    # The web client sends the local development identity headers, which makes
    # browsers issue an OPTIONS preflight before every API request.  Without
    # this middleware Starlette returns 405 before a route or error handler can
    # respond, and the browser reports the useful API status as a CORS error.
    settings = get_settings()
    origins = [
        origin.strip().rstrip("/")
        for origin in settings["cors_origins"].split(",")
        if origin.strip()
    ]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-DayLoop-Dev-User", "X-DayLoop-Dev-Email", "X-DayLoop-Dev-Name"],
        expose_headers=["Content-Type"],
    )

    @application.exception_handler(HTTPException)
    async def handle_http_error(request: Request, error: HTTPException) -> JSONResponse:
        detail = error.detail
        return JSONResponse(
            status_code=error.status_code,
            content=jsonable_encoder({
                "status": "error",
                "status_code": error.status_code,
                "detail": detail,
            }),
            headers=error.headers,
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=jsonable_encoder({
                "status": "error",
                "status_code": 422,
                "detail": error.errors(),
            }),
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        logger.exception("Unhandled API error for %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "status_code": 500,
                "detail": "An unexpected server error occurred.",
            },
        )

    routers = [
        insights_router,
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
