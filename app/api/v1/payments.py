from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.money import format_money
from app.db.session import get_db
from app.models import User
from app.schemas.payment import (
    JobBalancePublic,
    JobPaymentListResponse,
    PaymentCreateRequest,
    PaymentListResponse,
    PaymentPublic,
)
from app.services.exceptions import (
    InvalidPaymentMethodError,
    OverpaymentError,
    PaymentNotAllowedError,
)
from app.services.job_service import get_job
from app.services.payment_service import (
    create_payment,
    job_balance,
    list_job_payments,
    list_payments,
)

router = APIRouter(tags=["payments"])

_CONFLICT_ERRORS = (OverpaymentError, PaymentNotAllowedError)


def _job_or_404(db: Session, job_id: UUID, *, for_update: bool = False):
    job = get_job(db, job_id, for_update=for_update)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found."
        )
    return job


def _balance_payload(db: Session, job) -> dict:
    snapshot = job_balance(db, job)
    return {
        "job_id": job.id,
        "amount_due": format_money(snapshot["amount_due"]),
        "total_paid": format_money(snapshot["total_paid"]),
        "balance": format_money(snapshot["balance"]),
        "payment_status": snapshot["payment_status"],
    }


@router.post(
    "/jobs/{job_id}/payments",
    response_model=PaymentPublic,
    status_code=status.HTTP_201_CREATED,
)
def add_payment(
    job_id: UUID,
    payload: PaymentCreateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PaymentPublic:
    job = _job_or_404(db, job_id, for_update=True)
    try:
        payment = create_payment(
            db,
            job,
            amount=payload.amount,
            payment_method=payload.payment_method,
            paid_at=payload.paid_at,
            reference_number=payload.reference_number,
            notes=payload.notes,
        )
        db.commit()
        db.refresh(payment)
        return payment
    except InvalidPaymentMethodError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except _CONFLICT_ERRORS as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc


@router.get("/jobs/{job_id}/payments", response_model=JobPaymentListResponse)
def job_payments(
    job_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> JobPaymentListResponse:
    job = _job_or_404(db, job_id)
    items, total = list_job_payments(db, job_id, page=page, page_size=page_size)
    snapshot = _balance_payload(db, job)
    return JobPaymentListResponse(
        items=[PaymentPublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        amount_due=snapshot["amount_due"],
        total_paid=snapshot["total_paid"],
        balance=snapshot["balance"],
        payment_status=snapshot["payment_status"],
    )


@router.get("/jobs/{job_id}/balance", response_model=JobBalancePublic)
def job_payment_balance(
    job_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobBalancePublic:
    job = _job_or_404(db, job_id)
    return JobBalancePublic(**_balance_payload(db, job))


@router.get("/payments", response_model=PaymentListResponse)
def list_directory(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    job_id: UUID | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    paid_from: datetime | None = Query(default=None),
    paid_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> PaymentListResponse:
    items, total = list_payments(
        db,
        job_id=job_id,
        payment_method=payment_method,
        paid_from=paid_from,
        paid_to=paid_to,
        page=page,
        page_size=page_size,
    )
    return PaymentListResponse(
        items=[PaymentPublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
