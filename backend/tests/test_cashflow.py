from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from io import BytesIO

import pytest
from conftest import TestingSessionLocal
from fastapi.testclient import TestClient
from pypdf import PdfReader
from reportlab.lib.pagesizes import A5
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

from app.core.config import settings
from app.models.user import User
from app.services import cashflow_share_link_service
from app.services.cashflow_service import CashFlowService


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


def set_user_condominio(user_id: int, condominio_id: str) -> None:
    with TestingSessionLocal() as db:
        user = db.get(User, user_id)
        assert user is not None
        user.condominio_id = condominio_id
        db.add(user)
        db.commit()


def get_admin_token(client: TestClient, email: str = "admin@example.com") -> str:
    auth_response = register_user(client, email)
    set_user_role(auth_response["user"]["id"], "admin")
    return login_user(client, email)


def test_cashflow_report_table_wraps_long_cell_text() -> None:
    table = CashFlowService._styled_table(
        [["Comments"], ["Long maintenance description that must wrap inside its cell."]],
        [30],
    )

    assert isinstance(table._cellvalues[1][0], Paragraph)

    table.wrap(30, 400)

    assert table._rowHeights[1] > 18


def test_cashflow_share_link_exposes_current_inclusive_period_and_invoice(
    client: TestClient,
) -> None:
    auth = register_user(client, "share-manager@example.com")
    set_user_role(auth["user"]["id"], "manager")
    set_user_condominio(auth["user"]["id"], "condo-a")
    headers = {"Authorization": f"Bearer {login_user(client, 'share-manager@example.com')}"}

    for payload in (
        {"invoice": "No", "date": "2026-04-01", "value": "100.00", "description": "Opening"},
        {"invoice": "No", "date": "2026-04-02", "value": "-25.00", "description": "Cost"},
        {"invoice": "No", "date": "2026-04-03", "value": "999.00", "description": "Outside"},
    ):
        assert client.post("/api/v1/cashflow", headers=headers, data=payload).status_code == 201

    invoice_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "Yes",
            "date": "2026-04-02",
            "value": "50.00",
            "description": "Invoice in range",
        },
        files={
            "invoice_media": ("receipt.pdf", make_invoice_pdf("Shared receipt"), "application/pdf")
        },
    )
    assert invoice_response.status_code == 201

    expires_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    create_response = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers,
        json={
            "scope": "main",
            "date_from": "2026-04-01",
            "date_to": "2026-04-02",
            "expires_at": expires_at,
        },
    )

    assert create_response.status_code == 201
    link = create_response.json()
    assert link["status"] == "active"
    assert link["share_url"].endswith(link["token"])

    public_response = client.get(f"/api/v1/cashflow/shared/{link['token']}")
    assert public_response.status_code == 200
    body = public_response.json()
    assert body["date_from"] == "2026-04-01"
    assert body["date_to"] == "2026-04-02"
    assert body["credit_total"] == "150.00"
    assert body["debit_total"] == "-25.00"
    assert body["net_total"] == "125.00"
    assert [item["record_date"] for item in body["items"]] == [
        "2026-04-01",
        "2026-04-02",
        "2026-04-02",
    ]
    invoice = next(item for item in body["items"] if item["description"] == "Invoice in range")
    assert invoice["invoice_media_url"]
    assert "created_by_user_id" not in invoice
    assert "condominio_id" not in body

    shared_invoice = client.get(invoice["invoice_media_url"])
    assert shared_invoice.status_code == 200
    assert shared_invoice.headers["content-type"] == "application/pdf"

    assert (
        client.post(
            "/api/v1/cashflow",
            headers=headers,
            data={
                "invoice": "No",
                "date": "2026-04-02",
                "value": "10.00",
                "description": "Added later",
            },
        ).status_code
        == 201
    )
    refreshed = client.get(f"/api/v1/cashflow/shared/{link['token']}")
    assert refreshed.status_code == 200
    assert refreshed.json()["net_total"] == "135.00"


