from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.repositories.cashflow_repository import CashFlowRepository
from app.repositories.cashflow_share_link_repository import CashFlowShareLinkRepository
from app.schemas.auth import MessageResponse
from app.schemas.cashflow import (
    CashFlowCreate,
    CashFlowListResponse,
    CashFlowNextPaymentNumberResponse,
    CashFlowPublicShareResponse,
    CashFlowReportPreviewRequest,
    CashFlowReportRequest,
    CashFlowRow,
    CashFlowShareLinkCreate,
    CashFlowShareLinkListResponse,
    CashFlowShareLinkRead,
    CashFlowSystemInvoice,
    CashFlowUpdate,
)
from app.services.cashflow_service import CashFlowService
from app.services.cashflow_share_link_service import CashFlowShareLinkService

router = APIRouter()
MAX_INVOICE_BYTES = 10 * 1024 * 1024


def share_link_service(db: Session) -> CashFlowShareLinkService:
    return CashFlowShareLinkService(
        CashFlowShareLinkRepository(db),
        CashFlowRepository(db),
    )


def _parse_invoice_flag(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"yes", "true", "1"}:
        return True
    if normalized in {"no", "false", "0"}:
        return False
    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail="Invoice must be Yes or No",
    )


def _validate_invoice_media(invoice_media: UploadFile | None) -> None:
    if invoice_media and invoice_media.content_type:
        allowed = (
            invoice_media.content_type.startswith("image/")
            or invoice_media.content_type == "application/pdf"
        )
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice media must be an image or PDF",
            )


@router.get("", response_model=CashFlowListResponse)
def list_cashflow_records(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
    month: Annotated[str | None, Query(description="Month in format YYYY-MM")] = None,
    date_from: Annotated[date | None, Query(description="Custom period start date")] = None,
    date_to: Annotated[date | None, Query(description="Custom period end date")] = None,
    search: Annotated[
        str | None, Query(description="Search by description, supplier, flat or amount")
    ] = None,
    scope: Annotated[str | None, Query(description="Cashflow scope")] = None,
    include_all: Annotated[bool, Query(alias="all", description="Include all records")] = False,
) -> CashFlowListResponse:
    service = CashFlowService(CashFlowRepository(db))
    return service.list_month(
        month=month,
        date_from=date_from,
        date_to=date_to,
        search=search,
        scope=scope,
        include_all=include_all,
    )


@router.get("/next-payment-number", response_model=CashFlowNextPaymentNumberResponse)
def get_next_cashflow_payment_number(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> CashFlowNextPaymentNumberResponse:
    service = CashFlowService(CashFlowRepository(db))
    return CashFlowNextPaymentNumberResponse(next_payment_number=service.get_next_payment_number())


@router.post("", response_model=CashFlowRow, status_code=status.HTTP_201_CREATED)
async def create_cashflow_record(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "manager"))],
    invoice: Annotated[str, Form(alias="invoice")],
    record_date: Annotated[str, Form(alias="date")],
    value: Annotated[Decimal, Form(alias="value")],
    description: Annotated[str | None, Form(alias="description")] = None,
    supplier: Annotated[str | None, Form(alias="supplier")] = None,
    flat: Annotated[str | None, Form(alias="flat")] = None,
    scope: Annotated[str | None, Form(alias="scope")] = None,
    invoice_number: Annotated[str | None, Form(alias="invoice_number")] = None,
    invoice_media: Annotated[UploadFile | None, File(alias="invoice_media")] = None,
    system_invoice_type: Annotated[str | None, Form(alias="system_invoice_type")] = None,
    system_invoice_data: Annotated[str | None, Form(alias="system_invoice_data")] = None,
) -> CashFlowRow:
    has_invoice = _parse_invoice_flag(invoice)
    if value == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Value must be different from zero",
        )

    _validate_invoice_media(invoice_media)

    invoice_bytes: bytes | None = None
    invoice_name: str | None = None
    invoice_mime: str | None = None
    if invoice_media is not None:
        invoice_bytes = await invoice_media.read()
        if len(invoice_bytes) > MAX_INVOICE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Invoice media is too large",
            )
        invoice_name = invoice_media.filename
        invoice_mime = invoice_media.content_type

    payload = CashFlowCreate(
        has_invoice=has_invoice,
        invoice_number=invoice_number,
        record_date=record_date,
        value=value,
        description=description,
        supplier=supplier,
        flat=flat,
        scope=scope,
    )

    service = CashFlowService(CashFlowRepository(db))
    created = service.create_record(
        user_id=current_user.id,
        payload=payload,
        invoice_media_name=invoice_name,
        invoice_media_mime=invoice_mime,
        invoice_media_data=invoice_bytes,
        system_invoice_type=system_invoice_type,
        system_invoice_data=system_invoice_data,
    )

    return service.row_for_record(created)


