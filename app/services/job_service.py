from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    LEAD_STATUS_TRANSITIONS,
    Customer,
    Job,
    JobStatusHistory,
    LeadStatus,
    PrintCategory,
    WorkflowStage,
)
from app.services.exceptions import (
    CategoryNotFoundError,
    CustomerNotFoundError,
    InactiveCategoryError,
    InactiveCustomerError,
    IncompleteWorkflowError,
    InvalidLifecycleTransitionError,
    InvalidStageTransitionError,
    QuotationRequiredError,
    StageConcurrencyError,
)
from app.services.user_service import require_active_attribution_user
from app.services.workflow_service import list_active_stages


JOB_SORT_FIELDS = {
    "created_at": Job.created_at,
    "updated_at": Job.updated_at,
    "due_date": Job.due_date,
    "next_follow_up_at": Job.next_follow_up_at,
    "job_number": Job.job_number,
    "title": Job.title,
}

TERMINAL_LEAD_STATUSES = frozenset({LeadStatus.LOST, LeadStatus.CANCELLED})
CONFIRMABLE_STATUSES = frozenset(
    {LeadStatus.QUOTATION_PREPARED, LeadStatus.AWAITING_CONFIRMATION}
)
QUOTABLE_STATUSES = frozenset(
    {
        LeadStatus.NEW_INQUIRY,
        LeadStatus.QUOTATION_PREPARED,
        LeadStatus.AWAITING_CONFIRMATION,
    }
)


def generate_job_number() -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"MW-{stamp}-{uuid4().hex[:8].upper()}"


def get_job(db: Session, job_id: UUID, *, for_update: bool = False) -> Job | None:
    stmt = select(Job).where(Job.id == job_id)
    if for_update:
        stmt = stmt.with_for_update()
    return db.scalar(stmt)


def _transition(job: Job, new_status: LeadStatus) -> None:
    current = LeadStatus(job.lead_status)
    if current == new_status:
        return
    allowed = LEAD_STATUS_TRANSITIONS[current]
    if new_status not in allowed:
        raise InvalidLifecycleTransitionError(
            f"Cannot change lead status from {current.value} to {new_status.value}."
        )
    job.lead_status = new_status.value


def _require_active_customer(db: Session, customer_id: UUID) -> Customer:
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise CustomerNotFoundError("Customer not found.")
    if not customer.is_active:
        raise InactiveCustomerError("Jobs cannot be created for an inactive customer.")
    return customer


def _require_active_category(db: Session, category_id: UUID) -> PrintCategory:
    category = db.get(PrintCategory, category_id)
    if category is None:
        raise CategoryNotFoundError("Print category not found.")
    if not category.is_active:
        raise InactiveCategoryError(
            "Jobs cannot be created for an inactive print category."
        )
    return category


def _initial_stage(db: Session, category_id: UUID) -> WorkflowStage:
    stages = list_active_stages(db, category_id)
    initials = [stage for stage in stages if stage.is_initial]
    finals = [stage for stage in stages if stage.is_final]
    if not stages or len(initials) != 1 or len(finals) != 1:
        raise IncompleteWorkflowError(
            "A job can be confirmed only when its category has exactly one "
            "active initial stage and one active final stage."
        )
    return initials[0]


def _append_history(
    db: Session,
    job: Job,
    *,
    to_stage: WorkflowStage,
    attribution_user_id: UUID,
    notes: str | None,
) -> JobStatusHistory:
    require_active_attribution_user(db, attribution_user_id)
    history = JobStatusHistory(
        job_id=job.id,
        from_stage_id=job.current_stage_id,
        to_stage_id=to_stage.id,
        updated_by_user_id=attribution_user_id,
        notes=notes.strip() if notes else None,
    )
    job.current_stage_id = to_stage.id
    db.add(history)
    db.flush()
    return history


def _allowed_stage_targets(db: Session, job: Job) -> dict[UUID, WorkflowStage]:
    if job.current_stage_id is None:
        return {}
    current = db.get(WorkflowStage, job.current_stage_id)
    if current is None:
        raise InvalidStageTransitionError("The job's current stage no longer exists.")
    active = list_active_stages(db, job.category_id)
    targets: dict[UUID, WorkflowStage] = {}
    previous = [stage for stage in active if stage.sequence < current.sequence]
    nxt = [stage for stage in active if stage.sequence > current.sequence]
    if previous:
        targets[previous[-1].id] = previous[-1]
    if nxt:
        targets[nxt[0].id] = nxt[0]
    for stage in active:
        if stage.is_final and stage.id != job.current_stage_id:
            targets[stage.id] = stage
    return targets


