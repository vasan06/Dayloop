"""
NEXORA Backend — pytest configuration.

Sets up the async test client and overrides the DB dependency
to point at TEST_DATABASE_URL (a separate test database).
"""

from __future__ import annotations

import os
import pytest

# Force test environment before any app imports
os.environ.setdefault("APP_ENV", "test")


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
