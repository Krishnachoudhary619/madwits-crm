from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import LeadStatus, User
from app.schemas.job import (
    ConfirmJobRequest,
    JobCreateRequest,
    JobHistoryPublic,
    JobListResponse,
    JobNotesRequest,
    JobPublic,
    JobUpdateRequest,
    QuotationRequest,
    StageUpdateRequest,
)
from app.services.exceptions import (
    AttributionUserNotFoundError,
    CategoryNotFoundError,
    CustomerNotFoundError,
    InactiveAttributionUserError,
    InactiveCategoryError,
    InactiveCustomerError,
    IncompleteWorkflowError,
    InvalidLifecycleTransitionError,
    InvalidStageTransitionError,
    QuotationRequiredError,
    StageConcurrencyError,
)
from app.services.job_service import (
    JOB_SORT_FIELDS,
    cancel_job,
    confirm_job,
    create_job,
    get_job,
    list_job_history,
    list_jobs,
    mark_job_lost,
    save_quotation,
    update_job,
    update_job_stage,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])

_CONFLICT_ERRORS = (
    InactiveCategoryError,
    InactiveCustomerError,
    IncompleteWorkflowError,
    InvalidLifecycleTransitionError,
    InvalidStageTransitionError,
    QuotationRequiredError,
    StageConcurrencyError,
)
_BAD_REQUEST_ERRORS = (
    AttributionUserNotFoundError,
    InactiveAttributionUserError,
)


def _conflict(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))


def _bad_request(exc: Exception) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _job_or_404(db: Session, job_id: UUID, *, for_update: bool = False):
    job = get_job(db, job_id, for_update=for_update)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
        )
    return job


@router.post("", response_model=JobPublic, status_code=status.HTTP_201_CREATED)
def create(
    payload: JobCreateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    try:
        job = create_job(
            db,
            customer_id=payload.customer_id,
            category_id=payload.category_id,
            title=payload.title,
            description=payload.description,
            quantity=payload.quantity,
            specifications=payload.specifications,
            due_date=payload.due_date,
            next_follow_up_at=payload.next_follow_up_at,
            notes=payload.notes,
        )
        db.commit()
        db.refresh(job)
        return job
    except (CustomerNotFoundError, CategoryNotFoundError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.get("", response_model=JobListResponse)
def list_directory(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    customer_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    lead_status: list[LeadStatus] | None = Query(default=None),
    current_stage_id: UUID | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    due_from: datetime | None = Query(default=None),
    due_to: datetime | None = Query(default=None),
    follow_up_overdue: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
) -> JobListResponse:
    if sort not in JOB_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported sort field.",
        )
    if order.lower() not in {"asc", "desc"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported sort order.",
        )
    items, total = list_jobs(
        db,
        q=q,
        customer_id=customer_id,
        category_id=category_id,
        lead_status=[item.value for item in lead_status] if lead_status else None,
        current_stage_id=current_stage_id,
        created_from=created_from,
        created_to=created_to,
        due_from=due_from,
        due_to=due_to,
        follow_up_overdue=follow_up_overdue,
        page=page,
        page_size=page_size,
        sort=sort,
        order=order,
    )
    return JobListResponse(
        items=[JobPublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{job_id}", response_model=JobPublic)
def get_one(
    job_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    return _job_or_404(db, job_id)


@router.patch("/{job_id}", response_model=JobPublic)
def patch(
    job_id: UUID,
    payload: JobUpdateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        updated = update_job(db, job, **payload.model_dump(exclude_unset=True))
        db.commit()
        db.refresh(updated)
        return updated
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.post("/{job_id}/quotation", response_model=JobPublic)
def quotation(
    job_id: UUID,
    payload: QuotationRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        updated = save_quotation(
            db,
            job,
            quoted_amount=payload.quoted_amount,
            final_amount=payload.final_amount,
            advance_amount=payload.advance_amount,
            due_date=payload.due_date,
            next_follow_up_at=payload.next_follow_up_at,
            notes=payload.notes,
            awaiting_confirmation=payload.awaiting_confirmation,
        )
        db.commit()
        db.refresh(updated)
        return updated
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.post("/{job_id}/confirm", response_model=JobPublic)
def confirm(
    job_id: UUID,
    payload: ConfirmJobRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        updated = confirm_job(
            db,
            job,
            attribution_user_id=payload.updated_by_user_id,
            notes=payload.notes,
            final_amount=payload.final_amount,
        )
        db.commit()
        db.refresh(updated)
        return updated
    except _BAD_REQUEST_ERRORS as exc:
        db.rollback()
        raise _bad_request(exc) from exc
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.post("/{job_id}/mark-lost", response_model=JobPublic)
def mark_lost(
    job_id: UUID,
    payload: JobNotesRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        updated = mark_job_lost(db, job, notes=payload.notes)
        db.commit()
        db.refresh(updated)
        return updated
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.post("/{job_id}/cancel", response_model=JobPublic)
def cancel(
    job_id: UUID,
    payload: JobNotesRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        updated = cancel_job(db, job, notes=payload.notes)
        db.commit()
        db.refresh(updated)
        return updated
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.post("/{job_id}/stage", response_model=JobPublic)
def change_stage(
    job_id: UUID,
    payload: StageUpdateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        updated = update_job_stage(
            db,
            job,
            to_stage_id=payload.to_stage_id,
            attribution_user_id=payload.updated_by_user_id,
            notes=payload.notes,
            expected_current_stage_id=payload.expected_current_stage_id,
        )
        db.commit()
        db.refresh(updated)
        return updated
    except _BAD_REQUEST_ERRORS as exc:
        db.rollback()
        raise _bad_request(exc) from exc
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise _conflict(exc) from exc


@router.get("/{job_id}/history", response_model=list[JobHistoryPublic])
def history(
    job_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[JobHistoryPublic]:
    _job_or_404(db, job_id)
    return [
        JobHistoryPublic.model_validate(item) for item in list_job_history(db, job_id)
    ]
