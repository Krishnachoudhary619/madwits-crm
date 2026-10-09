from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.models import UserRole
from tests.auth_support import login_header, seed_user, unique_username


def staff_headers(api_client: TestClient, schema_engine: Engine) -> dict[str, str]:
    user, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    return login_header(api_client, user.username, password)


def create_customer(api_client: TestClient, headers: dict[str, str]) -> dict:
    response = api_client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "name": unique_username("cust"),
            "phone": "09000000000",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_category_with_stages(
    api_client: TestClient,
    headers: dict[str, str],
    stage_names: tuple[str, ...] = ("Designing", "Printing", "Laminating", "Completed"),
) -> tuple[dict, list[dict]]:
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("cat")},
    )
    assert category.status_code == 201, category.text
    category_id = category.json()["id"]
    stages: list[dict] = []
    for index, name in enumerate(stage_names, start=1):
        payload = {"name": name, "sequence": index}
        if index == 1:
            payload["is_initial"] = True
            payload["is_final"] = True
        created = api_client.post(
            f"/api/v1/print-categories/{category_id}/stages",
            headers=headers,
            json=payload,
        )
        assert created.status_code == 201, created.text
        stages.append(created.json())
    if len(stages) > 1:
        moved = api_client.patch(
            f"/api/v1/workflow-stages/{stages[-1]['id']}",
            headers=headers,
            json={"is_final": True},
        )
        assert moved.status_code == 200, moved.text
        listed = api_client.get(
            f"/api/v1/print-categories/{category_id}/stages", headers=headers
        )
        assert listed.status_code == 200, listed.text
        stages = listed.json()
    return category.json(), stages


def create_inquiry(
    api_client: TestClient,
    headers: dict[str, str],
    *,
    customer_id: str,
    category_id: str,
    title: str = "Wedding cards",
) -> dict:
    response = api_client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "customer_id": customer_id,
            "category_id": category_id,
            "title": title,
            "description": "500 visiting cards, matte lamination",
            "quantity": 500,
            "specifications": {"material": "300gsm", "sides": 2},
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def quote_and_confirm(
    api_client: TestClient,
    headers: dict[str, str],
    schema_engine: Engine,
    job_id: str,
    *,
    quoted_amount: str = "100.00",
) -> dict:
    attributed, _ = seed_user(schema_engine, role=UserRole.ADMIN.value)
    quoted = api_client.post(
        f"/api/v1/jobs/{job_id}/quotation",
        headers=headers,
        json={"quoted_amount": quoted_amount, "awaiting_confirmation": True},
    )
    assert quoted.status_code == 200, quoted.text
    confirmed = api_client.post(
        f"/api/v1/jobs/{job_id}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(attributed.id)},
    )
    assert confirmed.status_code == 200, confirmed.text
    return confirmed.json()
