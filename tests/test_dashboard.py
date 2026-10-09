from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine

from app.models import UserRole
from tests.auth_support import login_header, seed_user, unique_username
from tests.job_support import (
    create_category_with_stages,
    create_customer,
    create_inquiry,
    quote_and_confirm,
    staff_headers,
)

SHOP_TZ = ZoneInfo("Asia/Kolkata")


def test_unauthenticated_dashboard_is_rejected(api_client: TestClient) -> None:
    assert api_client.get("/api/v1/dashboard/summary").status_code == 401
    assert api_client.get("/api/v1/dashboard/jobs-by-stage").status_code == 401
    assert api_client.get("/api/v1/dashboard/jobs-by-category").status_code == 401
    assert api_client.get("/api/v1/dashboard/payments-summary").status_code == 401


def test_empty_period_returns_zero_payment_metrics(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    empty = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2010-01-01", "to_date": "2010-01-31"},
    )
    assert empty.status_code == 200, empty.text
    body = empty.json()
    assert body["payment_count"] == 0
    assert Decimal(body["total_received"]) == Decimal("0.00")
    assert body["by_method"] == []
    assert body["period"]["timezone"] == "Asia/Kolkata"

    inverted = api_client.get(
        "/api/v1/dashboard/summary",
        headers=headers,
        params={"from_date": "2026-02-01", "to_date": "2026-01-01"},
    )
    assert inverted.status_code == 400


def test_dashboard_aggregates_without_double_counting(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, stages = create_category_with_stages(api_client, headers)
    by_name = {item["name"]: item for item in stages}

    before = api_client.get("/api/v1/dashboard/summary", headers=headers)
    assert before.status_code == 200, before.text
    start = before.json()

    inquiry = create_inquiry(
        api_client,
        headers,
        customer_id=customer["id"],
        category_id=category["id"],
        title=unique_username("open"),
    )
    quoted = api_client.post(
        f"/api/v1/jobs/{inquiry['id']}/quotation",
        headers=headers,
        json={"quoted_amount": "250.50", "awaiting_confirmation": True},
    )
    assert quoted.status_code == 200, quoted.text

    after_quote = api_client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert after_quote["open_inquiries"] == start["open_inquiries"] + 1
    assert (
        after_quote["quotations_awaiting_confirmation"]
        == start["quotations_awaiting_confirmation"] + 1
    )
    assert Decimal(after_quote["open_quotation_pipeline_value"]) == Decimal(
        start["open_quotation_pipeline_value"]
    ) + Decimal("250.50")

    confirmed = quote_and_confirm(
        api_client,
        headers,
        schema_engine,
        create_inquiry(
            api_client,
            headers,
            customer_id=customer["id"],
            category_id=category["id"],
            title=unique_username("prod"),
        )["id"],
        quoted_amount="80.00",
    )
    sixteenth_before = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-03-16", "to_date": "2026-03-16"},
    ).json()
    fifteenth_before = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-03-15", "to_date": "2026-03-15"},
    ).json()
    paid_at = datetime(2026, 3, 15, 10, 0, tzinfo=SHOP_TZ).isoformat()
    payment = api_client.post(
        f"/api/v1/jobs/{confirmed['id']}/payments",
        headers=headers,
        json={"amount": "30.00", "payment_method": "CASH", "paid_at": paid_at},
    )
    assert payment.status_code == 201, payment.text

    after_confirm = api_client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert after_confirm["in_production"] == start["in_production"] + 1
    assert Decimal(after_confirm["outstanding_balance"]) == Decimal(
        start["outstanding_balance"]
    ) + Decimal("50.00")

    march = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-03-15", "to_date": "2026-03-15"},
    ).json()
    assert Decimal(march["total_received"]) == Decimal(
        fifteenth_before["total_received"]
    ) + Decimal("30.00")
    sixteenth_after = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-03-16", "to_date": "2026-03-16"},
    ).json()
    assert sixteenth_after["total_received"] == sixteenth_before["total_received"]

    by_category = api_client.get(
        "/api/v1/dashboard/jobs-by-category", headers=headers
    ).json()
    row = next(item for item in by_category["items"] if item["category_id"] == category["id"])
    assert row["job_count"] == 2
    assert row["confirmed_count"] == 1
    assert row["in_production_count"] == 1
    assert row["completed_count"] == 0

    by_stage = api_client.get("/api/v1/dashboard/jobs-by-stage", headers=headers).json()
    designing = next(
        item
        for item in by_stage["items"]
        if item["stage_id"] == by_name["Designing"]["id"]
    )
    assert designing["job_count"] == 1
    completed_stage = next(
        item
        for item in by_stage["items"]
        if item["stage_id"] == by_name["Completed"]["id"]
    )
    assert completed_stage["job_count"] == 0

    attr = api_client.get(
        "/api/v1/users/attribution-options", headers=headers
    ).json()[0]["id"]
    completed_before = api_client.get(
        "/api/v1/dashboard/summary", headers=headers
    ).json()
    moved = api_client.post(
        f"/api/v1/jobs/{confirmed['id']}/stage",
        headers=headers,
        json={
            "to_stage_id": by_name["Completed"]["id"],
            "updated_by_user_id": attr,
        },
    )
    assert moved.status_code == 200, moved.text
    completed_after = api_client.get(
        "/api/v1/dashboard/summary", headers=headers
    ).json()
    assert completed_after["in_production"] == completed_before["in_production"] - 1
    assert (
        completed_after["completed_in_period"]
        == completed_before["completed_in_period"] + 1
    )


