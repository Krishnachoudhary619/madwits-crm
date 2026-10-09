from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StaffCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=150)
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=72)


class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, min_length=1, max_length=150)
    password: str | None = Field(default=None, min_length=8, max_length=72)
    is_active: bool | None = None


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    username: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AttributionOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    username: str
    role: str


class UserListResponse(BaseModel):
    items: list[UserPublic]
    total: int
    page: int
    page_size: int
