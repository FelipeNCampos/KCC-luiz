from email.message import EmailMessage
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.models.user import User
from app.core.config import settings
from conftest import TestingSessionLocal


def register_user(client: TestClient, email: str, password: str = "strong-password-123") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": email.split("@")[0],
            "email": email,
            "password": password,
        },
    )
    assert response.status_code == 201
    return response.json()


def login_user(client: TestClient, email: str, password: str = "strong-password-123") -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return response.json()["access_token"]


def set_user_role(user_id: int, role: str) -> None:
    with TestingSessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        user.role = role
        db.add(user)
        db.commit()


def get_admin_token(client: TestClient, email: str = "admin@example.com") -> str:
    auth_response = register_user(client, email)
    set_user_role(auth_response["user"]["id"], "admin")
    return login_user(client, email)


def test_create_record_increment_and_sign_rules(client: TestClient) -> None:
    admin_token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    income_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "income",
            "invoice": "No",
            "date": "2026-04-10",
            "value": "150.00",
            "description": "Monthly rent",
            "flat": "A101",
        },
    )
    assert income_response.status_code == 201
    assert income_response.json()["payment_number"] == 1
    assert income_response.json()["amount"] == "150.00"

    outcome_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "outcome",
            "invoice": "No",
            "date": "2026-04-15",
            "value": "40.00",
            "description": "Maintenance",
            "flat": "A101",
        },
    )
    assert outcome_response.status_code == 201
    assert outcome_response.json()["payment_number"] == 2
    assert outcome_response.json()["amount"] == "-40.00"

    list_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert list_response.status_code == 200

    body = list_response.json()
    assert body["monthly_total"] == "110.00"
    assert [item["balance"] for item in body["items"]] == ["150.00", "110.00"]


def test_month_filter_search_and_month_total_behavior(client: TestClient) -> None:
    admin_token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    records = [
        {
            "type": "income",
            "invoice": "No",
            "date": "2026-04-01",
            "value": "200.00",
            "description": "Rent A101",
            "flat": "A101",
        },
        {
            "type": "outcome",
            "invoice": "No",
            "date": "2026-04-20",
            "value": "50.00",
            "description": "Repair A101",
            "flat": "A101",
        },
        {
            "type": "income",
            "invoice": "No",
            "date": "2026-05-02",
            "value": "300.00",
            "description": "Rent B202",
            "flat": "B202",
        },
    ]

    for payload in records:
        assert client.post("/api/v1/cashflow", headers=headers, data=payload).status_code == 201

    april_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert april_response.status_code == 200
    assert len(april_response.json()["items"]) == 2
    assert april_response.json()["monthly_total"] == "150.00"

    april_search = client.get(
        "/api/v1/cashflow",
        headers=headers,
        params={"month": "2026-04", "search": "rent"},
    )
    assert april_search.status_code == 200
    assert len(april_search.json()["items"]) == 1
    assert april_search.json()["monthly_total"] == "150.00"


def test_permission_for_non_admin_or_manager(client: TestClient) -> None:
    user_auth = register_user(client, "resident@example.com")
    user_token = login_user(client, "resident@example.com")
    headers = {"Authorization": f"Bearer {user_token}"}

    list_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert list_response.status_code == 403

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "income",
            "invoice": "No",
            "date": "2026-04-10",
            "value": "10.00",
            "description": "Unauthorized",
            "flat": "A101",
        },
    )
    assert create_response.status_code == 403
    assert user_auth["user"]["role"] == "user"


def test_invoice_media_upload_and_retrieval(client: TestClient) -> None:
    admin_token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "income",
            "invoice": "Yes",
            "date": "2026-04-12",
            "value": "90.00",
            "description": "Invoice record",
            "flat": "C303",
        },
        files={"invoice_media": ("invoice.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert create_response.status_code == 201

    record = create_response.json()
    assert record["has_invoice"] is True
    assert record["invoice_media_name"] == "invoice.pdf"

    invoice_response = client.get(f"/api/v1/cashflow/{record['id']}/invoice", headers=headers)
    assert invoice_response.status_code == 200
    assert invoice_response.headers["content-type"] == "application/pdf"
    assert invoice_response.content == b"%PDF-1.4 fake"


def test_delete_record(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="delete-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "income",
            "invoice": "No",
            "date": "2026-04-12",
            "value": "25.00",
            "description": "To delete",
            "flat": "D404",
        },
    )
    assert create_response.status_code == 201
    record_id = create_response.json()["id"]

    delete_response = client.delete(f"/api/v1/cashflow/{record_id}", headers=headers)
    assert delete_response.status_code == 200

    list_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert list_response.status_code == 200
    assert list_response.json()["items"] == []


def test_send_cashflow_report(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin_token = get_admin_token(client, email="report-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    previous_month_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "income",
            "invoice": "No",
            "date": "2026-03-20",
            "value": "300.00",
            "description": "Carry over",
            "flat": "A101",
        },
    )
    assert previous_month_response.status_code == 201

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "type": "income",
            "invoice": "Yes",
            "date": "2026-04-12",
            "value": "120.00",
            "description": "Monthly fee",
            "flat": "A101",
        },
        files={"invoice_media": ("invoice.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert create_response.status_code == 201

    sent_messages: list[EmailMessage] = []

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            assert host == "smtp.example.com"
            assert port == 587
            assert timeout == 30

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def starttls(self) -> None:
            return None

        def login(self, username: str, password: str) -> None:
            assert username == "mailer"
            assert password == "secret"

        def send_message(self, message: EmailMessage) -> None:
            sent_messages.append(message)

    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_port", 587)
    monkeypatch.setattr(settings, "smtp_username", "mailer")
    monkeypatch.setattr(settings, "smtp_password", "secret")
    monkeypatch.setattr(settings, "smtp_use_tls", True)
    monkeypatch.setattr(settings, "smtp_from_email", "noreply@example.com")
    monkeypatch.setattr(settings, "smtp_from_name", "KCC Luiz")
    monkeypatch.setattr("app.services.email_service.smtplib.SMTP", FakeSMTP)

    response = client.post(
        "/api/v1/cashflow/report",
        headers=headers,
        json={"email": "destino@example.com", "month": "2026-04", "search": "monthly"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Cash flow report sent"
    assert len(sent_messages) == 1

    message = sent_messages[0]
    assert message["To"] == "destino@example.com"
    assert message["Subject"] == "Cashflow report 2026-04"

    attachment = next(message.iter_attachments())
    assert attachment.get_filename() == "cashflow-report-2026-04.xlsx"
    workbook = load_workbook(filename=BytesIO(attachment.get_content()))
    sheet = workbook["Cashflow Report"]

    assert sheet["A5"].value == "Opening Balance"
    assert sheet["B5"].value == 300
    assert sheet["A6"].value == "Monthly Balance"
    assert sheet["B6"].value == 120
    assert sheet["A7"].value == "Closing Balance"
    assert sheet["B7"].value == 420
    assert sheet["A11"].value == 2
    assert sheet["E11"].value == "Monthly fee"
    assert sheet["D11"].number_format == '$#,##0.00;[Red]-$#,##0.00'
