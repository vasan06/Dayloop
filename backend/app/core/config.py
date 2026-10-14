"""
NEXORA Backend — Application Settings

All configuration is loaded from environment variables (or a .env file).
No secrets are hardcoded. Validation happens at startup via Pydantic.
"""

from __future__ import annotations

import secrets
from functools import lru_cache
from typing import Annotated, Any

from pydantic import AnyUrl, EmailStr, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    app_env: str = Field(default="development", description="development | production | test")
    app_name: str = "NEXORA"
    api_v1_prefix: str = "/api/v1"
    debug: bool = Field(default=False)

    # ── Database ─────────────────────────────────────────────────────────────
    database_url: str = Field(
        ...,
        description="Async PostgreSQL DSN — postgresql+psycopg://user:pass@host:port/db",
    )
    test_database_url: str = Field(
        default="",
        description="Separate test DB DSN (used only during pytest runs)",
    )
    db_pool_size: int = Field(default=10, ge=1, le=100)
    db_max_overflow: int = Field(default=20, ge=0, le=100)
    db_pool_timeout: int = Field(default=30, ge=1)

    # ── JWT ──────────────────────────────────────────────────────────────────
    access_token_secret: str = Field(
        ...,
        min_length=32,
        description="Random hex string ≥32 chars; generate with secrets.token_hex(64)",
    )
    refresh_token_secret: str = Field(
        ...,
        min_length=32,
        description="Different from access_token_secret",
    )
    access_token_expire_minutes: int = Field(default=15, ge=1, le=60)
    refresh_token_expire_days: int = Field(default=30, ge=1, le=90)
    jwt_algorithm: str = "HS256"

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: list[str] = Field(
        default_factory=list,
        description="Comma-separated list of allowed CORS origins",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # ── Email ─────────────────────────────────────────────────────────────────
    smtp_host: str = Field(default="")
    smtp_port: int = Field(default=587)
    smtp_user: str = Field(default="")
    smtp_password: str = Field(default="")
    email_from: str = Field(default="")

    # ── Firebase (Google Sign-In only) ────────────────────────────────────────
    firebase_credentials_path: str = Field(default="")
    firebase_project_id: str = Field(default="")

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_per_minute: int = Field(default=60, ge=1)

    # ── Derived helpers ───────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"

    @model_validator(mode="after")
    def _validate_secrets_not_defaults(self) -> "Settings":
        # Prevent accidentally running production with placeholder values
        if self.is_production:
            for field_name in ("access_token_secret", "refresh_token_secret"):
                val = getattr(self, field_name)
                if "CHANGE_ME" in val:
                    raise ValueError(
                        f"{field_name} must not be a placeholder in production"
                    )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance (cached after first call)."""
    return Settings()  # type: ignore[call-arg]
