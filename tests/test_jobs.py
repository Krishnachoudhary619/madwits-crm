from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.models import LeadStatus, UserRole
from app.services.job_service import generate_job_number
from tests.auth_support import login_header, seed_user, unique_username
from tests.job_support import (
    create_category_with_stages,
    create_customer,
    create_inquiry,
    staff_headers,
)


def test_job_numbers_are_unique_and_not_sequential() -> None:
    first = generate_job_number()
    second = generate_job_number()
    assert first != second
    for value in (first, second):
        assert value.startswith("MW-")
        assert len(value) == 20


def test_unauthenticated_job_routes_are_rejected(api_client: TestClient) -> None:
    assert api_client.get("/api/v1/jobs").status_code == 401
    assert (
        api_client.post(
            "/api/v1/jobs",
            json={
                "customer_id": str(uuid4()),
                "category_id": str(uuid4()),
                "title": "x",
                "description": "y",
                "quantity": 1,
            },
        ).status_code
        == 401
    )


def test_staff_can_create_search_and_filter_jobs(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, _stages = create_category_with_stages(api_client, headers)
    marker = unique_username("banner")
    created = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
        title=marker,
    )
    assert created["lead_status"] == LeadStatus.NEW_INQUIRY.value
    assert created["current_stage_id"] is None
    assert created["job_number"].startswith("MW-")

    listed = api_client.get(
        "/api/v1/jobs",
        headers=headers,
        params={"q": marker, "sort": "title", "order": "asc"},
    )
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] >= 1
    assert any(item["id"] == created["id"] for item in listed.json()["items"])

    by_customer = api_client.get(
        "/api/v1/jobs",
        headers=headers,
        params={"customer_id": customer["id"], "lead_status": "NEW_INQUIRY"},
    )
    assert by_customer.status_code == 200
    assert all(item["customer_id"] == customer["id"] for item in by_customer.json()["items"])

    page = api_client.get(
        "/api/v1/jobs", headers=headers, params={"page": 1, "page_size": 1}
    )
    assert page.status_code == 200
    assert len(page.json()["items"]) == 1
    assert page.json()["page_size"] == 1


def test_create_job_validates_customer_and_category(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    missing = api_client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "customer_id": str(uuid4()),
            "category_id": str(uuid4()),
            "title": "Missing",
            "description": "Refs do not exist",
            "quantity": 1,
        },
    )
    assert missing.status_code == 404

    customer = create_customer(api_client, headers)
    api_client.patch(
        f"/api/v1/customers/{customer['id']}",
        headers=headers,
        json={"is_active": False},
    )
    category, _ = create_category_with_stages(api_client, headers)
    inactive = api_client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "category_id": category["id"],
            "title": "Inactive customer",
            "description": "Should fail",
            "quantity": 10,
        },
    )
    assert inactive.status_code == 409


def test_quotation_and_confirm_keep_the_same_job(
    api_client: TestClient, schema_engine: Engine
) -> None:
    staff, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    attributed, _ = seed_user(
        schema_engine, role=UserRole.ADMIN.value, display_name="Owner"
    )
    headers = login_header(api_client, staff.username, password)
    customer = create_customer(api_client, headers)
    category, stages = create_category_with_stages(api_client, headers)
    job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
    )
    quoted = api_client.post(
        f"/api/v1/jobs/{job['id']}/quotation",
        headers=headers,
        json={
            "quoted_amount": "1500.00",
            "awaiting_confirmation": True,
            "notes": "Sent to customer",
        },
    )
    assert quoted.status_code == 200, quoted.text
    assert quoted.json()["id"] == job["id"]
    assert quoted.json()["lead_status"] == LeadStatus.AWAITING_CONFIRMATION.value
    assert quoted.json()["current_stage_id"] is None
    assert Decimal(quoted.json()["quoted_amount"]) == Decimal("1500.00")

    blocked_stage = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": stages[0]["id"],
            "updated_by_user_id": str(attributed.id),
        },
    )
    assert blocked_stage.status_code == 409
    assert api_client.get(
        f"/api/v1/jobs/{job['id']}/history", headers=headers
    ).json() == []

    confirmed = api_client.post(
        f"/api/v1/jobs/{job['id']}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(attributed.id), "notes": "Customer approved"},
    )
    assert confirmed.status_code == 200, confirmed.text
    body = confirmed.json()
    assert body["id"] == job["id"]
    assert body["job_number"] == job["job_number"]
    assert body["lead_status"] == LeadStatus.CONFIRMED.value
    assert body["current_stage_id"] == stages[0]["id"]
    assert Decimal(body["final_amount"]) == Decimal("1500.00")

    duplicate = api_client.post(
        f"/api/v1/jobs/{job['id']}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(attributed.id)},
    )
    assert duplicate.status_code == 409

    history = api_client.get(f"/api/v1/jobs/{job['id']}/history", headers=headers)
    assert history.status_code == 200
    records = history.json()
    assert len(records) == 1
    assert records[0]["from_stage_id"] is None
    assert records[0]["to_stage_id"] == stages[0]["id"]
    assert records[0]["updated_by_user_id"] == str(attributed.id)
    assert records[0]["updated_by_user_id"] != str(staff.id)


