import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_missing_database_configuration_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_USER", raising=False)
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    monkeypatch.delenv("POSTGRES_DB", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_builds_sqlalchemy_url_from_postgres_parts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    settings = Settings(
        _env_file=None,
        postgres_user="madweb",
        postgres_password="change-me",
        postgres_db="madweb_crm",
        postgres_host="postgres",
        postgres_port=5432,
    )
    assert settings.sqlalchemy_database_uri == (
        "postgresql+psycopg://madweb:change-me@postgres:5432/madweb_crm"
    )


def test_database_url_override_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("POSTGRES_USER", raising=False)
    monkeypatch.delenv("POSTGRES_PASSWORD", raising=False)
    monkeypatch.delenv("POSTGRES_DB", raising=False)
    settings = Settings(
        _env_file=None,
        database_url="postgresql+psycopg://other:secret@db:5432/other",
    )
    assert settings.sqlalchemy_database_uri == (
        "postgresql+psycopg://other:secret@db:5432/other"
    )
