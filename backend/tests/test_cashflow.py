from email.message import EmailMessage
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from reportlab.lib.pagesizes import A5
from reportlab.pdfgen import canvas

from app.core.config import settings
from app.models.user import User
from conftest import TestingSessionLocal


def make_invoice_pdf(text: str = "Invoice") -> bytes:
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A5)
    pdf.drawString(40, 200, text)
    pdf.showPage()
    pdf.save()
    return output.getvalue()


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
            "invoice": "No",
            "date": "2026-04-10",
            "value": "150.00",
        },
    )
    assert income_response.status_code == 201
    assert income_response.json()["payment_number"] == 1
    assert income_response.json()["amount"] == "150.00"
    assert income_response.json()["description"] is None
    assert income_response.json()["flat"] is None

    outcome_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-04-15",
            "value": "-40.00",
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
            "invoice": "No",
            "date": "2026-04-01",
            "value": "200.00",
            "description": "Rent A101",
            "flat": "A101",
        },
        {
            "invoice": "No",
            "date": "2026-04-20",
            "value": "-50.00",
            "description": "Repair A101",
            "flat": "A101",
        },
        {
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
            "invoice": "No",
            "date": "2026-04-10",
            "value": "10.00",
            "description": "Unauthorized",
            "flat": "A101",
        },
    )
    assert create_response.status_code == 403
    assert user_auth["user"]["role"] == "user"


def test_create_record_rejects_zero_value(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="zero-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-04-12",
            "value": "0",
        },
    )

    assert response.status_code == 422


def test_invoice_media_upload_and_retrieval(client: TestClient) -> None:
    admin_token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "Yes",
            "date": "2026-04-12",
            "value": "90.00",
            "description": "Invoice record",
            "flat": "C303",
        },
        files={"invoice_media": ("invoice.pdf", make_invoice_pdf(), "application/pdf")},
    )
    assert create_response.status_code == 201

    record = create_response.json()
    assert record["has_invoice"] is True
    assert record["invoice_media_name"] == "invoice.pdf"

    invoice_response = client.get(f"/api/v1/cashflow/{record['id']}/invoice", headers=headers)
    assert invoice_response.status_code == 200
    assert invoice_response.headers["content-type"] == "application/pdf"
    assert len(PdfReader(BytesIO(invoice_response.content)).pages) == 1


def test_update_record_comments_flat_and_invoice_media(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="update-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-04-12",
            "value": "75.00",
        },
    )
    assert create_response.status_code == 201
    record = create_response.json()
    assert record["has_invoice"] is False
    assert record["description"] is None
    assert record["flat"] is None

    update_response = client.patch(
        f"/api/v1/cashflow/{record['id']}",
        headers=headers,
        json={"description": "Updated comment", "flat": "F505"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["description"] == "Updated comment"
    assert update_response.json()["flat"] == "F505"
    assert update_response.json()["balance"] == "75.00"

    invoice_response = client.patch(
        f"/api/v1/cashflow/{record['id']}/invoice",
        headers=headers,
        files={"invoice_media": ("receipt.png", b"fake-image", "image/png")},
    )
    assert invoice_response.status_code == 200
    assert invoice_response.json()["has_invoice"] is True
    assert invoice_response.json()["invoice_media_name"] == "receipt.png"

    media_response = client.get(f"/api/v1/cashflow/{record['id']}/invoice", headers=headers)
    assert media_response.status_code == 200
    assert media_response.headers["content-type"] == "image/png"
    assert media_response.content == b"fake-image"


def test_delete_record(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="delete-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
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
            "invoice": "Yes",
            "date": "2026-04-12",
            "value": "120.00",
            "description": "Monthly fee",
            "flat": "A101",
        },
        files={
            "invoice_media": (
                "invoice.pdf",
                make_invoice_pdf("Monthly fee invoice"),
                "application/pdf",
            )
        },
    )
    assert create_response.status_code == 201

    next_month_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-05-02",
            "value": "80.00",
            "description": "May fee",
            "flat": "B202",
        },
    )
    assert next_month_response.status_code == 201

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
        json={
            "email": "destino@example.com",
            "start_month": "2026-04",
            "end_month": "2026-05",
            "include_invoice_table": True,
        },
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Cash flow report sent"
    assert len(sent_messages) == 1

    message = sent_messages[0]
    assert message["To"] == "destino@example.com"
    assert message["Subject"] == "Cashflow report 2026-04_to_2026-05"

    attachment = next(message.iter_attachments())
    assert attachment.get_filename() == "cashflow-report-2026-04_to_2026-05.pdf"
    assert attachment.get_content_type() == "application/pdf"

    reader = PdfReader(BytesIO(attachment.get_content()))
    assert len(reader.pages) >= 2
    first_page_text = reader.pages[0].extract_text()
    assert "Period: 2026-04_to_2026-05" in first_page_text
    assert "Opening Balance" in first_page_text
    assert "EUR 300.00" in first_page_text
    assert "Period Balance" in first_page_text
    assert "EUR 200.00" in first_page_text
    assert "Closing Balance" in first_page_text
    assert "EUR 500.00" in first_page_text
    assert "Monthly fee" in first_page_text
    assert "May fee" in first_page_text
    assert "Invoices" in first_page_text
    assert "invoice.pdf" in first_page_text
