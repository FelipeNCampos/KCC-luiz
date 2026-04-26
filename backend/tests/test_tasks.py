from fastapi.testclient import TestClient

from app.models.user import User
from conftest import TestingSessionLocal
from test_cashflow import get_admin_token, login_user, register_user, set_user_role


def create_employee_user(client: TestClient, email: str = "employee@example.com") -> dict:
    auth_response = register_user(client, email)
    set_user_role(auth_response["user"]["id"], "employee")
    with TestingSessionLocal() as db:
        user = db.get(User, auth_response["user"]["id"])
        assert user is not None
        user.job_title = "Caretaker"
        db.add(user)
        db.commit()
    return auth_response["user"]


def test_tasks_module_toggle_and_employee_management(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="tasks-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    settings_response = client.get("/api/v1/tasks/module", headers=headers)
    assert settings_response.status_code == 200
    assert settings_response.json()["is_active"] is False

    patch_response = client.patch("/api/v1/tasks/module", headers=headers, json={"is_active": True})
    assert patch_response.status_code == 200
    assert patch_response.json()["is_active"] is True

    create_employee_response = client.post(
        "/api/v1/users/employees",
        headers=headers,
        data={
            "full_name": "Ava Hughes",
            "email": "ava.hughes@example.com",
            "password": "strong-password-123",
            "job_title": "Site Coordinator",
        },
    )
    assert create_employee_response.status_code == 201
    employee = create_employee_response.json()
    assert employee["role"] == "employee"
    assert employee["job_title"] == "Site Coordinator"

    list_response = client.get("/api/v1/users/employees", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    update_response = client.patch(
        f"/api/v1/users/employees/{employee['id']}",
        headers=headers,
        data={
            "job_title": "Senior Site Coordinator",
            "is_active": "false",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["job_title"] == "Senior Site Coordinator"
    assert update_response.json()["is_active"] is False


def test_task_board_flow(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="board-admin@example.com")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    create_employee_user(client)
    employee_token = login_user(client, "employee@example.com")
    employee_headers = {"Authorization": f"Bearer {employee_token}"}

    assert client.patch("/api/v1/tasks/module", headers=admin_headers, json={"is_active": True}).status_code == 200

    employees_response = client.get("/api/v1/users/employees", headers=admin_headers)
    employee_id = employees_response.json()[0]["id"]

    create_task_response = client.post(
        "/api/v1/tasks",
        headers=admin_headers,
        data={
            "name": "Inspect boilers",
            "description": "Check pressure readings and service notes.",
            "initial_status": "todo",
            "assigned_user_ids": f"[{employee_id}]",
        },
    )
    assert create_task_response.status_code == 201
    task = create_task_response.json()
    assert task["code"] == "task-01"
    assert task["status"] == "todo"

    board_response = client.get("/api/v1/tasks", headers=employee_headers)
    assert board_response.status_code == 200
    assert len(board_response.json()["items"]) == 1

    move_response = client.patch(
        f"/api/v1/tasks/{task['id']}",
        headers=employee_headers,
        json={"status": "in_progress"},
    )
    assert move_response.status_code == 200
    assert move_response.json()["status"] == "in_progress"

    message_response = client.post(
        f"/api/v1/tasks/{task['id']}/messages",
        headers=employee_headers,
        json={"content": "I have started the inspection."},
    )
    assert message_response.status_code == 201
    assert message_response.json()["sender"]["email"] == "employee@example.com"

    detail_response = client.get(f"/api/v1/tasks/{task['id']}", headers=employee_headers)
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["messages"][0]["content"] == "I have started the inspection."

    delete_response = client.delete(f"/api/v1/tasks/{task['id']}", headers=admin_headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["message"] == "Task deleted"
