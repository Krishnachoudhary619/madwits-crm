from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Customer,
    Job,
    JobStatusHistory,
    LeadStatus,
    Payment,
    PrintCategory,
    User,
    UserRole,
    WorkflowStage,
)


def _user(username: str = "admin") -> User:
    return User(
        display_name="Admin User",
        username=username,
        password_hash="hashed-password",
        role=UserRole.ADMIN.value,
    )


def _category(name: str = "Visiting Cards") -> PrintCategory:
    return PrintCategory(name=name)


def test_valid_graph_can_be_persisted(db_session: Session) -> None:
    user = _user()
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([user, customer, category])
    db_session.flush()
    initial = WorkflowStage(
        category_id=category.id, name="Designing", sequence=1, is_initial=True
    )
    final = WorkflowStage(
        category_id=category.id, name="Completed", sequence=2, is_final=True
    )
    db_session.add_all([initial, final])
    db_session.flush()
    job = Job(
        job_number="JOB-1",
        customer_id=customer.id,
        category_id=category.id,
        title="Cards",
        description="500 visiting cards",
        quantity=500,
        lead_status=LeadStatus.NEW_INQUIRY.value,
    )
    db_session.add(job)
    db_session.flush()
    job.lead_status = LeadStatus.CONFIRMED.value
    job.current_stage_id = initial.id
    db_session.add(
        JobStatusHistory(
            job_id=job.id,
            to_stage_id=initial.id,
            updated_by_user_id=user.id,
        )
    )
    db_session.add(
        Payment(
            job_id=job.id,
            amount=Decimal("100.00"),
            payment_method="CASH",
            paid_at=datetime.now(UTC),
        )
    )
    db_session.flush()
    assert job.specifications == {}
    assert job.advance_amount == Decimal("0")