def test_follow_ups_and_date_boundaries(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = staff_headers(api_client, schema_engine)
    customer = create_customer(api_client, headers)
    category, _ = create_category_with_stages(api_client, headers)
    today = datetime.now(SHOP_TZ).date()
    due_today = datetime(today.year, today.month, today.day, 15, 0, tzinfo=SHOP_TZ)
    overdue = datetime(2019, 1, 1, 9, 0, tzinfo=SHOP_TZ)

    before = api_client.get("/api/v1/dashboard/summary", headers=headers).json()
    api_client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "category_id": category["id"],
            "title": unique_username("today"),
            "description": "Follow today",
            "quantity": 1,
            "next_follow_up_at": due_today.isoformat(),
        },
    )
    api_client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "category_id": category["id"],
            "title": unique_username("overdue"),
            "description": "Follow overdue",
            "quantity": 1,
            "next_follow_up_at": overdue.isoformat(),
        },
    )
    after = api_client.get("/api/v1/dashboard/summary", headers=headers).json()
    assert after["follow_ups_due_today"] == before["follow_ups_due_today"] + 1
    assert after["follow_ups_overdue"] == before["follow_ups_overdue"] + 1

    inside = datetime(2026, 1, 15, 0, 0, tzinfo=SHOP_TZ)
    outside = datetime(2026, 1, 16, 0, 0, tzinfo=SHOP_TZ)
    job = quote_and_confirm(
        api_client,
        headers,
        schema_engine,
        create_inquiry(
            api_client,
            headers,
            customer_id=customer["id"],
            category_id=category["id"],
            title=unique_username("boundary"),
        )["id"],
        quoted_amount="20.00",
    )
    jan15_before = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-01-15", "to_date": "2026-01-15"},
    ).json()
    jan16_before = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-01-16", "to_date": "2026-01-16"},
    ).json()
    assert (
        api_client.post(
            f"/api/v1/jobs/{job['id']}/payments",
            headers=headers,
            json={
                "amount": "5.00",
                "payment_method": "UPI",
                "paid_at": inside.isoformat(),
            },
        ).status_code
        == 201
    )
    assert (
        api_client.post(
            f"/api/v1/jobs/{job['id']}/payments",
            headers=headers,
            json={
                "amount": "5.00",
                "payment_method": "UPI",
                "paid_at": outside.isoformat(),
            },
        ).status_code
        == 201
    )
    jan15 = api_client.get(
        "/api/v1/dashboard/payments-summary",
        headers=headers,
        params={"from_date": "2026-01-15", "to_date": "2026-01-15"},
    ).json()
    jan16 = api_client.get(
        "/api/v1/dashboard/summary",
        headers=headers,
        params={"from_date": "2026-01-16", "to_date": "2026-01-16"},
    ).json()
    assert Decimal(jan15["total_received"]) == Decimal(
        jan15_before["total_received"]
    ) + Decimal("5.00")
    assert Decimal(jan16["payments_received_in_period"]) == Decimal(
        jan16_before["total_received"]
    ) + Decimal("5.00")


def test_staff_and_admin_can_read_dashboard(
    api_client: TestClient, schema_engine: Engine
) -> None:
    for role in (UserRole.STAFF.value, UserRole.ADMIN.value):
        user, password = seed_user(schema_engine, role=role)
        headers = login_header(api_client, user.username, password)
        response = api_client.get("/api/v1/dashboard/summary", headers=headers)
        assert response.status_code == 200, response.text
        payload = response.json()
        assert payload["open_inquiries"] >= 0
        assert Decimal(payload["outstanding_balance"]) >= Decimal("0.00")
        assert Decimal(payload["conversion_rate"]) >= Decimal("0.0000")
