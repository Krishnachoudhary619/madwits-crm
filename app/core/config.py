from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Madweb CRM"
    app_env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    postgres_user: str | None = None
    postgres_password: str | None = None
    postgres_db: str | None = None
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    database_url: str | None = Field(default=None)

    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 720
    shop_timezone: str = "Asia/Kolkata"

    db_connect_retries: int = 10
    db_connect_retry_delay_seconds: float = 1.0

    @model_validator(mode="after")
    def require_database_configuration(self) -> "Settings":
        has_url = bool(self.database_url)
        has_parts = all(
            [self.postgres_user, self.postgres_password, self.postgres_db]
        )
        if not has_url and not has_parts:
            raise ValueError(
                "Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB."
            )
        try:
            ZoneInfo(self.shop_timezone)
        except ZoneInfoNotFoundError as exc:
            raise ValueError(
                f"SHOP_TIMEZONE is not a valid IANA timezone: {self.shop_timezone}"
            ) from exc
        return self

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return URL.create(
            drivername="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=self.postgres_db,
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
