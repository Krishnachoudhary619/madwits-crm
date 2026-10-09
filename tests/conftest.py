import os
from collections.abc import Generator

os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET"] = "test-jwt-secret-not-for-production"
os.environ.setdefault("POSTGRES_USER", "madweb")
os.environ.setdefault("POSTGRES_PASSWORD", "change-me")
os.environ.setdefault("POSTGRES_DB", "madweb_crm")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("SHOP_TIMEZONE", "Asia/Kolkata")

import pytest
from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.session import get_db
from app.main import app
from tests.db_support import (
    TEST_SCHEMA_DB,
    alembic_config,
    database_url_for,
    maintenance_url,
    recreate_database,
)


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def admin_engine() -> Generator[Engine, None, None]:
    engine = create_engine(maintenance_url(), isolation_level="AUTOCOMMIT")
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture(scope="session")
def schema_engine(admin_engine: Engine) -> Generator[Engine, None, None]:
    recreate_database(admin_engine, TEST_SCHEMA_DB)
    url = database_url_for(TEST_SCHEMA_DB)
    command.upgrade(alembic_config(url), "head")
    engine = create_engine(url, pool_pre_ping=True)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def db_session(schema_engine: Engine) -> Generator[Session, None, None]:
    connection = schema_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, autoflush=False, expire_on_commit=False)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def api_client(schema_engine: Engine) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        session = sessionmaker(
            bind=schema_engine, autoflush=False, expire_on_commit=False
        )()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
