from datetime import date
from decimal import Decimal

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dates import day_bounds, inclusive_period, shop_today, shop_zone
from app.core.money import as_money, as_rate, format_money
from app.models import Job, JobStatusHistory, LeadStatus, Payment, PrintCategory, WorkflowStage

OPEN_INQUIRY_STATUSES = (
    LeadStatus.NEW_INQUIRY.value,
    LeadStatus.QUOTATION_PREPARED.value,
    LeadStatus.AWAITING_CONFIRMATION.value,
)
QUOTATION_PIPELINE_STATUSES = (
    LeadStatus.QUOTATION_PREPARED.value,
    LeadStatus.AWAITING_CONFIRMATION.value,
)
CLOSED_LEAD_STATUSES = (LeadStatus.LOST.value, LeadStatus.CANCELLED.value)


def _count_jobs(db: Session, *clauses) -> int:
    stmt = select(func.count()).select_from(Job)
    for clause in clauses:
        stmt = stmt.where(clause)
    return int(db.scalar(stmt) or 0)


def _sum_money(db: Session, stmt) -> Decimal:
    return as_money(db.scalar(stmt))


def period_payload(from_date: date | None, to_date: date | None) -> dict:
    start, end, start_day, end_day = inclusive_period(from_date, to_date)
    return {
        "timezone": get_settings().shop_timezone,
        "from_date": start_day,
        "to_date": end_day,
        "start_at": start,
        "end_at": end,
    }


def _in_production_clause():
    return and_(
        Job.lead_status == LeadStatus.CONFIRMED.value,
        or_(WorkflowStage.id.is_(None), WorkflowStage.is_final.is_(False)),
    )


def _completed_clause():
    return and_(
        Job.lead_status == LeadStatus.CONFIRMED.value,
        WorkflowStage.is_final.is_(True),
    )


def _completed_in_period_count(db: Session, start, end) -> int:
    completion_times = (
        select(
            JobStatusHistory.job_id,
            func.max(JobStatusHistory.created_at).label("completed_at"),
        )
        .join(Job, Job.id == JobStatusHistory.job_id)
        .where(JobStatusHistory.to_stage_id == Job.current_stage_id)
        .group_by(JobStatusHistory.job_id)
        .subquery()
    )
    stmt = (
        select(func.count())
        .select_from(Job)
        .join(WorkflowStage, Job.current_stage_id == WorkflowStage.id)
        .join(completion_times, completion_times.c.job_id == Job.id)
        .where(
            Job.lead_status == LeadStatus.CONFIRMED.value,
            WorkflowStage.is_final.is_(True),
            completion_times.c.completed_at >= start,
            completion_times.c.completed_at < end,
        )
    )
    return int(db.scalar(stmt) or 0)


def summary(db: Session, *, from_date: date | None, to_date: date | None) -> dict:
    period = period_payload(from_date, to_date)
    start, end = period["start_at"], period["end_at"]
    today_start, tomorrow_start = day_bounds(shop_today(), shop_zone())
    follow_up_active = Job.lead_status.notin_(CLOSED_LEAD_STATUSES)

    paid_subq = (
        select(
            Payment.job_id,
            func.coalesce(func.sum(Payment.amount), 0).label("paid"),
        )
        .group_by(Payment.job_id)
        .subquery()
    )
    outstanding = _sum_money(
        db,
        select(
            func.coalesce(
                func.sum(Job.final_amount - func.coalesce(paid_subq.c.paid, 0)),
                0,
            )
        )
        .select_from(Job)
        .outerjoin(paid_subq, paid_subq.c.job_id == Job.id)
        .where(
            Job.lead_status == LeadStatus.CONFIRMED.value,
            Job.final_amount.is_not(None),
        ),
    )
    pipeline = _sum_money(
        db,
        select(func.coalesce(func.sum(Job.quoted_amount), 0)).where(
            Job.lead_status.in_(QUOTATION_PIPELINE_STATUSES),
            Job.quoted_amount.is_not(None),
        ),
    )
    received = _sum_money(
        db,
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.paid_at >= start,
            Payment.paid_at < end,
        ),
    )
    in_production = int(
        db.scalar(
            select(func.count())
            .select_from(Job)
            .outerjoin(WorkflowStage, Job.current_stage_id == WorkflowStage.id)
            .where(_in_production_clause())
        )
        or 0
    )
    created = _count_jobs(db, Job.created_at >= start, Job.created_at < end)
    confirmed_created = _count_jobs(
        db,
        Job.created_at >= start,
        Job.created_at < end,
        Job.lead_status == LeadStatus.CONFIRMED.value,
    )
    return {
        "period": period,
        "open_inquiries": _count_jobs(db, Job.lead_status.in_(OPEN_INQUIRY_STATUSES)),
        "quotations_awaiting_confirmation": _count_jobs(
            db, Job.lead_status == LeadStatus.AWAITING_CONFIRMATION.value
        ),
        "follow_ups_due_today": _count_jobs(
            db,
            follow_up_active,
            Job.next_follow_up_at.is_not(None),
            Job.next_follow_up_at >= today_start,
            Job.next_follow_up_at < tomorrow_start,
        ),
        "follow_ups_overdue": _count_jobs(
            db,
            follow_up_active,
            Job.next_follow_up_at.is_not(None),
            Job.next_follow_up_at < today_start,
        ),
        "in_production": in_production,
        "completed_in_period": _completed_in_period_count(db, start, end),
        "jobs_created_in_period": created,
        "confirmed_created_in_period": confirmed_created,
        "conversion_rate": format(as_rate(confirmed_created, created), "f"),
        "open_quotation_pipeline_value": format_money(pipeline),
        "payments_received_in_period": format_money(received),
        "outstanding_balance": format_money(outstanding),
    }


