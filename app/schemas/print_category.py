from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PrintCategoryCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    is_active: bool = True


class PrintCategoryUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    is_active: bool | None = None


class PrintCategoryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PrintCategoryListResponse(BaseModel):
    items: list[PrintCategoryPublic]
    total: int
    page: int
    page_size: int
