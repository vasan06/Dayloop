import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


def parse_origins(value: str) -> list[str]:
    return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> dict:
    return {
        "app_env": os.getenv("DAYLOOP_ENV", "development"),
        "auth_mode": os.getenv("DAYLOOP_AUTH_MODE", "firebase"),
        "database_url": os.getenv("DATABASE_URL", ""),
        "firebase_project_id": os.getenv("FIREBASE_PROJECT_ID", ""),
        "allowed_origins": parse_origins(os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")),
        "attachment_root": os.getenv("ATTACHMENT_ROOT", "../storage/attachments"),
    }