def test_cannot_confirm_new_inquiry(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    attributed, _ = seed_user(schema_engine, role=UserRole.STAFF.value)
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
    )
    response = api_client.post(
        f"/api/v1/jobs/{job['id']}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(attributed.id)},
    )
    assert response.status_code == 409
    detail = api_client.get(f"/api/v1/jobs/{job['id']}", headers=headers).json()
    assert detail["lead_status"] == LeadStatus.NEW_INQUIRY.value
    assert detail["current_stage_id"] is None


def test_lost_and_cancelled_are_terminal(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    attributed, _ = seed_user(schema_engine, role=UserRole.STAFF.value)
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    lost_job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
        title="Lost inquiry",
    )
    lost = api_client.post(
        f"/api/v1/jobs/{lost_job['id']}/mark-lost",
        headers=headers,
        json={"notes": "Chose another shop"},
    )
    assert lost.status_code == 200
    assert lost.json()["lead_status"] == LeadStatus.LOST.value
    assert lost.json()["notes"] == "Chose another shop"
    assert (
        api_client.post(
            f"/api/v1/jobs/{lost_job['id']}/quotation",
            headers=headers,
            json={"quoted_amount": "10.00"},
        ).status_code
        == 409
    )
    assert (
        api_client.post(
            f"/api/v1/jobs/{lost_job['id']}/confirm",
            headers=headers,
            json={"updated_by_user_id": str(attributed.id)},
        ).status_code
        == 409
    )

    cancelled_job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
        title="Cancelled inquiry",
    )
    cancelled = api_client.post(
        f"/api/v1/jobs/{cancelled_job['id']}/cancel",
        headers=headers,
        json={"notes": "Customer withdrew"},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["lead_status"] == LeadStatus.CANCELLED.value
    assert (
        api_client.patch(
            f"/api/v1/jobs/{cancelled_job['id']}",
            headers=headers,
            json={"title": "Should not change"},
        ).status_code
        == 409
    )


def test_stage_moves_follow_category_workflow(
    api_client: TestClient, schema_engine: Engine
) -> None:
    staff, password = seed_user(schema_engine, role=UserRole.STAFF.value)
    attributed, _ = seed_user(schema_engine, role=UserRole.ADMIN.value)
    headers = login_header(api_client, staff.username, password)
    customer = create_customer(api_client, headers)
    category, stages = create_category_with_stages(api_client, headers)
    other_category, other_stages = create_category_with_stages(api_client, headers)
    by_name = {item["name"]: item for item in stages}
    job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
    )
    api_client.post(
        f"/api/v1/jobs/{job['id']}/quotation",
        headers=headers,
        json={"quoted_amount": "2000.00"},
    )
    confirmed = api_client.post(
        f"/api/v1/jobs/{job['id']}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(attributed.id)},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["current_stage_id"] == by_name["Designing"]["id"]

    skipped = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Laminating"]["id"],
            "updated_by_user_id": str(attributed.id),
            "expected_current_stage_id": by_name["Designing"]["id"],
        },
    )
    assert skipped.status_code == 409
    unchanged = api_client.get(f"/api/v1/jobs/{job['id']}", headers=headers).json()
    assert unchanged["current_stage_id"] == by_name["Designing"]["id"]
    assert len(api_client.get(f"/api/v1/jobs/{job['id']}/history", headers=headers).json()) == 1

    cross = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": other_stages[0]["id"],
            "updated_by_user_id": str(attributed.id),
        },
    )
    assert cross.status_code == 409

    next_stage = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Printing"]["id"],
            "updated_by_user_id": str(attributed.id),
            "expected_current_stage_id": by_name["Designing"]["id"],
            "notes": "Sent to press",
        },
    )
    assert next_stage.status_code == 200, next_stage.text
    assert next_stage.json()["current_stage_id"] == by_name["Printing"]["id"]

    stale = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Laminating"]["id"],
            "updated_by_user_id": str(attributed.id),
            "expected_current_stage_id": by_name["Designing"]["id"],
        },
    )
    assert stale.status_code == 409

    to_final = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Completed"]["id"],
            "updated_by_user_id": str(attributed.id),
            "notes": "Ready for pickup",
        },
    )
    assert to_final.status_code == 200, to_final.text
    assert to_final.json()["current_stage_id"] == by_name["Completed"]["id"]

    history = api_client.get(f"/api/v1/jobs/{job['id']}/history", headers=headers).json()
    assert [item["to_stage_id"] for item in history] == [
        by_name["Designing"]["id"],
        by_name["Printing"]["id"],
        by_name["Completed"]["id"],
    ]
    assert history[1]["from_stage_id"] == by_name["Designing"]["id"]
    assert history[1]["updated_by_user_id"] == str(attributed.id)
    assert history[1]["notes"] == "Sent to press"


