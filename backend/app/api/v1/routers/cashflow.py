from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.repositories.cashflow_repository import CashFlowRepository
from app.schemas.auth import MessageResponse
from app.schemas.cashflow import CashFlowCreate, CashFlowListResponse, CashFlowReportRequest, CashFlowRow
from app.services.cashflow_service import CashFlowService

router = APIRouter()
MAX_INVOICE_BYTES = 10 * 1024 * 1024


def _parse_invoice_flag(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"yes", "true", "1"}:
        return True
    if normalized in {"no", "false", "0"}:
        return False
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invoice must be Yes or No")


@router.get("", response_model=CashFlowListResponse)
def list_cashflow_records(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
    month: Annotated[str | None, Query(description="Month in format YYYY-MM")] = None,
    search: Annotated[str | None, Query(description="Search by description or flat")] = None,
) -> CashFlowListResponse:
    service = CashFlowService(CashFlowRepository(db))
    return service.list_month(month=month, search=search)


@router.post("", response_model=CashFlowRow, status_code=status.HTTP_201_CREATED)
async def create_cashflow_record(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "manager"))],
    entry_type: Annotated[str, Form(alias="type")],
    invoice: Annotated[str, Form(alias="invoice")],
    record_date: Annotated[str, Form(alias="date")],
    value: Annotated[Decimal, Form(alias="value")],
    description: Annotated[str, Form(alias="description")],
    flat: Annotated[str, Form(alias="flat")],
    invoice_media: Annotated[UploadFile | None, File(alias="invoice_media")] = None,
) -> CashFlowRow:
    has_invoice = _parse_invoice_flag(invoice)

    if invoice_media and invoice_media.content_type:
        allowed = invoice_media.content_type.startswith("image/") or invoice_media.content_type == "application/pdf"
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice media must be an image or PDF",
            )

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
        entry_type=entry_type.strip().lower(),
        has_invoice=has_invoice,
        record_date=record_date,
        value=value,
        description=description,
        flat=flat,
    )

    service = CashFlowService(CashFlowRepository(db))
    created = service.create_record(
        user_id=current_user.id,
        payload=payload,
        invoice_media_name=invoice_name,
        invoice_media_mime=invoice_mime,
        invoice_media_data=invoice_bytes,
    )

    listing = service.list_month(month=created.record_date.strftime("%Y-%m"), search=None)
    for row in listing.items:
        if row.id == created.id:
            return row

    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Unable to build response")


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
    service.send_month_report(
        recipient=payload.email,
        month=payload.month,
        search=payload.search,
    )
    return MessageResponse(message="Cash flow report sent")


@router.delete("/{record_id}", response_model=MessageResponse)
def delete_cashflow_record(
    record_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "manager"))],
) -> MessageResponse:
    service = CashFlowService(CashFlowRepository(db))
    service.delete_record(record_id)
    return MessageResponse(message="Cash flow record deleted")
