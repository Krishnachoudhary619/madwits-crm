from datetime import datetime, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.models import LeadStatus, PaymentStatus
from tests.job_support import (
    create_category_with_stages,
    create_customer,
    create_inquiry,
    quote_and_confirm,
    staff_headers,
)


def test_production_completion_is_independent_of_payment(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, stages = create_category_with_stages(api_client, headers)
    by_name = {item["name"]: item for item in stages}
    job = quote_and_confirm(
        api_client,
        headers,
        schema_engine,
        create_inquiry(
            api_client,
            headers,
            customer_id=customer["id"],
            category_id=category["id"],
        )["id"],
        quoted_amount="90.00",
    )
    unpaid = api_client.get(f"/api/v1/jobs/{job['id']}/balance", headers=headers)
    assert unpaid.status_code == 200
    assert unpaid.json()["payment_status"] == PaymentStatus.UNPAID.value
    assert job["current_stage_id"] == by_name["Designing"]["id"]

    attr = api_client.get(
        "/api/v1/users/attribution-options", headers=headers
    ).json()[0]["id"]
    completed = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Completed"]["id"],
            "updated_by_user_id": attr,
        },
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["lead_status"] == LeadStatus.CONFIRMED.value
    assert completed.json()["current_stage_id"] == by_name["Completed"]["id"]
    still_unpaid = api_client.get(
        f"/api/v1/jobs/{job['id']}/balance", headers=headers
    ).json()
    assert still_unpaid["payment_status"] == PaymentStatus.UNPAID.value

    paid = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={
            "amount": "90.00",
            "payment_method": "CASH",
            "paid_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert paid.status_code == 201, paid.text
    after_pay = api_client.get(f"/api/v1/jobs/{job['id']}", headers=headers).json()
    assert after_pay["current_stage_id"] == by_name["Completed"]["id"]
    assert after_pay["lead_status"] == LeadStatus.CONFIRMED.value
    assert (
        api_client.get(f"/api/v1/jobs/{job['id']}/balance", headers=headers).json()[
            "payment_status"
        ]
        == PaymentStatus.PAID.value
    )


def test_rejected_stage_and_payment_leave_history_and_rows_unchanged(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, stages = create_category_with_stages(api_client, headers)
    other_category, other_stages = create_category_with_stages(api_client, headers)
    by_name = {item["name"]: item for item in stages}
    job = quote_and_confirm(
        api_client,
        headers,
        schema_engine,
        create_inquiry(
            api_client,
            headers,
            customer_id=customer["id"],
            category_id=category["id"],
        )["id"],
        quoted_amount="50.00",
    )
    attr = api_client.get(
        "/api/v1/users/attribution-options", headers=headers
    ).json()[0]["id"]

    skipped = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Laminating"]["id"],
            "updated_by_user_id": attr,
        },
    )
    assert skipped.status_code == 409
    assert skipped.json()["error"]["code"] == "CONFLICT"
    cross = api_client.post(
        f"/api/v1/jobs/{job['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": other_stages[0]["id"],
            "updated_by_user_id": attr,
        },
    )
    assert cross.status_code == 409
    history = api_client.get(f"/api/v1/jobs/{job['id']}/history", headers=headers)
    assert history.status_code == 200
    assert len(history.json()) == 1
    assert history.json()[0]["to_stage_id"] == by_name["Designing"]["id"]

    overpay = api_client.post(
        f"/api/v1/jobs/{job['id']}/payments",
        headers=headers,
        json={
            "amount": "50.01",
            "payment_method": "UPI",
            "paid_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert overpay.status_code == 409
    payments = api_client.get(f"/api/v1/jobs/{job['id']}/payments", headers=headers)
    assert payments.json()["total"] == 0
    assert Decimal(payments.json()["total_paid"]) == Decimal("0.00")
