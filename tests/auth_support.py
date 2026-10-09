from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.models import User, UserRole


def unique_username(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


def seed_user(
    engine: Engine,
    *,
    username: str | None = None,
    password: str = "password12",
    role: str = UserRole.STAFF.value,
    display_name: str | None = None,
    is_active: bool = True,
) -> tuple[User, str]:
    username = username or unique_username(role.lower())
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    try:
        user = User(
            display_name=display_name or username,
            username=username,
            password_hash=hash_password(password),
            role=role,
            is_active=is_active,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)
        return user, password
    finally:
        session.close()


def login_header(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
