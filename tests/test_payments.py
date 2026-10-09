from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.models import LeadStatus, PaymentStatus, UserRole
from tests.auth_support import login_header, seed_user, unique_username
from tests.job_support import (
    create_category_with_stages,
    create_customer,
    create_inquiry,
    quote_and_confirm,
    staff_headers,
)


def _confirmed_job(api_client: TestClient, schema_engine: Engine, headers: dict) -> dict:
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    job = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
        title=unique_username("payjob"),
    )
    return quote_and_confirm(
        api_client, headers, schema_engine, job["id"], quoted_amount="100.00"
    )


def test_unauthenticated_payment_routes_are_rejected(api_client: TestClient) -> None:
    job_id = uuid4()
    assert api_client.get(f"/api/v1/jobs/{job_id}/payments").status_code == 401
    assert api_client.get("/api/v1/payments").status_code == 401
    assert (
        api_client.post(
            f"/api/v1/jobs/{job_id}/payments",
            json={
                "amount": "10.00",
                "payment_method": "CASH",
                "paid_at": datetime.now(timezone.utc).isoformat(),
            },
        ).status_code
        == 401
    )


def test_partial_payments_and_derived_balance(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    job = _confirmed_job(api_client, schema_engine, headers)
    paid_at = datetime.now(timezone.utc).isoformat()

    first = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={
            "amount": "40.10",
            "payment_method": "CASH",
            "paid_at": paid_at,
            "reference_number": "CASH-1",
        },
    )
    assert first.status_code == 201, first.text
    assert Decimal(first.json()["amount"]) == Decimal("40.10")

    second = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={
            "amount": "25.15",
            "payment_method": "UPI",
            "paid_at": paid_at,
            "notes": "PhonePe",
        },
    )
    assert second.status_code == 201, second.text

    listed = api_client.get(f"/api/v1/jobs/{job['id']}/payments", headers=headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["total"] == 2
    assert Decimal(body["amount_due"]) == Decimal("100.00")
    assert Decimal(body["total_paid"]) == Decimal("65.25")
    assert Decimal(body["balance"]) == Decimal("34.75")
    assert body["payment_status"] == PaymentStatus.PARTIALLY_PAID.value

    remainder = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={"amount": "34.75", "payment_method": "BANK_TRANSFER", "paid_at": paid_at},
    )
    assert remainder.status_code == 201, remainder.text
    balance = api_client.get(f"/api/v1/jobs/{job['id']}/balance", headers=headers)
    assert balance.status_code == 200
    snapshot = balance.json()
    assert Decimal(snapshot["total_paid"]) == Decimal("100.00")
    assert Decimal(snapshot["balance"]) == Decimal("0.00")
    assert snapshot["payment_status"] == PaymentStatus.PAID.value

    overpay = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={"amount": "0.01", "payment_method": "CASH", "paid_at": paid_at},
    )
    assert overpay.status_code == 409
    unchanged = api_client.get(f"/api/v1/jobs/{job['id']}/balance", headers=headers).json()
    assert Decimal(unchanged["total_paid"]) == Decimal("100.00")
    assert (
        api_client.get(f"/api/v1/jobs/{job['id']}/payments", headers=headers).json()[
            "total"
        ]
        == 3
    )


def test_payments_require_confirmed_job_and_valid_input(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    inquiry = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
    )
    paid_at = datetime.now(timezone.utc).isoformat()
    blocked = api_client.post(
        f"/api/v1/jobs/{inquiry['id']}/payments",
        headers=headers,
        json={"amount": "10.00", "payment_method": "CASH", "paid_at": paid_at},
    )
    assert blocked.status_code == 409
    assert inquiry["lead_status"] == LeadStatus.NEW_INQUIRY.value

    missing = api_client.post(
        f"/api/v1/jobs/{uuid4()}/payments",
        headers=headers,
        json={"amount": "10.00", "payment_method": "CASH", "paid_at": paid_at},
    )
    assert missing.status_code == 404

    job = quote_and_confirm(
        api_client, headers, schema_engine, inquiry["id"], quoted_amount="50.00"
    )
    invalid_amount = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={"amount": "0", "payment_method": "CASH", "paid_at": paid_at},
    )
    assert invalid_amount.status_code == 422
    invalid_method = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={"amount": "10.00", "payment_method": "CHEQUE", "paid_at": paid_at},
    )
    assert invalid_method.status_code == 422
    assert (
        api_client.delete(
            f"/api/v1/jobs/{job['id']}/payments", headers=headers
        ).status_code
        == 405
    )


def test_staff_and_admin_can_record_payments(
    api_client: TestClient, schema_engine: Engine
) -> None:
    paid_at = datetime.now(timezone.utc).isoformat()
    for role in (UserRole.STAFF.value, UserRole.ADMIN.value):
        user, password = seed_user(schema_engine, role=role)
        headers = login_header(api_client, user.username, password)
        job = _confirmed_job(api_client, schema_engine, headers)
        created = api_client.post(
            f"/api/v1/jobs/{job['id']}/payments",
            headers=headers,
            json={"amount": "10.00", "payment_method": "UPI", "paid_at": paid_at},
        )
        assert created.status_code == 201, created.text
        listed = api_client.get(
            "/api/v1/payments",
            headers=headers,
            params={"job_id": job["id"]},
        )
        assert listed.status_code == 200
        assert listed.json()["total"] == 1
