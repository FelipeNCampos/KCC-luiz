from datetime import UTC, datetime, timedelta

from conftest import TestingSessionLocal
from fastapi.testclient import TestClient

from app.models.oakhill import MaintenanceRecord, UtilityReading

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


def test_general_access_cleaner_can_check_in_and_out_of_multiple_flats(client: TestClient) -> None:
    check_in = client.post(
        "/api/v1/general-access/cleaner/check-in-batch",
        json={"name": "Maria Cleaner", "mobile": "62 91234 5678", "building_ids": ["50", "52"]},
    )

    assert check_in.status_code == 201
    assert check_in.json()["count"] == 2

    open_response = client.get("/api/v1/general-access/cleaner/open")
    assert open_response.status_code == 200
    assert {row["building_name"] for row in open_response.json()["data"]} == {"Flat 50", "Flat 52"}

    check_out = client.post(
        "/api/v1/general-access/cleaner/check-out",
        json={"mobile": "62 91234 5678"},
    )

    assert check_out.status_code == 200
    assert client.get("/api/v1/general-access/cleaner/open").json()["data"] == []


def test_general_access_contractor_can_check_in_to_multiple_flats(client: TestClient) -> None:
    response = client.post(
        "/api/v1/contractor-access/check-in-batch",
        json={
            "name": "Carlos Contractor",
            "company": "Fix Co",
            "building_ids": ["50", "51"],
            "job_description": "Air conditioner maintenance",
            "mobile": "62 91111 1111",
        },
    )

    assert response.status_code == 201
    assert response.json()["count"] == 2
    open_response = client.get("/api/v1/contractor-access/open")
    assert {row["flat"] for row in open_response.json()["data"]} == {"50", "51"}

    check_out = client.post(
        "/api/v1/contractor-access/check-out-batch",
        json={"mobile": "62 91111 1111"},
    )

    assert check_out.status_code == 200
    assert check_out.json()["count"] == 2
    assert client.get("/api/v1/contractor-access/open").json()["data"] == []


def test_manager_can_create_missing_cleaner_in_record_from_an_out_record(client: TestClient) -> None:
    token = get_admin_token(client, email="cleaner-counterpart-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    check_in = client.post(
        "/api/v1/general-access/cleaner/check-in",
        json={"name": "Maria Cleaner", "mobile": "62 98888 0000", "building_id": "50"},
    )
    assert check_in.status_code == 201
    check_out = client.post(
        "/api/v1/general-access/cleaner/check-out",
        json={"mobile": "62 98888 0000"},
    )
    assert check_out.status_code == 200

    response = client.post(
        f"/api/v1/acess/{check_out.json()['id']}/counterpart",
        headers=headers,
        json={"data": "2026-07-10T10:00:00Z"},
    )

    assert response.status_code == 201
    assert response.json()["operacao"] == 0
    assert response.json()["funcionario_id"] == check_out.json()["funcionario_id"]


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


def test_readings_compare_energy_and_gas_consumption_for_each_flat(client: TestClient) -> None:
    token = get_admin_token(client, email="readings-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    for reading_date, flat_50_energy, flat_50_gas in [
        ("2025-11-03", 5265, 31780),
        ("2025-12-01", 5291, 32016),
        ("2026-01-06", 5340, 32309),
    ]:
        response = client.post(
            "/api/v1/readings",
            headers=headers,
            json={
                "reading_date": reading_date,
                "readings": [
                    {"flat": "50", "energy": flat_50_energy, "gas": flat_50_gas},
                    {"flat": "51", "energy": 1000, "gas": 2000},
                    {"flat": "52", "energy": 3000, "gas": 4000},
                ],
            },
        )
        assert response.status_code == 201
        assert response.json()["count"] == 3

    list_response = client.get("/api/v1/readings", headers=headers, params={"flat": "50"})

    assert list_response.status_code == 200
    latest = list_response.json()["data"][0]
    assert latest["flat"] == "50"
    assert latest["building_name"] == "Flat 50"
    assert latest["days"] == 36
    assert latest["energy"] == 5340
    assert latest["energy_used"] == 49
    assert latest["energy_change_percent"] == 88.46
    assert latest["gas"] == 32309
    assert latest["gas_used"] == 293
    assert latest["gas_change_percent"] == 24.15


def test_public_energy_and_gas_forms_merge_readings_for_the_same_date(client: TestClient) -> None:
    energy_response = client.post(
        "/api/v1/readings/public/energy",
        json={
            "reading_date": "2026-07-28",
            "readings": [
                {"flat": "50", "value": 5340},
                {"flat": "51", "value": 1000},
                {"flat": "52", "value": 3000},
            ],
        },
    )
    assert energy_response.status_code == 201

    gas_response = client.post(
        "/api/v1/readings/public/gas",
        json={
            "reading_date": "2026-07-28",
            "readings": [
                {"flat": "50", "value": 32309},
                {"flat": "51", "value": 2000},
                {"flat": "52", "value": 4000},
            ],
        },
    )
    assert gas_response.status_code == 201

    with TestingSessionLocal() as db:
        rows = list(db.query(UtilityReading).order_by(UtilityReading.building_id))

    assert len(rows) == 3
    assert {(row.energy, row.gas) for row in rows} == {(5340, 32309), (1000, 2000), (3000, 4000)}
