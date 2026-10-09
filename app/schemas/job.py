from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models import LeadStatus


class JobCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_id: UUID
    category_id: UUID
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    specifications: dict[str, Any] = Field(default_factory=dict)
    due_date: datetime | None = None
    next_follow_up_at: datetime | None = None
    notes: str | None = None


class JobUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1)
    quantity: int | None = Field(default=None, gt=0)
    specifications: dict[str, Any] | None = None
    quoted_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    final_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    advance_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    due_date: datetime | None = None
    next_follow_up_at: datetime | None = None
    notes: str | None = None


class QuotationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quoted_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    final_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    advance_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    due_date: datetime | None = None
    next_follow_up_at: datetime | None = None
    notes: str | None = None
    awaiting_confirmation: bool = False


class ConfirmJobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    updated_by_user_id: UUID
    notes: str | None = None
    final_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)


class JobNotesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notes: str | None = None


class StageUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    to_stage_id: UUID
    updated_by_user_id: UUID
    notes: str | None = None
    expected_current_stage_id: UUID | None = None


class JobPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_number: str
    customer_id: UUID
    category_id: UUID
    title: str
    description: str
    quantity: int
    specifications: dict[str, Any]
    lead_status: LeadStatus
    current_stage_id: UUID | None
    quoted_amount: Decimal | None
    final_amount: Decimal | None
    advance_amount: Decimal
    due_date: datetime | None
    next_follow_up_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    @field_serializer("quoted_amount", "final_amount", "advance_amount")
    def serialize_money(self, value: Decimal | None) -> str | None:
        if value is None:
            return None
        return format(value, "f")


class JobListResponse(BaseModel):
    items: list[JobPublic]
    total: int
    page: int
    page_size: int


class JobHistoryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    from_stage_id: UUID | None
    to_stage_id: UUID
    updated_by_user_id: UUID
    notes: str | None
    created_at: datetime
