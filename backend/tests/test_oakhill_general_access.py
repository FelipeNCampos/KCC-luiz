from fastapi.testclient import TestClient

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
