from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker

from app.models import Job, JobStatusHistory, LeadStatus, UserRole
from tests.auth_support import login_header, seed_user, unique_username


def _headers(
    api_client: TestClient, schema_engine: Engine, role: str = UserRole.STAFF.value
) -> dict[str, str]:
    user, password = seed_user(schema_engine, role=role)
    return login_header(api_client, user.username, password)


def _complete_first_stage(api_client: TestClient, headers: dict, category_id: str) -> dict:
    response = api_client.post(
        f"/api/v1/print-categories/{category_id}/stages",
        headers=headers,
        json={
            "name": "Designing",
            "sequence": 1,
            "is_initial": True,
            "is_final": True,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_unauthenticated_category_routes_are_rejected(api_client: TestClient) -> None:
    assert api_client.get("/api/v1/print-categories").status_code == 401


def test_staff_and_admin_can_configure_categories(
    api_client: TestClient, schema_engine: Engine
) -> None:
    for role in (UserRole.STAFF.value, UserRole.ADMIN.value):
        headers = _headers(api_client, schema_engine, role=role)
        created = api_client.post(
            "/api/v1/print-categories",
            headers=headers,
            json={"name": unique_username("banners"), "description": "Wide format"},
        )
        assert created.status_code == 201, created.text
        category_id = created.json()["id"]
        stage = _complete_first_stage(api_client, headers, category_id)
        assert stage["is_initial"] is True
        assert stage["is_final"] is True


def test_duplicate_active_category_name_is_rejected(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    name = unique_username("stickers")
    assert (
        api_client.post(
            "/api/v1/print-categories", headers=headers, json={"name": name}
        ).status_code
        == 201
    )
    duplicate = api_client.post(
        "/api/v1/print-categories", headers=headers, json={"name": name}
    )
    assert duplicate.status_code == 409


def test_deactivated_category_name_can_be_reused(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    name = unique_username("labels")
    created = api_client.post(
        "/api/v1/print-categories", headers=headers, json={"name": name}
    )
    api_client.patch(
        f"/api/v1/print-categories/{created.json()['id']}",
        headers=headers,
        json={"is_active": False},
    )
    reused = api_client.post(
        "/api/v1/print-categories", headers=headers, json={"name": name}
    )
    assert reused.status_code == 201


def test_stage_ordering_and_final_flag_transfer(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("cards")},
    ).json()
    first = _complete_first_stage(api_client, headers, category["id"])
    printing = api_client.post(
        f"/api/v1/print-categories/{category['id']}/stages",
        headers=headers,
        json={"name": "Printing", "sequence": 2},
    )
    completed = api_client.post(
        f"/api/v1/print-categories/{category['id']}/stages",
        headers=headers,
        json={"name": "Completed", "sequence": 3},
    )
    assert printing.status_code == 201, printing.text
    assert completed.status_code == 201, completed.text

    moved = api_client.patch(
        f"/api/v1/workflow-stages/{completed.json()['id']}",
        headers=headers,
        json={"is_final": True},
    )
    assert moved.status_code == 200, moved.text
    refreshed_first = api_client.get(
        f"/api/v1/print-categories/{category['id']}/stages", headers=headers
    )
    stages = {item["name"]: item for item in refreshed_first.json()}
    assert stages["Designing"]["is_initial"] is True
    assert stages["Designing"]["is_final"] is False
    assert stages["Completed"]["is_final"] is True

    swapped = api_client.patch(
        f"/api/v1/workflow-stages/{printing.json()['id']}",
        headers=headers,
        json={"sequence": 1},
    )
    assert swapped.status_code == 200, swapped.text
    ordered = api_client.get(
        f"/api/v1/print-categories/{category['id']}/stages", headers=headers
    ).json()
    assert [item["name"] for item in ordered] == ["Printing", "Designing", "Completed"]
    assert ordered[0]["sequence"] == 1
    assert ordered[1]["sequence"] == 2


def test_adding_a_final_stage_transfers_the_final_flag(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("finalxfer")},
    ).json()
    first = _complete_first_stage(api_client, headers, category["id"])
    packing = api_client.post(
        f"/api/v1/print-categories/{category['id']}/stages",
        headers=headers,
        json={"name": "Packing", "is_final": True},
    )
    assert packing.status_code == 201, packing.text
    assert packing.json()["is_final"] is True
    listed = api_client.get(
        f"/api/v1/print-categories/{category['id']}/stages", headers=headers
    ).json()
    by_id = {item["id"]: item for item in listed}
    assert by_id[first["id"]]["is_final"] is False
    assert by_id[first["id"]]["is_initial"] is True
    assert by_id[packing.json()["id"]]["is_final"] is True


def test_incomplete_active_workflow_is_rejected(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("cups")},
    ).json()
    incomplete = api_client.post(
        f"/api/v1/print-categories/{category['id']}/stages",
        headers=headers,
        json={"name": "Designing", "sequence": 1, "is_initial": True},
    )
    assert incomplete.status_code == 409

    first = _complete_first_stage(api_client, headers, category["id"])
    api_client.post(
        f"/api/v1/print-categories/{category['id']}/stages",
        headers=headers,
        json={"name": "Printing", "sequence": 2},
    )
    blocked = api_client.post(
        f"/api/v1/workflow-stages/{first['id']}/deactivate",
        headers=headers,
    )
    assert blocked.status_code == 409


def test_cannot_activate_category_without_complete_workflow(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    created = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("brochures"), "is_active": False},
    )
    category_id = created.json()["id"]
    api_client.post(
        f"/api/v1/print-categories/{category_id}/stages",
        headers=headers,
        json={"name": "Only initial", "is_initial": True},
    )
    activate = api_client.patch(
        f"/api/v1/print-categories/{category_id}",
        headers=headers,
        json={"is_active": True},
    )
    assert activate.status_code == 409


def test_referenced_stage_is_not_hard_deleted(
    api_client: TestClient, schema_engine: Engine
) -> None:
    headers = _headers(api_client, schema_engine)
    admin, _ = seed_user(schema_engine, role=UserRole.ADMIN.value)
    customer = api_client.post(
        "/api/v1/customers",
        headers=headers,
        json={"name": unique_username("ref"), "phone": "09000000001"},
    ).json()
    category = api_client.post(
        "/api/v1/print-categories",
        headers=headers,
        json={"name": unique_username("refcat")},
    ).json()
    stage = _complete_first_stage(api_client, headers, category["id"])

    session = sessionmaker(bind=schema_engine, expire_on_commit=False)()
    try:
        job = Job(
            job_number=f"JOB-{uuid4().hex[:8]}",
            customer_id=customer["id"],
            category_id=category["id"],
            title="Referenced",
            description="Uses the stage",
            quantity=1,
            lead_status=LeadStatus.CONFIRMED.value,
            current_stage_id=stage["id"],
        )
        session.add(job)
        session.flush()
        session.add(
            JobStatusHistory(
                job_id=job.id,
                to_stage_id=stage["id"],
                updated_by_user_id=admin.id,
            )
        )
        session.commit()
    finally:
        session.close()

    deleted = api_client.delete(
        f"/api/v1/workflow-stages/{stage['id']}", headers=headers
    )
    assert deleted.status_code == 405
    deactivated = api_client.post(
        f"/api/v1/workflow-stages/{stage['id']}/deactivate",
        headers=headers,
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["is_active"] is False
    listed = api_client.get(
        f"/api/v1/print-categories/{category['id']}/stages", headers=headers
    ).json()
    assert listed[0]["id"] == stage["id"]
