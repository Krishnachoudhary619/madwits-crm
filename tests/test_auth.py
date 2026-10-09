import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models import User, UserRole
from app.services.exceptions import (
    AdminAlreadyExistsError,
    InactiveAttributionUserError,
)
from app.services.user_service import (
    provision_initial_admin,
    require_active_attribution_user,
)
from tests.auth_support import login_header, seed_user, unique_username


def test_login_rejects_unknown_user(api_client: TestClient) -> None:
    response = api_client.post(
        "/api/v1/auth/login",
        json={"username": "missing", "password": "password12"},
    )
    assert response.status_code == 401
    assert "password_hash" not in response.text
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_login_and_me_for_admin_and_staff(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, password = seed_user(schema_engine, role=UserRole.ADMIN.value)
    staff, staff_password = seed_user(schema_engine, role=UserRole.STAFF.value)

    admin_headers = login_header(api_client, admin.username, password)
    me = api_client.get("/api/v1/auth/me", headers=admin_headers)
    assert me.status_code == 200
    body = me.json()
    assert body["id"] == str(admin.id)
    assert body["role"] == UserRole.ADMIN.value
    assert "password_hash" not in body

    staff_headers = login_header(api_client, staff.username, staff_password)
    staff_me = api_client.get("/api/v1/auth/me", headers=staff_headers)
    assert staff_me.status_code == 200
    assert staff_me.json()["role"] == UserRole.STAFF.value


def test_inactive_user_cannot_login(
    api_client: TestClient, schema_engine: Engine
) -> None:
    user, password = seed_user(schema_engine, is_active=False)
    response = api_client.post(
        "/api/v1/auth/login",
        json={"username": user.username, "password": password},
    )
    assert response.status_code == 401


def test_deactivated_user_token_is_rejected(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, admin_password = seed_user(schema_engine, role=UserRole.ADMIN.value)
    staff, staff_password = seed_user(schema_engine, role=UserRole.STAFF.value)
    staff_headers = login_header(api_client, staff.username, staff_password)
    admin_headers = login_header(api_client, admin.username, admin_password)

    patched = api_client.patch(
        f"/api/v1/users/{staff.id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert patched.status_code == 200
    rejected = api_client.get("/api/v1/auth/me", headers=staff_headers)
    assert rejected.status_code == 401


def test_unauthenticated_me_is_rejected(api_client: TestClient) -> None:
    response = api_client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_logout_requires_auth_and_returns_no_content(
    api_client: TestClient, schema_engine: Engine
) -> None:
    assert api_client.post("/api/v1/auth/logout").status_code == 401
    user, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    headers = login_header(api_client, user.username, password)
    response = api_client.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 204


def test_admin_can_create_staff(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, password = seed_user(schema_engine, role=UserRole.ADMIN.value)
    headers = login_header(api_client, admin.username, password)
    username = unique_username("newstaff")
    response = api_client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "display_name": "Counter",
            "username": username,
            "password": "password12",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == UserRole.STAFF.value
    assert body["username"] == username
    assert "password_hash" not in body


def test_staff_cannot_create_or_list_or_patch_users(
    api_client: TestClient, schema_engine: Engine
) -> None:
    staff, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    other, _ = seed_user(schema_engine, role=UserRole.STAFF.value)
    headers = login_header(api_client, staff.username, password)

    created = api_client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "display_name": "Nope",
            "username": unique_username("blocked"),
            "password": "password12",
        },
    )
    listed = api_client.get("/api/v1/users", headers=headers)
    patched = api_client.patch(
        f"/api/v1/users/{other.id}",
        headers=headers,
        json={"is_active": False},
    )
    assert created.status_code == 403
    assert listed.status_code == 403
    assert patched.status_code == 403
    assert created.json()["error"]["code"] == "FORBIDDEN"


def test_client_cannot_create_admin_via_role_field(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, password = seed_user(schema_engine, role=UserRole.ADMIN.value)
    headers = login_header(api_client, admin.username, password)
    response = api_client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "display_name": "Hacker",
            "username": unique_username("hacker"),
            "password": "password12",
            "role": "ADMIN",
        },
    )
    assert response.status_code == 422


def test_attribution_header_does_not_grant_admin(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, _ = seed_user(schema_engine, role=UserRole.ADMIN.value)
    staff, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    headers = login_header(api_client, staff.username, password)
    headers["X-Attribution-User-Id"] = str(admin.id)
    response = api_client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "display_name": "Still blocked",
            "username": unique_username("blocked2"),
            "password": "password12",
        },
    )
    assert response.status_code == 403


def test_staff_and_admin_can_read_attribution_options(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, admin_password = seed_user(
        schema_engine, role=UserRole.ADMIN.value, display_name="Owner"
    )
    staff, staff_password = seed_user(
        schema_engine, role=UserRole.STAFF.value, display_name="Printer"
    )
    inactive, _ = seed_user(
        schema_engine,
        role=UserRole.STAFF.value,
        display_name="Gone",
        is_active=False,
    )

    for user, password in ((admin, admin_password), (staff, staff_password)):
        headers = login_header(api_client, user.username, password)
        response = api_client.get(
            "/api/v1/users/attribution-options", headers=headers
        )
        assert response.status_code == 200
        payload = response.json()
        ids = {item["id"] for item in payload}
        assert str(admin.id) in ids
        assert str(staff.id) in ids
        assert str(inactive.id) not in ids
        assert all("password_hash" not in item for item in payload)


def test_admin_directory_includes_inactive_users(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, password = seed_user(schema_engine, role=UserRole.ADMIN.value)
    inactive, _ = seed_user(schema_engine, is_active=False)
    headers = login_header(api_client, admin.username, password)
    response = api_client.get("/api/v1/users", headers=headers)
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert str(admin.id) in ids
    assert str(inactive.id) in ids


def test_last_active_admin_cannot_be_deactivated(
    api_client: TestClient, schema_engine: Engine
) -> None:
    admin, password = seed_user(schema_engine, role=UserRole.ADMIN.value)
    session = sessionmaker(bind=schema_engine)()
    try:
        others = session.scalars(
            select(User).where(
                User.role == UserRole.ADMIN.value,
                User.id != admin.id,
                User.is_active.is_(True),
            )
        ).all()
        for other in others:
            other.is_active = False
        session.commit()
    finally:
        session.close()
    headers = login_header(api_client, admin.username, password)
    response = api_client.patch(
        f"/api/v1/users/{admin.id}",
        headers=headers,
        json={"is_active": False},
    )
    assert response.status_code == 409


def test_inactive_attribution_user_is_rejected(db_session: Session) -> None:
    user = User(
        display_name="Inactive",
        username=unique_username("inactive"),
        password_hash="hashed",
        role=UserRole.STAFF.value,
        is_active=False,
    )
    db_session.add(user)
    db_session.flush()
    with pytest.raises(InactiveAttributionUserError):
        require_active_attribution_user(db_session, user.id)


def test_second_admin_provisioning_fails(db_session: Session) -> None:
    db_session.add(
        User(
            display_name="Existing",
            username=unique_username("owner"),
            password_hash="hashed",
            role=UserRole.ADMIN.value,
        )
    )
    db_session.flush()
    with pytest.raises(AdminAlreadyExistsError):
        provision_initial_admin(
            db_session,
            username=unique_username("owner2"),
            password="password12",
            display_name="Other",
        )


def test_health_remains_public(api_client: TestClient) -> None:
    assert api_client.get("/health").status_code == 200
