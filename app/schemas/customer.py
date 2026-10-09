from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CustomerCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=40)
    business_name: str | None = Field(default=None, max_length=200)
    address: str | None = None
    notes: str | None = None


class CustomerUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, min_length=1, max_length=40)
    business_name: str | None = Field(default=None, max_length=200)
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CustomerPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    phone: str
    business_name: str | None
    address: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CustomerListResponse(BaseModel):
    items: list[CustomerPublic]
    total: int
    page: int
    page_size: int


class CustomerJobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_number: str
    title: str
    lead_status: str
    category_id: UUID
    current_stage_id: UUID | None
    created_at: datetime


class CustomerJobListResponse(BaseModel):
    items: list[CustomerJobSummary]
    total: int
    page: int
    page_size: int
