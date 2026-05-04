from fastapi.testclient import TestClient

from test_cashflow import get_admin_token


def test_public_stock_request_can_be_managed_by_status(client: TestClient) -> None:
    create_response = client.post(
        "/api/v1/stock-requests",
        json={"product_name": "Toilet paper", "quantity": 4},
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["status"] == "pending"
    assert created["product_name"] == "Toilet paper"

    token = get_admin_token(client, email="stock-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    pending_response = client.get("/api/v1/stock-requests", headers=headers, params={"status": "pending"})
    assert pending_response.status_code == 200
    assert pending_response.json()["count"] == 1

    completed_response = client.patch(
        f"/api/v1/stock-requests/{created['id']}/status",
        headers=headers,
        json={"status": "completed"},
    )
    assert completed_response.status_code == 200
    assert completed_response.json()["status"] == "completed"

    archived_response = client.delete(f"/api/v1/stock-requests/{created['id']}", headers=headers)
    assert archived_response.status_code == 200
    assert archived_response.json()["status"] == "archived"

    visible_response = client.get("/api/v1/stock-requests", headers=headers)
    assert visible_response.status_code == 200
    assert visible_response.json()["count"] == 0

    search_response = client.get(
        "/api/v1/stock-requests",
        headers=headers,
        params={"search": "toilet", "status": "archived"},
    )
    assert search_response.status_code == 200
    assert search_response.json()["count"] == 1