def jobs_by_stage(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            WorkflowStage.id,
            WorkflowStage.name,
            PrintCategory.id,
            PrintCategory.name,
            func.count(Job.id),
        )
        .select_from(WorkflowStage)
        .join(PrintCategory, PrintCategory.id == WorkflowStage.category_id)
        .outerjoin(
            Job,
            and_(
                Job.current_stage_id == WorkflowStage.id,
                Job.lead_status == LeadStatus.CONFIRMED.value,
            ),
        )
        .where(WorkflowStage.is_active.is_(True))
        .group_by(
            WorkflowStage.id,
            WorkflowStage.name,
            WorkflowStage.sequence,
            PrintCategory.id,
            PrintCategory.name,
        )
        .order_by(PrintCategory.name.asc(), WorkflowStage.sequence.asc())
    ).all()
    return [
        {
            "stage_id": stage_id,
            "stage_name": stage_name,
            "category_id": category_id,
            "category_name": category_name,
            "job_count": int(count),
        }
        for stage_id, stage_name, category_id, category_name, count in rows
    ]


def jobs_by_category(db: Session) -> list[dict]:
    rows = db.execute(
        select(
            PrintCategory.id,
            PrintCategory.name,
            func.count(Job.id),
            func.count(case((Job.lead_status == LeadStatus.CONFIRMED.value, Job.id))),
            func.count(case((_in_production_clause(), Job.id))),
            func.count(case((_completed_clause(), Job.id))),
        )
        .select_from(PrintCategory)
        .outerjoin(Job, Job.category_id == PrintCategory.id)
        .outerjoin(WorkflowStage, Job.current_stage_id == WorkflowStage.id)
        .group_by(PrintCategory.id, PrintCategory.name)
        .order_by(PrintCategory.name.asc())
    ).all()
    return [
        {
            "category_id": category_id,
            "category_name": category_name,
            "job_count": int(job_count),
            "confirmed_count": int(confirmed_count),
            "in_production_count": int(in_production_count),
            "completed_count": int(completed_count),
        }
        for (
            category_id,
            category_name,
            job_count,
            confirmed_count,
            in_production_count,
            completed_count,
        ) in rows
    ]


def payments_summary(
    db: Session, *, from_date: date | None, to_date: date | None
) -> dict:
    period = period_payload(from_date, to_date)
    start, end = period["start_at"], period["end_at"]
    filters = (Payment.paid_at >= start, Payment.paid_at < end)
    total_count = int(
        db.scalar(
            select(func.count()).select_from(Payment).where(*filters)
        )
        or 0
    )
    total_received = _sum_money(
        db,
        select(func.coalesce(func.sum(Payment.amount), 0)).where(*filters),
    )
    rows = db.execute(
        select(
            Payment.payment_method,
            func.count(Payment.id),
            func.coalesce(func.sum(Payment.amount), 0),
        )
        .where(*filters)
        .group_by(Payment.payment_method)
        .order_by(Payment.payment_method.asc())
    ).all()
    return {
        "period": period,
        "payment_count": total_count,
        "total_received": format_money(total_received),
        "by_method": [
            {
                "payment_method": method,
                "payment_count": int(count),
                "total_amount": format_money(amount),
            }
            for method, count, amount in rows
        ],
    }
