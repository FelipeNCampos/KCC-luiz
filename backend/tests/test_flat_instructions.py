from fastapi.testclient import TestClient

from test_cashflow import get_admin_token


def test_flat_instructions_are_saved_per_flat_and_public(client: TestClient) -> None:
    token = get_admin_token(client, email="instructions-admin@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    save_response = client.put(
        "/api/v1/flat-instructions/50",
        headers=headers,
        json={
            "items": [
                {
                    "title": "Boiler",
                    "video_name": "boiler.mp4",
                    "video_data": "data:video/mp4;base64,AAAA",
                    "description": "How to restart the boiler.",
                    "position": 0,
                },
                {
                    "title": "WiFi",
                    "video_url": "",
                    "description": "Network details.",
                    "position": 1,
                },
            ]
        },
    )
    assert save_response.status_code == 200
    assert save_response.json()["count"] == 2

    public_50 = client.get("/api/v1/public-instructions/50")
    assert public_50.status_code == 200
    assert public_50.json()["building_name"] == "Flat 50"
    assert [item["title"] for item in public_50.json()["data"]] == ["Boiler", "WiFi"]
    assert public_50.json()["data"][0]["video_name"] == "boiler.mp4"
    assert public_50.json()["data"][0]["video_data"] == "data:video/mp4;base64,AAAA"

    public_51 = client.get("/api/v1/public-instructions/51")
    assert public_51.status_code == 200
    assert public_51.json()["count"] == 0
