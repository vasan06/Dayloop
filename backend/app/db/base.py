"""
NEXORA Backend — SQLAlchemy async declarative base.

All ORM models inherit from Base. Import this module in Alembic's env.py
after importing all model modules so that metadata is fully populated.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all NEXORA ORM models."""
    pass