def test_invalid_role_is_rejected(db_session: Session) -> None:
    db_session.add(
        User(
            display_name="Bad",
            username="bad",
            password_hash="x",
            role="SUPERADMIN",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_invalid_lead_status_is_rejected(db_session: Session) -> None:
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([customer, category])
    db_session.flush()
    db_session.add(
        Job(
            job_number="JOB-BAD",
            customer_id=customer.id,
            category_id=category.id,
            title="x",
            description="x",
            quantity=1,
            lead_status="IN_PROGRESS",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_quantity_must_be_positive(db_session: Session) -> None:
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([customer, category])
    db_session.flush()
    db_session.add(
        Job(
            job_number="JOB-Q",
            customer_id=customer.id,
            category_id=category.id,
            title="x",
            description="x",
            quantity=0,
            lead_status=LeadStatus.NEW_INQUIRY.value,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_duplicate_active_category_name_is_rejected(db_session: Session) -> None:
    db_session.add(_category("Banners"))
    db_session.flush()
    db_session.add(_category("Banners"))
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_deactivated_category_name_can_be_reused(db_session: Session) -> None:
    original = _category("Stickers")
    original.is_active = False
    db_session.add(original)
    db_session.flush()
    db_session.add(_category("Stickers"))
    db_session.flush()


def test_at_most_one_active_initial_stage(db_session: Session) -> None:
    category = _category()
    db_session.add(category)
    db_session.flush()
    db_session.add(
        WorkflowStage(
            category_id=category.id, name="A", sequence=1, is_initial=True
        )
    )
    db_session.flush()
    db_session.add(
        WorkflowStage(
            category_id=category.id, name="B", sequence=2, is_initial=True
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_current_stage_must_belong_to_job_category(db_session: Session) -> None:
    customer = Customer(name="Ravi", phone="09123456789")
    banners = _category("Banners")
    cards = _category("Cards")
    db_session.add_all([customer, banners, cards])
    db_session.flush()
    banner_stage = WorkflowStage(
        category_id=banners.id, name="Printing", sequence=1, is_initial=True
    )
    db_session.add(banner_stage)
    db_session.flush()
    db_session.add(
        Job(
            job_number="JOB-X",
            customer_id=customer.id,
            category_id=cards.id,
            title="x",
            description="x",
            quantity=1,
            lead_status=LeadStatus.CONFIRMED.value,
            current_stage_id=banner_stage.id,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_history_and_payments_are_not_cascade_deleted(db_session: Session) -> None:
    user = _user("staff1")
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([user, customer, category])
    db_session.flush()
    stage = WorkflowStage(
        category_id=category.id, name="Designing", sequence=1, is_initial=True
    )
    db_session.add(stage)
    db_session.flush()
    job = Job(
        job_number="JOB-DEL",
        customer_id=customer.id,
        category_id=category.id,
        title="x",
        description="x",
        quantity=1,
        lead_status=LeadStatus.CONFIRMED.value,
        current_stage_id=stage.id,
    )
    db_session.add(job)
    db_session.flush()
    db_session.add(
        Payment(
            job_id=job.id,
            amount=Decimal("10.00"),
            payment_method="CASH",
            paid_at=datetime.now(UTC),
        )
    )
    db_session.add(
        JobStatusHistory(
            job_id=job.id,
            to_stage_id=stage.id,
            updated_by_user_id=user.id,
        )
    )
    db_session.flush()

    db_session.delete(job)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_user_with_history_cannot_be_deleted(db_session: Session) -> None:
    user = _user("keep-me")
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([user, customer, category])
    db_session.flush()
    stage = WorkflowStage(
        category_id=category.id, name="Designing", sequence=1, is_initial=True
    )
    db_session.add(stage)
    db_session.flush()
    job = Job(
        job_number="JOB-H",
        customer_id=customer.id,
        category_id=category.id,
        title="x",
        description="x",
        quantity=1,
        lead_status=LeadStatus.CONFIRMED.value,
        current_stage_id=stage.id,
    )
    db_session.add(job)
    db_session.flush()
    db_session.add(
        JobStatusHistory(
            job_id=job.id,
            to_stage_id=stage.id,
            updated_by_user_id=user.id,
        )
    )
    db_session.flush()
    db_session.delete(user)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_inactive_user_history_reference_is_preserved(db_session: Session) -> None:
    user = _user("later-inactive")
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([user, customer, category])
    db_session.flush()
    stage = WorkflowStage(
        category_id=category.id, name="Designing", sequence=1, is_initial=True
    )
    db_session.add(stage)
    db_session.flush()
    job = Job(
        job_number="JOB-I",
        customer_id=customer.id,
        category_id=category.id,
        title="x",
        description="x",
        quantity=1,
        lead_status=LeadStatus.CONFIRMED.value,
        current_stage_id=stage.id,
    )
    db_session.add(job)
    db_session.flush()
    history = JobStatusHistory(
        job_id=job.id,
        to_stage_id=stage.id,
        updated_by_user_id=user.id,
    )
    db_session.add(history)
    db_session.flush()
    user.is_active = False
    db_session.flush()
    db_session.refresh(history)
    assert history.updated_by_user_id == user.id


def test_phone_need_not_be_unique(db_session: Session) -> None:
    db_session.add_all(
        [
            Customer(name="A", phone="09000000000"),
            Customer(name="B", phone="09000000000"),
        ]
    )
    db_session.flush()


def test_payment_amount_must_be_positive(db_session: Session) -> None:
    user = _user("pay")
    customer = Customer(name="Ravi", phone="09123456789")
    category = _category()
    db_session.add_all([user, customer, category])
    db_session.flush()
    stage = WorkflowStage(
        category_id=category.id, name="Designing", sequence=1, is_initial=True
    )
    db_session.add(stage)
    db_session.flush()
    job = Job(
        job_number="JOB-P",
        customer_id=customer.id,
        category_id=category.id,
        title="x",
        description="x",
        quantity=1,
        lead_status=LeadStatus.NEW_INQUIRY.value,
    )
    db_session.add(job)
    db_session.flush()
    db_session.add(
        Payment(
            job_id=job.id,
            amount=Decimal("0.00"),
            payment_method="CASH",
            paid_at=datetime.now(UTC),
        )
    )
    with pytest.raises(IntegrityError):
        db_session.flush()
