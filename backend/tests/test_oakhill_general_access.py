from datetime import UTC, datetime, timedelta

from conftest import TestingSessionLocal
from fastapi.testclient import TestClient

from app.models.oakhill import MaintenanceRecord

from test_cashflow import get_admin_token


def test_cleaner_general_access_mobile_moves_in_and_out_of_open_list(client: TestClient) -> None:
    open_initial = client.get("/api/v1/general-access/cleaner/open")
    assert open_initial.status_code == 200
    assert open_initial.json()["data"] == []

    check_in = client.post(
        "/api/v1/general-access/cleaner/check-in",
        json={"name": "Maria Cleaner", "mobile": "62 99456 6196"},
    )
    assert check_in.status_code == 201
    assert check_in.json()["operacao"] == 0

    open_after_in = client.get("/api/v1/general-access/cleaner/open")
    assert open_after_in.status_code == 200
    assert open_after_in.json()["count"] == 1
    assert open_after_in.json()["data"][0]["name"] == "Maria Cleaner"
    assert open_after_in.json()["data"][0]["mobile"] == "62994566196"

    check_out = client.post(
        "/api/v1/general-access/cleaner/check-out",
        json={"mobile": "62 99456 6196"},
    )
    assert check_out.status_code == 200
    assert check_out.json()["operacao"] == 1

    open_after_out = client.get("/api/v1/general-access/cleaner/open")
    assert open_after_out.status_code == 200
    assert open_after_out.json()["data"] == []


def test_cleaner_checkout_requires_and_stores_flat_checklist(client: TestClient) -> None:
    token = get_admin_token(client, email="cleaner-checklist-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    save_response = client.put(
        "/api/v1/flat-checklists/51",
        headers=headers,
        json={
            "items": [
                {"label": "Kitchen cleaned", "checked": False, "position": 0},
                {"label": "Bathroom checked", "checked": False, "position": 1},
            ]
        },
    )
    assert save_response.status_code == 200
    item_ids = [item["id"] for item in save_response.json()["data"]]

    check_in = client.post(
        "/api/v1/general-access/cleaner/check-in",
        json={"name": "Ana Cleaner", "mobile": "62 90000 0000", "building_id": "51"},
    )
    assert check_in.status_code == 201

    checklist_response = client.get(
        "/api/v1/general-access/cleaner/checklist",
        params={"mobile": "62 90000 0000"},
    )
    assert checklist_response.status_code == 200
    assert checklist_response.json()["building_name"] == "Flat 51"
    assert [item["label"] for item in checklist_response.json()["data"]] == ["Kitchen cleaned", "Bathroom checked"]

    incomplete_out = client.post(
        "/api/v1/general-access/cleaner/check-out",
        json={"mobile": "62 90000 0000", "checked_item_ids": item_ids[:1]},
    )
    assert incomplete_out.status_code == 422

    check_out = client.post(
        "/api/v1/general-access/cleaner/check-out",
        json={"mobile": "62 90000 0000", "checked_item_ids": item_ids},
    )
    assert check_out.status_code == 200
    assert check_out.json()["operacao"] == 1
    assert [item["label"] for item in check_out.json()["checkout_checklist_items"]] == ["Kitchen cleaned", "Bathroom checked"]


def test_contractor_access_includes_flat_in_records(client: TestClient) -> None:
    check_in = client.post(
        "/api/v1/contractor-access/check-in",
        json={
            "name": "Carlos Contractor",
            "company": "Fix Co",
            "building_id": "52",
            "job_description": "Air conditioner maintenance",
            "mobile": "62 91111 1111",
        },
    )
    assert check_in.status_code == 201
    assert check_in.json()["flat"] == "52"
    assert check_in.json()["building_name"] == "Flat 52"

    open_response = client.get("/api/v1/contractor-access/open")
    assert open_response.status_code == 200
    assert open_response.json()["count"] == 1
    assert open_response.json()["data"][0]["flat"] == "52"

    token = get_admin_token(client, email="contractor-flat-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    list_response = client.get("/api/v1/contractor-access/", headers=headers)
    assert list_response.status_code == 200
    assert list_response.json()["count"] == 1
    assert list_response.json()["data"][0]["flat"] == "52"


def test_admin_can_edit_a_contractor_record(client: TestClient) -> None:
    created = client.post(
        "/api/v1/contractor-access/check-in",
        json={
            "name": "Carlos Contractor",
            "company": "Fix Co",
            "building_id": "50",
            "job_description": "Air conditioner maintenance",
            "mobile": "62 91111 1111",
        },
    )
    assert created.status_code == 201

    token = get_admin_token(client, email="contractor-edit-admin@example.com")
    response = client.patch(
        f"/api/v1/contractor-access/{created.json()['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Carla Contractor",
            "company": "Repairs Co",
            "building_id": "51",
            "job_description": "Plumbing repair",
            "mobile": "62 92222 2222",
        },
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Carla Contractor"
    assert response.json()["company"] == "Repairs Co"
    assert response.json()["flat"] == "51"
    assert response.json()["job_description"] == "Plumbing repair"
    assert response.json()["mobile"] == "62 92222 2222"


def test_maintenance_schedule_creates_and_completes_history_from_contractor_access(client: TestClient) -> None:
    token = get_admin_token(client, email="maintenance-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    category_response = client.post(
        "/api/v1/contractor-access/maintenance/categories",
        headers=headers,
        json={"name": "Plumbing"},
    )
    assert category_response.status_code == 201

    schedule_response = client.post(
        "/api/v1/contractor-access/maintenance",
        headers=headers,
        json={
            "category_id": category_response.json()["id"],
            "tag": "Boiler 1",
            "report": "Annual boiler safety check",
            "frequency_days": 30,
            "notes": "Bring pressure gauge",
            "cellphone": "62 91111 1111",
        },
    )
    assert schedule_response.status_code == 201
    maintenance = schedule_response.json()
    assert maintenance["is_overdue"] is False

    check_in = client.post(
        "/api/v1/contractor-access/check-in",
        json={
            "name": "Carlos Contractor",
            "company": "Fix Co",
            "building_id": "50",
            "job_description": "Boiler service",
            "mobile": "62911111111",
        },
    )
    assert check_in.status_code == 201

    history_response = client.get("/api/v1/contractor-access/maintenance/history", headers=headers)
    assert history_response.status_code == 200
    assert history_response.json()["count"] == 1
    history = history_response.json()["data"][0]
    assert history["maintenance_id"] == maintenance["id"]
    assert history["in_at"] == check_in.json()["in_at"]
    assert history["out_at"] is None

    check_out = client.post(
        "/api/v1/contractor-access/check-out",
        json={"visit_id": check_in.json()["id"]},
    )
    assert check_out.status_code == 200

    refreshed_history = client.get("/api/v1/contractor-access/maintenance/history", headers=headers)
    assert refreshed_history.json()["data"][0]["out_at"] == check_out.json()["out_at"]

    with TestingSessionLocal() as db:
        record = db.query(MaintenanceRecord).one()
        record.in_at = datetime.now(UTC) - timedelta(days=31)
        db.add(record)
        db.commit()

    overdue_schedule = client.get("/api/v1/contractor-access/maintenance", headers=headers)
    assert overdue_schedule.json()["data"][0]["is_overdue"] is True
