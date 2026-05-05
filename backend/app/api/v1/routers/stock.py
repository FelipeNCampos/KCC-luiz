import base64
import re
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.oakhill import Condominio, StockRequest
from app.models.user import User
from app.schemas.stock import (
    StockRequestCreate,
    StockRequestCreateResponse,
    StockRequestItemCreate,
    StockRequestRead,
    StockRequestStatus,
    StockRequestStatusUpdate,
)

router = APIRouter()

DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$")
MAX_PHOTO_BYTES = 8 * 1024 * 1024


def now_utc() -> datetime:
    return datetime.now(UTC)


def default_condominio(db: Session) -> Condominio:
    condominio = db.scalar(select(Condominio).order_by(Condominio.nome.asc()))
    if condominio is None:
        condominio = Condominio(nome="OakHill Park")
        db.add(condominio)
        db.commit()
        db.refresh(condominio)
    return condominio


def user_condominio_id(db: Session, user: User | None = None, explicit: str | None = None) -> str:
    if explicit:
        condominio = db.get(Condominio, explicit)
        if condominio is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condominio not found")
        return explicit
    if user and user.condominio_id:
        return user.condominio_id
    return default_condominio(db).id


def manager_user(current_user: User = Depends(require_roles("admin", "manager"))) -> User:
    return current_user


def validate_photo(value: str | None) -> str | None:
    if not value:
        return None
    match = DATA_URL_RE.match(value)
    if not match:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid product photo")
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid product photo") from exc
    if not decoded:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid product photo")
    if len(decoded) > MAX_PHOTO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Product photo is too large")
    return value


def read_request(row: StockRequest) -> StockRequestRead:
    return StockRequestRead(
        id=row.id,
        product_name=row.product_name,
        quantity=row.quantity,
        photo_name=row.photo_name,
        photo_data=row.photo_data,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        condominio_id=row.condominio_id,
    )


def normalized_items(payload: StockRequestCreate) -> list[StockRequestItemCreate]:
    if payload.items:
        return payload.items

    if payload.product_name is None or payload.quantity is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Product name and quantity are required",
        )

    return [
        StockRequestItemCreate(
            product_name=payload.product_name,
            quantity=payload.quantity,
        )
    ]


@router.post(
    "/stock-requests",
    response_model=StockRequestRead | StockRequestCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_stock_request(
    payload: StockRequestCreate,
    db: Session = Depends(get_db),
) -> StockRequestRead | StockRequestCreateResponse:
    condominio_id = user_condominio_id(db, explicit=payload.condominio_id)
    items = normalized_items(payload)
    photo_name = payload.photo_name.strip() if payload.photo_name and payload.photo_name.strip() else None
    photo_data = validate_photo(payload.photo_data)
    rows: list[StockRequest] = []

    for item in items:
        product_name = item.product_name.strip()
        if not product_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Product name is required",
            )

        row = StockRequest(
            product_name=product_name,
            quantity=item.quantity,
            photo_name=photo_name,
            photo_data=photo_data,
            status="pending",
            condominio_id=condominio_id,
        )
        db.add(row)
        rows.append(row)

    db.commit()
    for row in rows:
        db.refresh(row)

    if payload.items:
        return StockRequestCreateResponse(
            data=[read_request(row) for row in rows],
            count=len(rows),
        )

    return read_request(rows[0])


@router.get("/stock-requests")
def list_stock_requests(
    skip: int = 0,
    limit: int = 200,
    search: str | None = None,
    status_filter: StockRequestStatus | None = Query(default=None, alias="status"),
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> dict[str, list[StockRequestRead] | int]:
    condominio_id = user_condominio_id(db, current_user)
    conditions = [StockRequest.condominio_id == condominio_id]
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(StockRequest.product_name.ilike(pattern))
    if status_filter:
        conditions.append(StockRequest.status == status_filter)
    else:
        conditions.append(StockRequest.status != "archived")
    if date_from:
        conditions.append(StockRequest.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC))
    if date_to:
        conditions.append(StockRequest.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC))

    count = db.scalar(select(func.count(StockRequest.id)).where(*conditions)) or 0
    rows = list(
        db.scalars(
            select(StockRequest)
            .where(*conditions)
            .order_by(StockRequest.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
    )
    return {"data": [read_request(row) for row in rows], "count": count}


@router.patch("/stock-requests/{request_id}/status", response_model=StockRequestRead)
def update_stock_request_status(
    request_id: str,
    payload: StockRequestStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> StockRequestRead:
    condominio_id = user_condominio_id(db, current_user)
    row = db.get(StockRequest, request_id)
    if row is None or row.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock request not found")
    row.status = payload.status
    row.updated_at = now_utc()
    db.add(row)
    db.commit()
    db.refresh(row)
    return read_request(row)


@router.delete("/stock-requests/{request_id}", response_model=StockRequestRead)
def archive_stock_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> StockRequestRead:
    condominio_id = user_condominio_id(db, current_user)
    row = db.get(StockRequest, request_id)
    if row is None or row.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stock request not found")
    row.status = "archived"
    row.updated_at = now_utc()
    db.add(row)
    db.commit()
    db.refresh(row)
    return read_request(row)
