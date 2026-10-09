from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.models import Job, LeadStatus, UserRole
from tests.auth_support import login_header, seed_user, unique_username


def _staff_headers(api_client: TestClient, schema_engine: Engine) -> dict[str, str]:
    user, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    return login_header(api_client, user.username, password)


def test_unauthenticated_customer_routes_are_rejected(api_client: TestClient) -> None:
    assert api_client.get("/api/v1/customers").status_code == 401
    assert (
        api_client.post(
            "/api/v1/customers",
            json={"name": "Asha", "phone": "09000000000"},
        ).status_code
        == 401
    )


def test_staff_can_create_search_and_update_customers(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _staff_headers(api_client, schema_engine)
    marker = unique_username("cust")
    created = api_client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "name": f"Asha {marker}",
            "phone": f"09876{marker[-4:]}",
            "business_name": "Asha Prints",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"].startswith("Asha")
    assert body["phone"].startswith("09876")
    assert body["is_active"] is True

    duplicate_phone = api_client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": f"Ravi {marker}", "phone": body["phone"]},
    )
    assert duplicate_phone.status_code == 201

    found = api_client.get(
        "/api/v1/customers",
        headers=headers,
        params={"q": marker, "sort": "name", "order": "asc", "page_size": 10},
    )
    assert found.status_code == 200
    names = [item["name"] for item in found.json()["items"]]
    assert any(marker in name for name in names)
    assert found.json()["total"] >= 2

    by_phone = api_client.get(
        "/api/v1/customers", headers=headers, params={"q": body["phone"]}
    )
    assert by_phone.status_code == 200
    assert by_phone.json()["total"] >= 2

    customer_id = body["id"]
    patched = api_client.patch(
        f"/api/v1/customers/{customer_id}",
        headers=headers,
        json={"notes": "Prefers matte finish", "is_active": False},
    )
    assert patched.status_code == 200
    assert patched.json()["notes"] == "Prefers matte finish"
    assert patched.json()["is_active"] is False

    detail = api_client.get(f"/api/v1/customers/{customer_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["id"] == customer_id


def test_customer_validation_and_not_found(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _staff_headers(api_client, schema_engine)
    invalid = api_client.post(
        "/api/v1/customers", headers=headers, json={"name": "", "phone": "1"}
    )
    assert invalid.status_code == 422
    missing = api_client.get(f"/api/v1/customers/{uuid4()}", headers=headers)
    assert missing.status_code == 404
    assert (
        api_client.delete("/api/v1/customers/" + str(uuid4()), headers=headers).status_code
        == 405
    )


def test_customer_jobs_list_supports_multiple_jobs(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _staff_headers(api_client, schema_engine)
    customer = api_client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": unique_username("jobs"), "phone": "09111111111"},
    ).json()
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("cat")},
    ).json()

    session = sessionmaker(bind=schema_engine, expire_on_commit=False)()
    try:
        for index in range(2):
            session.add(
                Job(
                    job_number=f"JOB-{uuid4().hex[:8]}",
                    customer_id=customer["id"],
                    category_id=category["id"],
                    title=f"Job {index}",
                    description="Created in Phase 4 customer test",
                    quantity=1,
                    lead_status=LeadStatus.NEW_INQUIRY.value,
                )
            )
        session.commit()
    finally:
        session.close()

    response = api_client.get(
        f"/api/v1/customers/{customer['id']}/jobs", headers=headers
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 2
    assert len(payload["items"]) == 2
