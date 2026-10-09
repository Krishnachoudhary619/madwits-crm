import logging
import time
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

engine = create_engine(
    settings.sqlalchemy_database_uri,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def wait_for_database() -> None:
    retries = settings.db_connect_retries
    delay = settings.db_connect_retry_delay_seconds
    last_error: Exception | None = None

    for attempt in range(1, retries + 1):
        try:
            check_database_connection()
            return
        except Exception as exc:
            last_error = exc
            logger.warning(
                "Database not ready (attempt %s/%s)",
                attempt,
                retries,
            )
            time.sleep(delay)

    raise RuntimeError("Database was not ready after retries") from last_error
