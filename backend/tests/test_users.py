from fastapi.testclient import TestClient

from test_cashflow import get_admin_token, login_user, register_user, set_user_role


def test_admin_can_list_and_update_user_role(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="users-admin@example.com")
    user_auth = register_user(client, "role-target@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    list_response = client.get("/api/v1/users", headers=headers)
    assert list_response.status_code == 200
    assert {user["email"] for user in list_response.json()} >= {"users-admin@example.com", "role-target@example.com"}

    update_response = client.patch(
        f"/api/v1/users/{user_auth['user']['id']}",
        headers=headers,
        json={"role": "manager", "job_title": "Operations Lead", "is_active": True},
    )

    assert update_response.status_code == 200
    payload = update_response.json()
    assert payload["role"] == "manager"
    assert payload["job_title"] == "Operations Lead"
    assert payload["is_active"] is True


def test_admin_can_create_user_with_selected_access_role(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="users-create-admin@example.com")
    response = client.post(
        "/api/v1/users",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Ana Operations",
            "email": "ana.operations@example.com",
            "password": "strong-password-123",
            "job_title": "Operations Lead",
            "role": "manager",
            "is_active": True,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["name"] == "Ana Operations"
    assert payload["role"] == "manager"
    assert payload["job_title"] == "Operations Lead"


def test_admin_cannot_change_own_role_or_status(client: TestClient) -> None:
    admin_auth = register_user(client, "self-admin@example.com")
    set_user_role(admin_auth["user"]["id"], "admin")
    admin_token = login_user(client, "self-admin@example.com")

    self_headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.patch(
        f"/api/v1/users/{admin_auth['user']['id']}",
        headers=self_headers,
        json={"role": "user"},
    )

    assert response.status_code == 422
