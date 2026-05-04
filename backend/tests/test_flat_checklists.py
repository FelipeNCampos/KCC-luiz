from fastapi.testclient import TestClient

from test_cashflow import get_admin_token


def test_flat_checklist_is_saved_per_flat(client: TestClient) -> None:
    token = get_admin_token(client, email="checklist-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    save_response = client.put(
        "/api/v1/flat-checklists/50",
        headers=headers,
        json={
            "items": [
                {"label": "Kitchen cleaned", "checked": False, "position": 0},
                {"label": "Bathroom checked", "checked": True, "position": 1},
            ]
        },
    )
    assert save_response.status_code == 200
    assert [item["label"] for item in save_response.json()["data"]] == ["Kitchen cleaned", "Bathroom checked"]

    flat_50_response = client.get("/api/v1/flat-checklists/50", headers=headers)
    assert flat_50_response.status_code == 200
    assert flat_50_response.json()["count"] == 2
    assert flat_50_response.json()["data"][1]["checked"] is True

    flat_51_response = client.get("/api/v1/flat-checklists/51", headers=headers)
    assert flat_51_response.status_code == 200
    assert flat_51_response.json()["count"] == 0


def test_flat_checklist_can_be_replaced_after_cleaner_checkout_snapshot(client: TestClient) -> None:
    token = get_admin_token(client, email="checklist-snapshot-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    save_response = client.put(
        "/api/v1/flat-checklists/50",
        headers=headers,
        json={
            "items": [
                {"label": "Old item 1", "checked": False, "position": 0},
                {"label": "Old item 2", "checked": False, "position": 1},
            ]
        },
    )
    assert save_response.status_code == 200
    item_ids = [item["id"] for item in save_response.json()["data"]]

    check_in = client.post(
        "/api/v1/general-access/cleaner/check-in",
        json={"name": "Snapshot Cleaner", "mobile": "62 91111 2222", "building_id": "50"},
    )
    assert check_in.status_code == 201

    check_out = client.post(
        "/api/v1/general-access/cleaner/check-out",
        json={"mobile": "62 91111 2222", "checked_item_ids": item_ids},
    )
    assert check_out.status_code == 200
    assert [item["label"] for item in check_out.json()["checkout_checklist_items"]] == ["Old item 1", "Old item 2"]

    replace_response = client.put(
        "/api/v1/flat-checklists/50",
        headers=headers,
        json={"items": [{"label": "New item", "checked": False, "position": 0}]},
    )
    assert replace_response.status_code == 200
    assert [item["label"] for item in replace_response.json()["data"]] == ["New item"]
