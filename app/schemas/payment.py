from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models import PaymentStatus

PaymentMethod = Literal["CASH", "UPI", "BANK_TRANSFER"]


class PaymentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    payment_method: PaymentMethod
    paid_at: datetime
    reference_number: str | None = Field(default=None, max_length=160)
    notes: str | None = None


class PaymentPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    amount: Decimal
    payment_method: str
    reference_number: str | None
    paid_at: datetime
    notes: str | None
    created_at: datetime

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return format(value, "f")


class JobBalancePublic(BaseModel):
    job_id: UUID
    amount_due: str
    total_paid: str
    balance: str
    payment_status: PaymentStatus


class JobPaymentListResponse(BaseModel):
    items: list[PaymentPublic]
    total: int
    page: int
    page_size: int
    amount_due: str
    total_paid: str
    balance: str
    payment_status: PaymentStatus


class PaymentListResponse(BaseModel):
    items: list[PaymentPublic]
    total: int
    page: int
    page_size: int
