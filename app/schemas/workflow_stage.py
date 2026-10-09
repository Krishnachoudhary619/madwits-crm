from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class WorkflowStageCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    sequence: int | None = Field(default=None, gt=0)
    is_initial: bool = False
    is_final: bool = False


class WorkflowStageUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    sequence: int | None = Field(default=None, gt=0)
    is_initial: bool | None = None
    is_final: bool | None = None
    is_active: bool | None = None


class WorkflowStagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    name: str
    sequence: int
    is_initial: bool
    is_final: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
