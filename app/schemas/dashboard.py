from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class DashboardPeriod(BaseModel):
    timezone: str
    from_date: date
    to_date: date
    start_at: datetime
    end_at: datetime


class DashboardSummaryResponse(BaseModel):
    period: DashboardPeriod
    open_inquiries: int
    quotations_awaiting_confirmation: int
    follow_ups_due_today: int
    follow_ups_overdue: int
    in_production: int
    completed_in_period: int
    jobs_created_in_period: int
    confirmed_created_in_period: int
    conversion_rate: str
    open_quotation_pipeline_value: str
    payments_received_in_period: str
    outstanding_balance: str


class JobsByStageItem(BaseModel):
    stage_id: UUID
    stage_name: str
    category_id: UUID
    category_name: str
    job_count: int


class JobsByStageResponse(BaseModel):
    items: list[JobsByStageItem]


class JobsByCategoryItem(BaseModel):
    category_id: UUID
    category_name: str
    job_count: int
    confirmed_count: int
    in_production_count: int
    completed_count: int


class JobsByCategoryResponse(BaseModel):
    items: list[JobsByCategoryItem]


class PaymentsByMethodItem(BaseModel):
    payment_method: str
    payment_count: int
    total_amount: str


class PaymentsSummaryResponse(BaseModel):
    period: DashboardPeriod
    payment_count: int
    total_received: str
    by_method: list[PaymentsByMethodItem]
