from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, Field, StringConstraints
from typing_extensions import Required, TypedDict

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
Label = Annotated[str, StringConstraints(max_length=32)]
Metric = Annotated[Decimal, Field(max_digits=14, decimal_places=3, allow_inf_nan=False)]


class TaskFields(TypedDict, total=False):
    title: Title
    description: str
    status: Literal["inbox", "not_started", "in_progress", "waiting", "completed", "cancelled"]
    priority: Literal["low", "normal", "high", "urgent"]
    start_at: AwareDatetime | None
    due_at: AwareDatetime | None
    project_id: UUID | None
    parent_task_id: UUID | None


class ProjectFields(TypedDict, total=False):
    name: Name
    description: str
    color: Label
    status: Literal["active", "on_hold", "completed"]
    start_date: date | None
    due_date: date | None


class GoalFields(TypedDict, total=False):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    description: str
    goal_type: Literal["personal", "learning", "health", "finance", "career"]
    unit: Label | None
    target_value: Metric | None
    current_value: Metric
    start_date: date | None
    target_date: date | None
    status: Literal["active", "completed", "paused", "cancelled"]


class TrackerFields(TypedDict, total=False):
    name: Required[Name]
    metric_type: Literal["number", "duration", "boolean"]
    frequency: Literal["daily", "weekly", "monthly"]
    unit: Label | None
    target_value: Metric | None


class TrackerEntry(TypedDict, total=False):
    numeric_value: Required[Metric]
    text_value: str | None
    notes: str


class HabitFields(TypedDict, total=False):
    name: Name
    description: str
    question: str
    timezone: str
    habit_type: Literal["positive", "negative"]
    measurement_type: Literal["boolean", "quantity", "duration", "text"]
    target_type: Literal["at_least", "at_most"]
    target_value: Metric | None
    unit: Label | None
    color: Label | None
    daily_note_required: bool
    reminder_config: dict
    frequency_config: dict
    schedule_config: dict
    schedule_type: Literal["daily", "weekly", "custom"]


class EventFields(TypedDict, total=False):
    title: Required[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]]
    description: str
    start_at: Required[AwareDatetime]
    end_at: Required[AwareDatetime]
    timezone: str
    recurrence_rule: str | None