def test_inactive_attribution_is_rejected_without_history(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    inactive, _ = seed_user(schema_engine, is_active=False)
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
    )
    api_client.post(
        f"/api/v1/jobs/{job['id']}/quotation",
        headers=headers,
        json={"quoted_amount": "100.00", "awaiting_confirmation": True},
    )
    failed = api_client.post(
        f"/api/v1/jobs/{job['id']}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(inactive.id)},
    )
    assert failed.status_code == 400
    detail = api_client.get(f"/api/v1/jobs/{job['id']}", headers=headers).json()
    assert detail["lead_status"] == LeadStatus.AWAITING_CONFIRMATION.value
    assert detail["current_stage_id"] is None
    assert api_client.get(f"/api/v1/jobs/{job['id']}/history", headers=headers).json() == []


def test_confirm_requires_complete_category_workflow(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    attributed, _ = seed_user(schema_engine, role=UserRole.STAFF.value)
    customer = create_customer(api_client, headers)
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("empty")},
    ).json()
    job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
    )
    api_client.post(
        f"/api/v1/jobs/{job['id']}/quotation",
        headers=headers,
        json={"quoted_amount": "50.00"},
    )
    response = api_client.post(
        f"/api/v1/jobs/{job['id']}/confirm",
        headers=headers,
        json={"updated_by_user_id": str(attributed.id)},
    )
    assert response.status_code == 409
    detail = api_client.get(f"/api/v1/jobs/{job['id']}", headers=headers).json()
    assert detail["lead_status"] == LeadStatus.QUOTATION_PREPARED.value
    assert detail["current_stage_id"] is None


def test_staff_and_admin_can_operate_jobs_but_staff_cannot_manage_users(
    api_client: TestClient, schema_engine: Engine
) -> None:
    for role in (UserRole.STAFF.value, UserRole.ADMIN.value):
        user, password = seed_user(schema_engine, role=role)
        headers = login_header(api_client, user.username, password)
        customer = create_customer(api_client, headers)
        category, _ = create_category_with_stages(api_client, headers)
        job = create_inquiry(
            api_client,
            headers,
            customer_id=customer["id"],
            category_id=category["id"],
        )
        quoted = api_client.post(
            f"/api/v1/jobs/{job['id']}/quotation",
            headers=headers,
            json={"quoted_amount": "75.00"},
        )
        assert quoted.status_code == 200, quoted.text

    staff, staff_password = seed_user(schema_engine, role=UserRole.STAFF.value)
    staff_headers_map = login_header(api_client, staff.username, staff_password)
    denied = api_client.post(
        "/api/v1/users",
        headers=staff_headers_map,
        json={
            "display_name": "Nope",
            "username": unique_username("blocked"),
            "password": "password12",
        },
    )
    assert denied.status_code == 403


def test_follow_up_overdue_filter(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    created = api_client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "category_id": category["id"],
            "title": unique_username("follow"),
            "description": "Call back",
            "quantity": 1,
            "next_follow_up_at": past,
        },
    )
    assert created.status_code == 201, created.text
    overdue = api_client.get(
        "/api/v1/jobs",
        headers=headers,
        params={"follow_up_overdue": True, "q": created.json()["title"]},
    )
    assert overdue.status_code == 200
    assert any(item["id"] == created.json()["id"] for item in overdue.json()["items"])
