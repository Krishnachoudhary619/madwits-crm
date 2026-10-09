import os

os.environ["APP_ENV"] = "test"
os.environ.setdefault("POSTGRES_USER", "madweb")
os.environ.setdefault("POSTGRES_PASSWORD", "change-me")
os.environ.setdefault("POSTGRES_DB", "madweb_crm")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app


@pytest.fixture
def client() -> TestClient:
    get_settings.cache_clear()
    with TestClient(app) as test_client:
        yield test_client