def create_job(
    db: Session,
    *,
    customer_id: UUID,
    category_id: UUID,
    title: str,
    description: str,
    quantity: int,
    specifications: dict | None = None,
    due_date: datetime | None = None,
    next_follow_up_at: datetime | None = None,
    notes: str | None = None,
) -> Job:
    _require_active_customer(db, customer_id)
    _require_active_category(db, category_id)
    job: Job | None = None
    for attempt in range(3):
        job = Job(
            job_number=generate_job_number(),
            customer_id=customer_id,
            category_id=category_id,
            title=title.strip(),
            description=description.strip(),
            quantity=quantity,
            specifications=specifications or {},
            lead_status=LeadStatus.NEW_INQUIRY.value,
            due_date=due_date,
            next_follow_up_at=next_follow_up_at,
            notes=notes.strip() if notes else None,
        )
        db.add(job)
        try:
            with db.begin_nested():
                db.flush()
            db.refresh(job)
            return job
        except IntegrityError:
            if attempt == 2:
                raise
    raise RuntimeError("Job number allocation failed.")


def list_jobs(
    db: Session,
    *,
    q: str | None,
    customer_id: UUID | None,
    category_id: UUID | None,
    lead_status: list[str] | None,
    current_stage_id: UUID | None,
    created_from: datetime | None,
    created_to: datetime | None,
    due_from: datetime | None,
    due_to: datetime | None,
    follow_up_overdue: bool | None,
    page: int,
    page_size: int,
    sort: str,
    order: str,
) -> tuple[list[Job], int]:
    stmt = select(Job)
    count_stmt = select(func.count()).select_from(Job)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        search = or_(
            Job.job_number.ilike(pattern),
            Job.title.ilike(pattern),
            Customer.name.ilike(pattern),
            Customer.phone.ilike(pattern),
        )
        stmt = stmt.join(Customer, Job.customer_id == Customer.id).where(search)
        count_stmt = count_stmt.join(Customer, Job.customer_id == Customer.id).where(
            search
        )
    if customer_id is not None:
        stmt = stmt.where(Job.customer_id == customer_id)
        count_stmt = count_stmt.where(Job.customer_id == customer_id)
    if category_id is not None:
        stmt = stmt.where(Job.category_id == category_id)
        count_stmt = count_stmt.where(Job.category_id == category_id)
    if lead_status:
        stmt = stmt.where(Job.lead_status.in_(lead_status))
        count_stmt = count_stmt.where(Job.lead_status.in_(lead_status))
    if current_stage_id is not None:
        stmt = stmt.where(Job.current_stage_id == current_stage_id)
        count_stmt = count_stmt.where(Job.current_stage_id == current_stage_id)
    if created_from is not None:
        stmt = stmt.where(Job.created_at >= created_from)
        count_stmt = count_stmt.where(Job.created_at >= created_from)
    if created_to is not None:
        stmt = stmt.where(Job.created_at <= created_to)
        count_stmt = count_stmt.where(Job.created_at <= created_to)
    if due_from is not None:
        stmt = stmt.where(Job.due_date >= due_from)
        count_stmt = count_stmt.where(Job.due_date >= due_from)
    if due_to is not None:
        stmt = stmt.where(Job.due_date <= due_to)
        count_stmt = count_stmt.where(Job.due_date <= due_to)
    if follow_up_overdue:
        now = datetime.now(timezone.utc)
        overdue = Job.next_follow_up_at.is_not(None) & (Job.next_follow_up_at <= now)
        stmt = stmt.where(overdue)
        count_stmt = count_stmt.where(overdue)

    sort_column = JOB_SORT_FIELDS.get(sort, Job.created_at)
    if order.lower() == "asc":
        stmt = stmt.order_by(sort_column.asc(), Job.id.asc())
    else:
        stmt = stmt.order_by(sort_column.desc(), Job.id.desc())

    total = int(db.scalar(count_stmt) or 0)
    items = list(
        db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    )
    return items, total


def update_job(
    db: Session,
    job: Job,
    *,
    title: str | None = None,
    description: str | None = None,
    quantity: int | None = None,
    specifications: dict | None = None,
    quoted_amount: Decimal | None = None,
    final_amount: Decimal | None = None,
    advance_amount: Decimal | None = None,
    due_date: datetime | None = None,
    next_follow_up_at: datetime | None = None,
    notes: str | None = None,
) -> Job:
    terminal = job.lead_status in {status.value for status in TERMINAL_LEAD_STATUSES}
    operational_change = any(
        value is not None
        for value in (
            title,
            description,
            quantity,
            specifications,
            quoted_amount,
            final_amount,
            advance_amount,
            due_date,
            next_follow_up_at,
        )
    )
    if terminal and operational_change:
        raise InvalidLifecycleTransitionError(
            "Lost and cancelled jobs can only receive notes."
        )
    if title is not None:
        job.title = title.strip()
    if description is not None:
        job.description = description.strip()
    if quantity is not None:
        job.quantity = quantity
    if specifications is not None:
        job.specifications = specifications
    if quoted_amount is not None:
        job.quoted_amount = quoted_amount
    if final_amount is not None:
        job.final_amount = final_amount
    if advance_amount is not None:
        job.advance_amount = advance_amount
    if due_date is not None:
        job.due_date = due_date
    if next_follow_up_at is not None:
        job.next_follow_up_at = next_follow_up_at
    if notes is not None:
        job.notes = notes.strip() or None
    db.flush()
    db.refresh(job)
    return job


