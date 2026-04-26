from fastapi.testclient import TestClient


def test_register_login_me_refresh_logout(client: TestClient) -> None:
    payload = {
        "name": "Luiz Carvalho",
        "email": "luiz@example.com",
        "password": "strong-password-123",
    }

    register_response = client.post("/api/v1/auth/register", json=payload)
    assert register_response.status_code == 201
    access_token = register_response.json()["access_token"]
    assert access_token
    assert client.cookies.get("kcc_refresh_token")

    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == payload["email"]

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login_response.status_code == 200

    refresh_response = client.post("/api/v1/auth/refresh")
    assert refresh_response.status_code == 200
    assert refresh_response.json()["access_token"]

    logout_response = client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 200
    assert logout_response.json()["message"] == "Logged out"


def test_duplicate_registration_is_rejected(client: TestClient) -> None:
    payload = {
        "name": "Marina Costa",
        "email": "marina@example.com",
        "password": "strong-password-123",
    }

    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    duplicate_response = client.post("/api/v1/auth/register", json=payload)

    assert duplicate_response.status_code == 409
