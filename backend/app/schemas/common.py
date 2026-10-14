"""
NEXORA Backend — Common error response schemas.

All API errors follow the same envelope so clients parse one format.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    """A single error entry (field + message)."""

    field: str | None = None
    message: str


class ErrorResponse(BaseModel):
    """Standard error envelope returned by all NEXORA endpoints."""

    ok: bool = False
    code: str  # machine-readable error code, e.g. "VALIDATION_ERROR"
    message: str  # human-readable summary
    details: list[ErrorDetail] = []


class SuccessResponse(BaseModel):
    """Minimal success envelope for operations that return no data."""

    ok: bool = True
    message: str = "ok"