def save_quotation(
    db: Session,
    job: Job,
    *,
    quoted_amount: Decimal,
    final_amount: Decimal | None,
    advance_amount: Decimal | None,
    due_date: datetime | None,
    next_follow_up_at: datetime | None,
    notes: str | None,
    awaiting_confirmation: bool,
) -> Job:
    current = LeadStatus(job.lead_status)
    if current not in QUOTABLE_STATUSES:
        raise InvalidLifecycleTransitionError(
            "Quotation details can be saved only before confirmation."
        )
    job.quoted_amount = quoted_amount
    if final_amount is not None:
        job.final_amount = final_amount
    if advance_amount is not None:
        job.advance_amount = advance_amount
    if due_date is not None:
        job.due_date = due_date
    if next_follow_up_at is not None:
        job.next_follow_up_at = next_follow_up_at
    if notes is not None:
        job.notes = notes.strip() or None
    next_status = (
        LeadStatus.AWAITING_CONFIRMATION
        if awaiting_confirmation
        else LeadStatus.QUOTATION_PREPARED
    )
    _transition(job, next_status)
    db.flush()
    db.refresh(job)
    return job


def confirm_job(
    db: Session,
    job: Job,
    *,
    attribution_user_id: UUID,
    notes: str | None = None,
    final_amount: Decimal | None = None,
) -> Job:
    current = LeadStatus(job.lead_status)
    if current not in CONFIRMABLE_STATUSES:
        raise InvalidLifecycleTransitionError(
            "Only quoted jobs awaiting a customer decision can be confirmed."
        )
    if job.quoted_amount is None:
        raise QuotationRequiredError(
            "A quotation amount is required before confirmation."
        )
    initial = _initial_stage(db, job.category_id)
    if final_amount is not None:
        job.final_amount = final_amount
    elif job.final_amount is None:
        job.final_amount = job.quoted_amount
    _transition(job, LeadStatus.CONFIRMED)
    _append_history(
        db,
        job,
        to_stage=initial,
        attribution_user_id=attribution_user_id,
        notes=notes,
    )
    db.refresh(job)
    return job


def mark_job_lost(db: Session, job: Job, *, notes: str | None = None) -> Job:
    _transition(job, LeadStatus.LOST)
    if notes is not None:
        job.notes = notes.strip() or None
    db.flush()
    db.refresh(job)
    return job


def cancel_job(db: Session, job: Job, *, notes: str | None = None) -> Job:
    _transition(job, LeadStatus.CANCELLED)
    if notes is not None:
        job.notes = notes.strip() or None
    db.flush()
    db.refresh(job)
    return job


def update_job_stage(
    db: Session,
    job: Job,
    *,
    to_stage_id: UUID,
    attribution_user_id: UUID,
    notes: str | None = None,
    expected_current_stage_id: UUID | None = None,
) -> Job:
    if job.lead_status != LeadStatus.CONFIRMED.value:
        raise InvalidStageTransitionError(
            "Production stages can be updated only on confirmed jobs."
        )
    if (
        expected_current_stage_id is not None
        and job.current_stage_id != expected_current_stage_id
    ):
        raise StageConcurrencyError(
            "The job's current stage changed. Refresh and try again."
        )
    if to_stage_id == job.current_stage_id:
        raise InvalidStageTransitionError("The job is already at that production stage.")
    target = db.get(WorkflowStage, to_stage_id)
    if target is None or target.category_id != job.category_id:
        raise InvalidStageTransitionError(
            "The target stage does not belong to this job's print category."
        )
    if not target.is_active:
        raise InvalidStageTransitionError("The target production stage is inactive.")
    allowed = _allowed_stage_targets(db, job)
    if target.id not in allowed:
        raise InvalidStageTransitionError(
            "Jobs may move to the previous or next active stage, "
            "or directly to the category's final stage."
        )
    _append_history(
        db,
        job,
        to_stage=target,
        attribution_user_id=attribution_user_id,
        notes=notes,
    )
    db.refresh(job)
    return job


def list_job_history(db: Session, job_id: UUID) -> list[JobStatusHistory]:
    return list(
        db.scalars(
            select(JobStatusHistory)
            .where(JobStatusHistory.job_id == job_id)
            .order_by(JobStatusHistory.created_at.asc(), JobStatusHistory.id.asc())
        ).all()
    )
