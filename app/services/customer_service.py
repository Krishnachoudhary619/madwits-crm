from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Customer, Job

CUSTOMER_SORT_FIELDS = {
    "name": Customer.name,
    "phone": Customer.phone,
    "created_at": Customer.created_at,
}


def get_customer(db: Session, customer_id: UUID) -> Customer | None:
    return db.get(Customer, customer_id)


def create_customer(
    db: Session,
    *,
    name: str,
    phone: str,
    business_name: str | None = None,
    address: str | None = None,
    notes: str | None = None,
) -> Customer:
    customer = Customer(
        name=name.strip(),
        phone=phone.strip(),
        business_name=business_name.strip() if business_name else None,
        address=address.strip() if address else None,
        notes=notes.strip() if notes else None,
    )
    db.add(customer)
    db.flush()
    db.refresh(customer)
    return customer


def list_customers(
    db: Session,
    *,
    q: str | None,
    page: int,
    page_size: int,
    sort: str,
    order: str,
) -> tuple[list[Customer], int]:
    stmt = select(Customer)
    count_stmt = select(func.count()).select_from(Customer)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        search = or_(Customer.name.ilike(pattern), Customer.phone.ilike(pattern))
        stmt = stmt.where(search)
        count_stmt = count_stmt.where(search)

    sort_column = CUSTOMER_SORT_FIELDS.get(sort, Customer.created_at)
    if order.lower() == "asc":
        stmt = stmt.order_by(sort_column.asc(), Customer.id.asc())
    else:
        stmt = stmt.order_by(sort_column.desc(), Customer.id.desc())

    total = int(db.scalar(count_stmt) or 0)
    items = list(
        db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    )
    return items, total


def update_customer(
    db: Session,
    customer: Customer,
    *,
    name: str | None = None,
    phone: str | None = None,
    business_name: str | None = None,
    address: str | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
) -> Customer:
    if name is not None:
        customer.name = name.strip()
    if phone is not None:
        customer.phone = phone.strip()
    if business_name is not None:
        customer.business_name = business_name.strip() or None
    if address is not None:
        customer.address = address.strip() or None
    if notes is not None:
        customer.notes = notes.strip() or None
    if is_active is not None:
        customer.is_active = is_active
    db.flush()
    db.refresh(customer)
    return customer


def list_customer_jobs(
    db: Session,
    customer_id: UUID,
    *,
    page: int,
    page_size: int,
) -> tuple[list[Job], int]:
    filters = Job.customer_id == customer_id
    total = int(
        db.scalar(select(func.count()).select_from(Job).where(filters)) or 0
    )
    items = list(
        db.scalars(
            select(Job)
            .where(filters)
            .order_by(Job.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, total
