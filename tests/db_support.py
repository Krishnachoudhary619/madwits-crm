from pathlib import Path

from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import Engine, make_url

from app.core.config import get_settings

ROOT = Path(__file__).resolve().parents[1]
TEST_SCHEMA_DB = "madweb_crm_test"
MIGRATION_DB = "madweb_crm_migration_test"


def database_url_for(database: str) -> str:
    settings = get_settings()
    url = make_url(settings.sqlalchemy_database_uri)
    return url.set(database=database).render_as_string(hide_password=False)


def maintenance_url() -> str:
    settings = get_settings()
    url = make_url(settings.sqlalchemy_database_uri)
    return url.set(database="postgres").render_as_string(hide_password=False)


def alembic_config(database_url: str) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def recreate_database(admin_engine: Engine, database: str) -> None:
    with admin_engine.connect() as connection:
        connection.execute(text(f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)'))
        connection.execute(text(f'CREATE DATABASE "{database}"'))