def test_cashflow_share_links_are_condominio_scoped_and_revocable(client: TestClient) -> None:
    manager_a = register_user(client, "share-manager-a@example.com")
    set_user_role(manager_a["user"]["id"], "manager")
    set_user_condominio(manager_a["user"]["id"], "condo-a")
    headers_a = {"Authorization": f"Bearer {login_user(client, 'share-manager-a@example.com')}"}

    expires_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    invalid_range = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers_a,
        json={"date_from": "2026-04-02", "date_to": "2026-04-01", "expires_at": expires_at},
    )
    assert invalid_range.status_code == 422

    expired_at_creation = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers_a,
        json={
            "date_from": "2026-04-01",
            "date_to": "2026-04-02",
            "expires_at": (datetime.now(UTC) - timedelta(minutes=1)).isoformat(),
        },
    )
    assert expired_at_creation.status_code == 422

    created = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers_a,
        json={"date_from": "2026-04-01", "date_to": "2026-04-02", "expires_at": expires_at},
    )
    assert created.status_code == 201
    link = created.json()

    listed = client.get("/api/v1/cashflow/share-links", headers=headers_a)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["share_url"] == link["share_url"]

    manager_b = register_user(client, "share-manager-b@example.com")
    set_user_role(manager_b["user"]["id"], "manager")
    set_user_condominio(manager_b["user"]["id"], "condo-b")
    headers_b = {"Authorization": f"Bearer {login_user(client, 'share-manager-b@example.com')}"}
    assert client.get("/api/v1/cashflow/share-links", headers=headers_b).json()["items"] == []
    assert (
        client.delete(f"/api/v1/cashflow/share-links/{link['id']}", headers=headers_b).status_code
        == 404
    )

    revoked = client.delete(f"/api/v1/cashflow/share-links/{link['id']}", headers=headers_a)
    assert revoked.status_code == 200
    assert revoked.json()["status"] == "revoked"
    assert client.get(f"/api/v1/cashflow/shared/{link['token']}").status_code == 404

    register_user(client, "share-user@example.com")
    headers_user = {"Authorization": f"Bearer {login_user(client, 'share-user@example.com')}"}
    assert (
        client.post(
            "/api/v1/cashflow/share-links",
            headers=headers_user,
            json={"date_from": "2026-04-01", "date_to": "2026-04-02", "expires_at": expires_at},
        ).status_code
        == 403
    )


def test_cashflow_share_link_is_listed_as_expired_and_publicly_unavailable(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    auth = register_user(client, "share-expiry-manager@example.com")
    set_user_role(auth["user"]["id"], "manager")
    headers = {"Authorization": f"Bearer {login_user(client, 'share-expiry-manager@example.com')}"}
    expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    created = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers,
        json={"date_from": "2026-04-01", "date_to": "2026-04-01", "expires_at": expires_at},
    )
    assert created.status_code == 201
    link = created.json()

    monkeypatch.setattr(
        cashflow_share_link_service, "now_utc", lambda: datetime.now(UTC) + timedelta(days=1)
    )
    listed = client.get("/api/v1/cashflow/share-links", headers=headers)
    assert listed.status_code == 200
    assert listed.json()["items"][0]["status"] == "expired"
    assert client.get(f"/api/v1/cashflow/shared/{link['token']}").status_code == 404


