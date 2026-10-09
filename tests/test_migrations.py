from datetime import UTC, datetime
from decimal import Decimal

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
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
from tests.db_support import (
    MIGRATION_DB,
    alembic_config,
    database_url_for,
    recreate_database,
)

EXPECTED_TABLES = {
    "users",
    "customers",
    "print_categories",
    "workflow_stages",
    "jobs",
    "payments",
    "job_status_history",
}


def _upgrade(url: str) -> None:
    command.upgrade(alembic_config(url), "head")


def test_upgrade_from_empty_disposable_database(admin_engine: Engine) -> None:
    recreate_database(admin_engine, MIGRATION_DB)
    url = database_url_for(MIGRATION_DB)
    _upgrade(url)

    engine = create_engine(url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert EXPECTED_TABLES.issubset(tables)
        assert "alembic_version" in tables

        job_fks = {fk["name"] for fk in inspector.get_foreign_keys("jobs")}
        assert "fk_jobs_current_stage_same_category" in job_fks

        payment_fks = inspector.get_foreign_keys("payments")
        history_fks = inspector.get_foreign_keys("job_status_history")
        for fk in payment_fks + history_fks:
            assert fk["options"].get("ondelete", "RESTRICT") in {None, "RESTRICT"}

        with engine.connect() as connection:
            context = MigrationContext.configure(connection)
            diff = compare_metadata(context, Base.metadata)
        assert diff == [], diff
    finally:
        engine.dispose()


def test_upgrade_preserves_representative_rows(admin_engine: Engine) -> None:
    recreate_database(admin_engine, MIGRATION_DB)
    url = database_url_for(MIGRATION_DB)
    _upgrade(url)
    engine = create_engine(url)
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    session = SessionLocal()
    try:
        user = User(
            display_name="Owner",
            username="owner",
            password_hash="hashed",
            role=UserRole.ADMIN.value,
        )
        customer = Customer(name="Asha", phone="0987654321")
        category = PrintCategory(name="Banners")
        session.add_all([user, customer, category])
        session.flush()
        initial = WorkflowStage(
            category_id=category.id,
            name="Designing",
            sequence=1,
            is_initial=True,
        )
        final = WorkflowStage(
            category_id=category.id,
            name="Completed",
            sequence=2,
            is_final=True,
        )
        session.add_all([initial, final])
        session.flush()
        job = Job(
            job_number="JOB-1001",
            customer_id=customer.id,
            category_id=category.id,
            title="Shop banner",
            description="Vinyl banner",
            quantity=2,
            lead_status=LeadStatus.CONFIRMED.value,
            current_stage_id=initial.id,
            final_amount=Decimal("1500.00"),
        )
        session.add(job)
        session.flush()
        session.add(
            Payment(
                job_id=job.id,
                amount=Decimal("500.00"),
                payment_method="UPI",
                paid_at=datetime.now(UTC),
            )
        )
        session.add(
            JobStatusHistory(
                job_id=job.id,
                from_stage_id=None,
                to_stage_id=initial.id,
                updated_by_user_id=user.id,
            )
        )
        session.commit()
        job_id = job.id
        user_id = user.id
    finally:
        session.close()

    _upgrade(url)

    verify = SessionLocal()
    try:
        stored_job = verify.get(Job, job_id)
        assert stored_job is not None
        assert stored_job.job_number == "JOB-1001"
        assert len(stored_job.payments) == 1
        assert len(stored_job.status_history) == 1
        assert stored_job.status_history[0].updated_by_user_id == user_id
    finally:
        verify.close()
        engine.dispose()
