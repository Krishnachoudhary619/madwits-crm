from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.job_status_history import JobStatusHistory
    from app.models.print_category import PrintCategory


class WorkflowStage(Base):
    __tablename__ = "workflow_stages"
    __table_args__ = (
        CheckConstraint("sequence > 0", name="ck_workflow_stages_sequence_positive"),
        UniqueConstraint(
            "category_id",
            "sequence",
            name="uq_workflow_stages_category_sequence",
            deferrable=True,
            initially="IMMEDIATE",
        ),
        UniqueConstraint(
            "id",
            "category_id",
            name="uq_workflow_stages_id_category",
        ),
        Index(
            "uq_workflow_stages_active_name_per_category",
            "category_id",
            "name",
            unique=True,
            postgresql_where=text("is_active = true"),
        ),
        Index(
            "uq_workflow_stages_one_active_initial",
            "category_id",
            unique=True,
            postgresql_where=text("is_active = true AND is_initial = true"),
        ),
        Index(
            "uq_workflow_stages_one_active_final",
            "category_id",
            unique=True,
            postgresql_where=text("is_active = true AND is_final = true"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("print_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    is_initial: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    is_final: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    category: Mapped[PrintCategory] = relationship(back_populates="stages")
    jobs: Mapped[list[Job]] = relationship(
        back_populates="current_stage",
        foreign_keys="Job.current_stage_id",
        passive_deletes=True,
    )
    history_from: Mapped[list[JobStatusHistory]] = relationship(
        back_populates="from_stage",
        foreign_keys="JobStatusHistory.from_stage_id",
        passive_deletes=True,
    )
    history_to: Mapped[list[JobStatusHistory]] = relationship(
        back_populates="to_stage",
        foreign_keys="JobStatusHistory.to_stage_id",
        passive_deletes=True,
    )
