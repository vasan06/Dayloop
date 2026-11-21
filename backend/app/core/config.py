import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")


@lru_cache(maxsize=1)
def get_settings() -> dict:
    return {
        "app_env": os.getenv("DAYLOOP_ENV", "development").strip().lower(),
        "auth_mode": os.getenv("DAYLOOP_AUTH_MODE", "firebase").strip().lower(),
        "database_url": os.getenv("DATABASE_URL", ""),
        "firebase_project_id": os.getenv("FIREBASE_PROJECT_ID", ""),
        "admin_key": os.getenv("DAYLOOP_ADMIN_KEY", "dayloop-admin-local" if os.getenv("DAYLOOP_ENV", "development").strip().lower() == "development" else ""),
        "attachment_root": os.getenv("ATTACHMENT_ROOT", "../storage/attachments"),
        "cors_origins": os.getenv(
            "CORS_ORIGINS",
            "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174,http://localhost,https://localhost",
        ),
    }
