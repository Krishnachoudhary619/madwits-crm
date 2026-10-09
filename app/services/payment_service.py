from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.money import ZERO_MONEY, as_money
from app.models import PAYMENT_METHODS, Job, LeadStatus, Payment, PaymentStatus
from app.services.exceptions import (
    InvalidPaymentMethodError,
    OverpaymentError,
    PaymentNotAllowedError,
)
from app.services.job_service import get_job


def total_paid_for_job(db: Session, job_id: UUID) -> Decimal:
    total = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.job_id == job_id
        )
    )
    return as_money(total)


def amount_due_for_job(job: Job) -> Decimal:
    if job.lead_status != LeadStatus.CONFIRMED.value:
        return ZERO_MONEY
    return as_money(job.final_amount)


def derive_payment_status(amount_due: Decimal, total_paid: Decimal) -> PaymentStatus:
    due = as_money(amount_due)
    paid = as_money(total_paid)
    if paid == ZERO_MONEY and due > ZERO_MONEY:
        return PaymentStatus.UNPAID
    if paid == due:
        return PaymentStatus.PAID
    if ZERO_MONEY < paid < due:
        return PaymentStatus.PARTIALLY_PAID
    raise OverpaymentError("Recorded payments exceed the amount due.")


def job_balance(db: Session, job: Job) -> dict[str, Decimal | PaymentStatus]:
    paid = total_paid_for_job(db, job.id)
    if job.lead_status != LeadStatus.CONFIRMED.value:
        return {
            "amount_due": ZERO_MONEY,
            "total_paid": paid,
            "balance": ZERO_MONEY,
            "payment_status": PaymentStatus.UNPAID,
        }
    due = amount_due_for_job(job)
    return {
        "amount_due": due,
        "total_paid": paid,
        "balance": due - paid,
        "payment_status": derive_payment_status(due, paid),
    }


def create_payment(
    db: Session,
    job: Job,
    *,
    amount: Decimal,
    payment_method: str,
    paid_at: datetime,
    reference_number: str | None = None,
    notes: str | None = None,
) -> Payment:
    if job.lead_status != LeadStatus.CONFIRMED.value:
        raise PaymentNotAllowedError(
            "Payments can be recorded only on confirmed jobs."
        )
    method = payment_method.strip().upper()
    if method not in PAYMENT_METHODS:
        raise InvalidPaymentMethodError(
            "Payment method must be CASH, UPI, or BANK_TRANSFER."
        )
    payment_amount = as_money(amount)
    due = amount_due_for_job(job)
    paid = total_paid_for_job(db, job.id)
    if paid + payment_amount > due:
        raise OverpaymentError(
            "This payment would exceed the outstanding balance. "
            "Overpayments and refunds are not accepted."
        )
    payment = Payment(
        job_id=job.id,
        amount=payment_amount,
        payment_method=method,
        paid_at=paid_at,
        reference_number=reference_number.strip() if reference_number else None,
        notes=notes.strip() if notes else None,
    )
    db.add(payment)
    db.flush()
    db.refresh(payment)
    return payment


def list_job_payments(
    db: Session,
    job_id: UUID,
    *,
    page: int,
    page_size: int,
) -> tuple[list[Payment], int]:
    filters = Payment.job_id == job_id
    total = int(db.scalar(select(func.count()).select_from(Payment).where(filters)) or 0)
    items = list(
        db.scalars(
            select(Payment)
            .where(filters)
            .order_by(Payment.paid_at.asc(), Payment.created_at.asc(), Payment.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, total


def list_payments(
    db: Session,
    *,
    job_id: UUID | None,
    payment_method: str | None,
    paid_from: datetime | None,
    paid_to: datetime | None,
    page: int,
    page_size: int,
) -> tuple[list[Payment], int]:
    stmt = select(Payment)
    count_stmt = select(func.count()).select_from(Payment)
    if job_id is not None:
        stmt = stmt.where(Payment.job_id == job_id)
        count_stmt = count_stmt.where(Payment.job_id == job_id)
    if payment_method is not None:
        stmt = stmt.where(Payment.payment_method == payment_method)
        count_stmt = count_stmt.where(Payment.payment_method == payment_method)
    if paid_from is not None:
        stmt = stmt.where(Payment.paid_at >= paid_from)
        count_stmt = count_stmt.where(Payment.paid_at >= paid_from)
    if paid_to is not None:
        stmt = stmt.where(Payment.paid_at < paid_to)
        count_stmt = count_stmt.where(Payment.paid_at < paid_to)
    total = int(db.scalar(count_stmt) or 0)
    items = list(
        db.scalars(
            stmt.order_by(Payment.paid_at.desc(), Payment.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, total


def require_job_for_payment(
    db: Session, job_id: UUID, *, for_update: bool = False
) -> Job | None:
    return get_job(db, job_id, for_update=for_update)