@router.patch("/{record_id}", response_model=CashFlowRow)
def update_cashflow_record(
    record_id: int,
    payload: CashFlowUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> CashFlowRow:
    service = CashFlowService(CashFlowRepository(db))
    updated = service.update_record(record_id, payload)
    return service.row_for_record(updated)


@router.get("/{record_id}/system-invoice", response_model=CashFlowSystemInvoice)
def get_system_cashflow_invoice(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> CashFlowSystemInvoice:
    return CashFlowService(CashFlowRepository(db)).get_system_invoice(record_id)


@router.patch("/{record_id}/system-invoice", response_model=CashFlowRow)
async def update_system_cashflow_invoice(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
    invoice_number: Annotated[str, Form(alias="invoice_number")],
    record_date: Annotated[date, Form(alias="date")],
    value: Annotated[Decimal, Form(alias="value")],
    system_invoice_type: Annotated[str, Form(alias="system_invoice_type")],
    system_invoice_data: Annotated[str, Form(alias="system_invoice_data")],
    invoice_media: Annotated[UploadFile, File(alias="invoice_media")],
    description: Annotated[str | None, Form(alias="description")] = None,
    supplier: Annotated[str | None, Form(alias="supplier")] = None,
    flat: Annotated[str | None, Form(alias="flat")] = None,
) -> CashFlowRow:
    if value == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Value must be different from zero",
        )

    _validate_invoice_media(invoice_media)
    invoice_bytes = await invoice_media.read()
    if not invoice_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invoice media is required",
        )
    if len(invoice_bytes) > MAX_INVOICE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Invoice media is too large",
        )

    service = CashFlowService(CashFlowRepository(db))
    updated = service.update_system_invoice(
        record_id=record_id,
        payload=CashFlowUpdate(
            value=value,
            description=description,
            supplier=supplier,
            flat=flat,
        ),
        record_date=record_date,
        invoice_number=invoice_number,
        invoice_media_name=invoice_media.filename or "invoice",
        invoice_media_mime=invoice_media.content_type,
        invoice_media_data=invoice_bytes,
        system_invoice_type=system_invoice_type,
        system_invoice_data=system_invoice_data,
    )
    return service.row_for_record(updated)


@router.patch("/{record_id}/invoice", response_model=CashFlowRow)
async def update_cashflow_invoice(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
    invoice_number: Annotated[str | None, Form(alias="invoice_number")] = None,
    invoice_media: Annotated[UploadFile | None, File(alias="invoice_media")] = None,
) -> CashFlowRow:
    if invoice_media is None and (invoice_number is None or not invoice_number.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invoice media or invoice number is required",
        )

    _validate_invoice_media(invoice_media)
    invoice_bytes: bytes | None = None
    invoice_name: str | None = None
    invoice_mime: str | None = None
    if invoice_media is not None:
        invoice_bytes = await invoice_media.read()
        if not invoice_bytes:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice media is required",
            )
        if len(invoice_bytes) > MAX_INVOICE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Invoice media is too large",
            )
        invoice_name = invoice_media.filename
        invoice_mime = invoice_media.content_type

    service = CashFlowService(CashFlowRepository(db))
    updated = service.update_invoice_media(
        record_id=record_id,
        invoice_number=invoice_number,
        invoice_media_name=invoice_name,
        invoice_media_mime=invoice_mime,
        invoice_media_data=invoice_bytes,
    )
    return service.row_for_record(updated)


@router.get("/{record_id}/invoice")
def get_cashflow_invoice(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> Response:
    service = CashFlowService(CashFlowRepository(db))
    file_name, media_type, data = service.get_invoice_media(record_id)
    headers = {"Content-Disposition": f'inline; filename="{file_name}"'}
    return Response(content=data, media_type=media_type, headers=headers)


@router.post("/report", response_model=MessageResponse)
def send_cashflow_report(
    payload: CashFlowReportRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> MessageResponse:
    service = CashFlowService(CashFlowRepository(db))
    service.send_range_report(
        recipient=payload.email,
        start_month=payload.start_month,
        end_month=payload.end_month,
        scope=payload.scope,
        search=payload.search,
        include_invoice_table=payload.include_invoice_table,
        fallback_month=payload.month,
    )
    return MessageResponse(message="Cash flow report sent")


@router.post("/report/preview")
def preview_cashflow_report(
    payload: CashFlowReportPreviewRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> Response:
    service = CashFlowService(CashFlowRepository(db))
    period_label, report_data = service.build_range_report_pdf(
        start_month=payload.start_month,
        end_month=payload.end_month,
        scope=payload.scope,
        search=payload.search,
        include_invoice_table=payload.include_invoice_table,
        fallback_month=payload.month,
    )
    headers = {"Content-Disposition": f'inline; filename="cashflow-report-{period_label}.pdf"'}
    return Response(content=report_data, media_type="application/pdf", headers=headers)


@router.post(
    "/share-links", response_model=CashFlowShareLinkRead, status_code=status.HTTP_201_CREATED
)
def create_cashflow_share_link(
    payload: CashFlowShareLinkCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> CashFlowShareLinkRead:
    return share_link_service(db).create(current_user, payload)


@router.get("/share-links", response_model=CashFlowShareLinkListResponse)
def list_cashflow_share_links(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "manager"))],
    scope: Annotated[str | None, Query(description="Cashflow scope")] = None,
) -> CashFlowShareLinkListResponse:
    return CashFlowShareLinkListResponse(
        items=share_link_service(db).list_links(current_user, scope)
    )


@router.delete("/share-links/{link_id}", response_model=CashFlowShareLinkRead)
def revoke_cashflow_share_link(
    link_id: str,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> CashFlowShareLinkRead:
    return share_link_service(db).revoke(current_user, link_id)


@router.get("/shared/{token}", response_model=CashFlowPublicShareResponse)
def get_public_cashflow_share(
    token: str,
    db: Annotated[Session, Depends(get_db)],
) -> CashFlowPublicShareResponse:
    return share_link_service(db).public_view(token)


@router.get("/shared/{token}/records/{record_id}/invoice")
def get_public_cashflow_invoice(
    token: str,
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    file_name, media_type, data = share_link_service(db).public_invoice(token, record_id)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{file_name}"'},
    )


@router.delete("/{record_id}", response_model=MessageResponse)
def delete_cashflow_record(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> MessageResponse:
    service = CashFlowService(CashFlowRepository(db))
    service.delete_record(record_id)
    return MessageResponse(message="Cash flow record deleted")
