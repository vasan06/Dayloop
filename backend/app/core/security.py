"""
NEXORA Backend — Security helpers.

Covers:
- Password hashing via Argon2 (pwdlib)
- JWT access token and refresh token creation / verification
- No secrets stored in this file — all keys come from Settings
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

from app.core.config import get_settings

_settings = get_settings()

# ── Password hashing ──────────────────────────────────────────────────────────

_pwd_context = PasswordHash((Argon2Hasher(),))


def hash_password(plain: str) -> str:
    """Return the Argon2id hash of *plain*."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed*."""
    return _pwd_context.verify(plain, hashed)


# ── JWT helpers ───────────────────────────────────────────────────────────────

_ALGO = _settings.jwt_algorithm


def _make_token(
    *,
    sub: str,
    token_type: str,
    secret: str,
    expires_delta: timedelta,
    extra: dict[str, Any] | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": str(uuid.uuid4()),  # unique token ID (for revocation checks)
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm=_ALGO)


def create_access_token(user_id: str, device_id: str | None = None) -> str:
    """Create a short-lived JWT access token for *user_id*."""
    extra = {"device_id": device_id} if device_id else {}
    return _make_token(
        sub=user_id,
        token_type="access",
        secret=_settings.access_token_secret,
        expires_delta=timedelta(minutes=_settings.access_token_expire_minutes),
        extra=extra,
    )


def create_refresh_token(user_id: str, device_id: str | None = None) -> str:
    """Create a long-lived rotating refresh token for *user_id*."""
    extra = {"device_id": device_id} if device_id else {}
    return _make_token(
        sub=user_id,
        token_type="refresh",
        secret=_settings.refresh_token_secret,
        expires_delta=timedelta(days=_settings.refresh_token_expire_days),
        extra=extra,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate an access token.

    Raises jwt.exceptions.* on failure — callers convert to HTTP 401.
    """
    payload = jwt.decode(token, _settings.access_token_secret, algorithms=[_ALGO])
    if payload.get("type") != "access":
        raise InvalidTokenError("Not an access token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a refresh token.

    Raises jwt.exceptions.* on failure — callers convert to HTTP 401.
    """
    payload = jwt.decode(token, _settings.refresh_token_secret, algorithms=[_ALGO])
    if payload.get("type") != "refresh":
        raise InvalidTokenError("Not a refresh token")
    return payload
