from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    JobsByCategoryResponse,
    JobsByStageResponse,
    PaymentsSummaryResponse,
)
from app.services.dashboard_service import (
    jobs_by_category,
    jobs_by_stage,
    payments_summary,
    summary,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
) -> DashboardSummaryResponse:
    try:
        return DashboardSummaryResponse(**summary(db, from_date=from_date, to_date=to_date))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("/jobs-by-stage", response_model=JobsByStageResponse)
def dashboard_jobs_by_stage(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobsByStageResponse:
    return JobsByStageResponse(items=jobs_by_stage(db))


@router.get("/jobs-by-category", response_model=JobsByCategoryResponse)
def dashboard_jobs_by_category(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> JobsByCategoryResponse:
    return JobsByCategoryResponse(items=jobs_by_category(db))


@router.get("/payments-summary", response_model=PaymentsSummaryResponse)
def dashboard_payments_summary(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
) -> PaymentsSummaryResponse:
    try:
        return PaymentsSummaryResponse(
            **payments_summary(db, from_date=from_date, to_date=to_date)
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
