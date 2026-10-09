from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.user import User
    from app.models.workflow_stage import WorkflowStage


class JobStatusHistory(Base):
    __tablename__ = "job_status_history"
    __table_args__ = (
        Index(
            "ix_job_status_history_job_id_created_at",
            "job_id",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("jobs.id", ondelete="RESTRICT"),
        nullable=False,
    )
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("workflow_stages.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    to_stage_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("workflow_stages.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    updated_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    job: Mapped[Job] = relationship(back_populates="status_history")
    from_stage: Mapped[WorkflowStage | None] = relationship(
        back_populates="history_from",
        foreign_keys=[from_stage_id],
    )
    to_stage: Mapped[WorkflowStage] = relationship(
        back_populates="history_to",
        foreign_keys=[to_stage_id],
    )
    updated_by_user: Mapped[User] = relationship(
        back_populates="status_history",
        foreign_keys=[updated_by_user_id],
    )
