from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.customer import (
    CustomerCreateRequest,
    CustomerJobListResponse,
    CustomerJobSummary,
    CustomerListResponse,
    CustomerPublic,
    CustomerUpdateRequest,
)
from app.services.customer_service import (
    CUSTOMER_SORT_FIELDS,
    create_customer,
    get_customer,
    list_customer_jobs,
    list_customers,
    update_customer,
)

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("", response_model=CustomerPublic, status_code=status.HTTP_201_CREATED)
def create(
    payload: CustomerCreateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomerPublic:
    customer = create_customer(
        db,
        name=payload.name,
        phone=payload.phone,
        business_name=payload.business_name,
        address=payload.address,
        notes=payload.notes,
    )
    db.commit()
    db.refresh(customer)
    return customer


@router.get("", response_model=CustomerListResponse)
def list_directory(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    sort: str = Query(default="created_at"),
    order: str = Query(default="desc"),
) -> CustomerListResponse:
    if sort not in CUSTOMER_SORT_FIELDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported sort field.",
        )
    if order.lower() not in {"asc", "desc"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported sort order.",
        )
    items, total = list_customers(
        db, q=q, page=page, page_size=page_size, sort=sort, order=order
    )
    return CustomerListResponse(
        items=[CustomerPublic.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{customer_id}", response_model=CustomerPublic)
def get_one(
    customer_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomerPublic:
    customer = get_customer(db, customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found."
        )
    return customer


@router.patch("/{customer_id}", response_model=CustomerPublic)
def patch(
    customer_id: UUID,
    payload: CustomerUpdateRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomerPublic:
    customer = get_customer(db, customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found."
        )
    updated = update_customer(
        db,
        customer,
        name=payload.name,
        phone=payload.phone,
        business_name=payload.business_name,
        address=payload.address,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    db.commit()
    db.refresh(updated)
    return updated


@router.get("/{customer_id}/jobs", response_model=CustomerJobListResponse)
def list_jobs(
    customer_id: UUID,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> CustomerJobListResponse:
    customer = get_customer(db, customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found."
        )
    items, total = list_customer_jobs(
        db, customer_id, page=page, page_size=page_size
    )
    return CustomerJobListResponse(
        items=[CustomerJobSummary.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