def test_cashflow_share_links_are_listed_only_for_the_selected_scope(client: TestClient) -> None:
    manager_token = get_admin_token(client, email="share-scope-manager@example.com")
    headers = {"Authorization": f"Bearer {manager_token}"}
    expires_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()

    main_link = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers,
        json={
            "scope": "main",
            "date_from": "2026-04-01",
            "date_to": "2026-04-01",
            "expires_at": expires_at,
        },
    )
    cashflow_52_link = client.post(
        "/api/v1/cashflow/share-links",
        headers=headers,
        json={
            "scope": "cashflow52",
            "date_from": "2026-04-01",
            "date_to": "2026-04-01",
            "expires_at": expires_at,
        },
    )
    assert main_link.status_code == 201
    assert cashflow_52_link.status_code == 201

    main_links = client.get(
        "/api/v1/cashflow/share-links", headers=headers, params={"scope": "main"}
    )
    cashflow_52_links = client.get(
        "/api/v1/cashflow/share-links", headers=headers, params={"scope": "cashflow52"}
    )

    assert [item["id"] for item in main_links.json()["items"]] == [main_link.json()["id"]]
    assert [item["id"] for item in cashflow_52_links.json()["items"]] == [
        cashflow_52_link.json()["id"]
    ]


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
    assert income_response.json()["supplier"] is None
    assert income_response.json()["flat"] is None

    outcome_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-04-15",
            "value": "-40.00",
            "description": "Maintenance",
            "supplier": "Tool Shop",
            "flat": "A101",
        },
    )
    assert outcome_response.status_code == 201
    assert outcome_response.json()["payment_number"] == 2
    assert outcome_response.json()["amount"] == "-40.00"
    assert outcome_response.json()["supplier"] == "Tool Shop"

    list_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert list_response.status_code == 200

    body = list_response.json()
    assert body["monthly_total"] == "110.00"
    assert body["current_balance"] == "110.00"
    assert [item["balance"] for item in body["items"]] == ["150.00", "110.00"]


def test_payment_numbers_are_dynamic_by_record_date(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="dynamic-number-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    day_20_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "Yes",
            "date": "2026-04-20",
            "value": "-80.00",
            "description": "Invoice day 20",
        },
        files={"invoice_media": ("day-20.pdf", make_invoice_pdf("Day 20"), "application/pdf")},
    )
    assert day_20_response.status_code == 201
    assert day_20_response.json()["payment_number"] == 1

    day_19_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "Yes",
            "date": "2026-04-19",
            "value": "-60.00",
            "description": "Invoice day 19",
        },
        files={"invoice_media": ("day-19.pdf", make_invoice_pdf("Day 19"), "application/pdf")},
    )
    assert day_19_response.status_code == 201
    assert day_19_response.json()["payment_number"] == 1

    list_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert list_response.status_code == 200

    items = list_response.json()["items"]
    assert [item["record_date"] for item in items] == ["2026-04-19", "2026-04-20"]
    assert [item["payment_number"] for item in items] == [1, 2]


