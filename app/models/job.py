from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.job_status_history import JobStatusHistory
    from app.models.payment import Payment
    from app.models.print_category import PrintCategory
    from app.models.workflow_stage import WorkflowStage


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_jobs_quantity_positive"),
        CheckConstraint(
            "quoted_amount IS NULL OR quoted_amount >= 0",
            name="ck_jobs_quoted_amount_nonnegative",
        ),
        CheckConstraint(
            "final_amount IS NULL OR final_amount >= 0",
            name="ck_jobs_final_amount_nonnegative",
        ),
        CheckConstraint(
            "advance_amount >= 0",
            name="ck_jobs_advance_amount_nonnegative",
        ),
        CheckConstraint(
            "lead_status IN ("
            "'NEW_INQUIRY', 'QUOTATION_PREPARED', 'AWAITING_CONFIRMATION', "
            "'CONFIRMED', 'LOST', 'CANCELLED')",
            name="ck_jobs_lead_status",
        ),
        ForeignKeyConstraint(
            ["current_stage_id", "category_id"],
            ["workflow_stages.id", "workflow_stages.category_id"],
            name="fk_jobs_current_stage_same_category",
            ondelete="RESTRICT",
        ),
        Index("ix_jobs_customer_id", "customer_id"),
        Index("ix_jobs_category_id", "category_id"),
        Index("ix_jobs_lead_status", "lead_status"),
        Index("ix_jobs_current_stage_id", "current_stage_id"),
        Index("ix_jobs_next_follow_up_at", "next_follow_up_at"),
        Index("ix_jobs_due_date", "due_date"),
        Index("ix_jobs_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    job_number: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("print_categories.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    specifications: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    lead_status: Mapped[str] = mapped_column(String(32), nullable=False)
    current_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    quoted_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    final_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    advance_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0"),
    )
    due_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_follow_up_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer: Mapped[Customer] = relationship(back_populates="jobs")
    category: Mapped[PrintCategory] = relationship(back_populates="jobs")
    current_stage: Mapped[WorkflowStage | None] = relationship(
        back_populates="jobs",
        primaryjoin="Job.current_stage_id == WorkflowStage.id",
        foreign_keys="[Job.current_stage_id]",
    )
    payments: Mapped[list[Payment]] = relationship(
        back_populates="job",
        passive_deletes=True,
    )
    status_history: Mapped[list[JobStatusHistory]] = relationship(
        back_populates="job",
        passive_deletes=True,
    )