def test_create_record_allows_invoice_without_media(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="invoice-without-media@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "Yes",
            "date": "2026-04-20",
            "value": "-80.00",
            "description": "Invoice without attachment",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["has_invoice"] is True
    assert body["invoice_media_name"] is None


def test_month_balance_starts_from_previous_month_closing_balance(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="carry-balance-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    records = [
        {
            "invoice": "No",
            "date": "2026-01-10",
            "value": "2500.00",
            "description": "January income",
        },
        {
            "invoice": "No",
            "date": "2026-01-20",
            "value": "-500.00",
            "description": "January cost",
        },
        {
            "invoice": "No",
            "date": "2026-02-05",
            "value": "-300.00",
            "description": "February cost",
        },
        {
            "invoice": "No",
            "date": "2026-02-10",
            "value": "100.00",
            "description": "February income",
        },
    ]

    for payload in records:
        assert client.post("/api/v1/cashflow", headers=headers, data=payload).status_code == 201

    january_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-01"})
    assert january_response.status_code == 200
    assert january_response.json()["current_balance"] == "2000.00"
    assert [item["balance"] for item in january_response.json()["items"]] == ["2500.00", "2000.00"]

    february_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-02"})
    assert february_response.status_code == 200
    assert february_response.json()["monthly_total"] == "-200.00"
    assert february_response.json()["current_balance"] == "1800.00"
    assert [item["balance"] for item in february_response.json()["items"]] == ["1700.00", "1800.00"]

    march_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-03"})
    assert march_response.status_code == 200
    assert march_response.json()["monthly_total"] == "0"
    assert march_response.json()["current_balance"] == "1800.00"
    assert march_response.json()["items"] == []


def test_month_filter_search_and_month_total_behavior(client: TestClient) -> None:
    admin_token = get_admin_token(client)
    headers = {"Authorization": f"Bearer {admin_token}"}

    records = [
        {
            "invoice": "No",
            "date": "2026-04-01",
            "value": "200.00",
            "description": "Rent A101",
            "supplier": "Tenant A101",
            "flat": "A101",
        },
        {
            "invoice": "No",
            "date": "2026-04-20",
            "value": "-50.00",
            "description": "Repair A101",
            "supplier": "Oak Maintenance",
            "flat": "A101",
        },
        {
            "invoice": "No",
            "date": "2026-05-02",
            "value": "300.00",
            "description": "Rent B202",
            "supplier": "Tenant B202",
            "flat": "B202",
        },
    ]

    for payload in records:
        assert client.post("/api/v1/cashflow", headers=headers, data=payload).status_code == 201

    april_response = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert april_response.status_code == 200
    assert len(april_response.json()["items"]) == 2
    assert april_response.json()["monthly_total"] == "150.00"
    assert april_response.json()["current_balance"] == "150.00"

    april_search = client.get(
        "/api/v1/cashflow",
        headers=headers,
        params={"month": "2026-04", "search": "rent"},
    )
    assert april_search.status_code == 200
    assert len(april_search.json()["items"]) == 1
    assert april_search.json()["monthly_total"] == "150.00"
    assert april_search.json()["current_balance"] == "150.00"

    supplier_search = client.get(
        "/api/v1/cashflow",
        headers=headers,
        params={"month": "2026-04", "search": "maintenance"},
    )
    assert supplier_search.status_code == 200
    assert [item["supplier"] for item in supplier_search.json()["items"]] == ["Oak Maintenance"]


def test_cashflow_52_scope_is_separate_and_does_not_store_flat(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="cashflow-52-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    main_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-04-01",
            "value": "100.00",
            "description": "Main cashflow",
            "supplier": "Main supplier",
            "flat": "Flat 50",
        },
    )
    assert main_response.status_code == 201

    scoped_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "scope": "cashflow52",
            "invoice": "No",
            "date": "2026-04-02",
            "value": "25.00",
            "description": "Cashflow 52 record",
            "supplier": "Supplier 52",
            "flat": "Should not be stored",
        },
    )
    assert scoped_response.status_code == 201
    assert scoped_response.json()["payment_number"] == 1
    assert scoped_response.json()["supplier"] == "Supplier 52"
    assert scoped_response.json()["flat"] is None

    main_list = client.get("/api/v1/cashflow", headers=headers, params={"month": "2026-04"})
    assert main_list.status_code == 200
    assert main_list.json()["monthly_total"] == "100.00"
    assert [item["description"] for item in main_list.json()["items"]] == ["Main cashflow"]

    scoped_list = client.get(
        "/api/v1/cashflow",
        headers=headers,
        params={"month": "2026-04", "scope": "cashflow52"},
    )
    assert scoped_list.status_code == 200
    assert scoped_list.json()["monthly_total"] == "25.00"
    assert [item["description"] for item in scoped_list.json()["items"]] == ["Cashflow 52 record"]
    assert scoped_list.json()["items"][0]["supplier"] == "Supplier 52"
    assert scoped_list.json()["items"][0]["flat"] is None

    scoped_flat_search = client.get(
        "/api/v1/cashflow",
        headers=headers,
        params={"month": "2026-04", "scope": "cashflow52", "search": "stored"},
    )
    assert scoped_flat_search.status_code == 200
    assert scoped_flat_search.json()["monthly_total"] == "25.00"
    assert scoped_flat_search.json()["items"] == []

    scoped_supplier_search = client.get(
        "/api/v1/cashflow",
        headers=headers,
        params={"month": "2026-04", "scope": "cashflow52", "search": "supplier 52"},
    )
    assert scoped_supplier_search.status_code == 200
    assert len(scoped_supplier_search.json()["items"]) == 1

    preview_response = client.post(
        "/api/v1/cashflow/report/preview",
        headers=headers,
        json={
            "scope": "cashflow52",
            "start_month": "2026-04",
            "end_month": "2026-04",
            "include_invoice_table": True,
        },
    )
    assert preview_response.status_code == 200
    preview_text = PdfReader(BytesIO(preview_response.content)).pages[0].extract_text()
    assert "Cashflow 52 Report" in preview_text
    assert "Supplier 52" in preview_text
    assert "Flat" not in preview_text


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
            "invoice_number": "INV-2026-0042",
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
    assert record["invoice_number"] == "INV-2026-0042"
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
    assert record["supplier"] is None
    assert record["flat"] is None

    update_response = client.patch(
        f"/api/v1/cashflow/{record['id']}",
        headers=headers,
        json={
            "value": "125.00",
            "description": "Updated comment",
            "supplier": "Updated supplier",
            "flat": "F505",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["amount"] == "125.00"
    assert update_response.json()["description"] == "Updated comment"
    assert update_response.json()["supplier"] == "Updated supplier"
    assert update_response.json()["flat"] == "F505"
    assert update_response.json()["balance"] == "125.00"

    zero_update_response = client.patch(
        f"/api/v1/cashflow/{record['id']}",
        headers=headers,
        json={"value": "0"},
    )
    assert zero_update_response.status_code == 422

    invoice_response = client.patch(
        f"/api/v1/cashflow/{record['id']}/invoice",
        headers=headers,
        data={"invoice_number": "INV-900"},
        files={"invoice_media": ("receipt.png", b"fake-image", "image/png")},
    )
    assert invoice_response.status_code == 200
    assert invoice_response.json()["has_invoice"] is True
    assert invoice_response.json()["invoice_number"] == "INV-900"
    assert invoice_response.json()["invoice_media_name"] == "receipt.png"

    media_response = client.get(f"/api/v1/cashflow/{record['id']}/invoice", headers=headers)
    assert media_response.status_code == 200
    assert media_response.headers["content-type"] == "image/png"
    assert media_response.content == b"fake-image"

    invoice_number_only_response = client.patch(
        f"/api/v1/cashflow/{record['id']}/invoice",
        headers=headers,
        data={"invoice_number": "INV-901"},
    )
    assert invoice_number_only_response.status_code == 200
    assert invoice_number_only_response.json()["invoice_number"] == "INV-901"


def test_update_record_moves_it_to_another_cashflow(client: TestClient) -> None:
    admin_token = get_admin_token(client, email="move-record-admin@example.com")
    headers = {"Authorization": f"Bearer {admin_token}"}

    created = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "No",
            "date": "2026-04-12",
            "value": "75.00",
            "flat": "Flat 50",
        },
    )
    assert created.status_code == 201
    record_id = created.json()["id"]

    moved = client.patch(
        f"/api/v1/cashflow/{record_id}",
        headers=headers,
        json={"scope": "cashflow52"},
    )
    assert moved.status_code == 200
    assert moved.json()["flat"] is None

    main_records = client.get(
        "/api/v1/cashflow", headers=headers, params={"month": "2026-04", "scope": "main"}
    )
    cashflow_52_records = client.get(
        "/api/v1/cashflow", headers=headers, params={"month": "2026-04", "scope": "cashflow52"}
    )
    assert main_records.json()["items"] == []
    assert [item["id"] for item in cashflow_52_records.json()["items"]] == [record_id]


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
            "supplier": "Opening tenant",
            "flat": "A101",
        },
    )
    assert previous_month_response.status_code == 201

    create_response = client.post(
        "/api/v1/cashflow",
        headers=headers,
        data={
            "invoice": "Yes",
            "invoice_number": "INV-APR-2026",
            "date": "2026-04-12",
            "value": "120.00",
            "description": "Monthly fee",
            "supplier": "April tenant",
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
            "supplier": "May tenant",
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
    assert "£ 300.00" in first_page_text
    assert "Period Balance" in first_page_text
    assert "£ 200.00" in first_page_text
    assert "Closing Balance" in first_page_text
    assert "£ 500.00" in first_page_text
    assert "12-04-2026" in first_page_text
    assert "02-05-2026" in first_page_text
    assert "Monthly fee" in first_page_text
    assert "April tenant" in first_page_text
    assert "May fee" in first_page_text
    assert "May tenant" in first_page_text
    assert "Invoices" in first_page_text
    assert "invoice.pdf" in first_page_text

    second_page_text = reader.pages[1].extract_text()
    assert "Invoice: INV-APR-2026" in second_page_text
