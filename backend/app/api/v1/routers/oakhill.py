import base64
import calendar
import re
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.oakhill import (
    Acess,
    Building,
    Condominio,
    ContractorHistory,
    ContractorHistoryCategory,
    ContractorVisit,
    Funcionario,
)
from app.models.user import User
from app.schemas.oakhill import (
    AcessActiveRead,
    AcessCreate,
    AcessRead,
    AcessUpdate,
    BuildingRead,
    ContractorBuildingRead,
    ContractorCheckIn,
    ContractorCheckOut,
    ContractorHistoryCategoryCreate,
    ContractorHistoryCategoryRead,
    ContractorHistoryRead,
    ContractorHistoryWrite,
    ContractorMediaUpdate,
    ContractorOpenVisit,
    ContractorPublicVisit,
    ContractorVisitRead,
    ExecuteDueRead,
    FuncionarioCreate,
    FuncionarioRead,
    FuncionarioUpdate,
)
from app.services.sms_service import normalize_phone, send_sms_notification

router = APIRouter()
DATA_URL_RE = re.compile(r"^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$")
MAX_MEDIA_BYTES = 10 * 1024 * 1024
PUBLIC_FLATS = ("50", "51", "52")


def now_utc() -> datetime:
    return datetime.now(UTC)


def manager_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in {"admin", "manager"} or (current_user.cargo is not None and current_user.cargo >= 2):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


def user_condominio_id(db: Session, user: User | None = None, explicit: str | None = None) -> str:
    if explicit:
        condominio = db.get(Condominio, explicit)
        if condominio is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condominio not found")
        return explicit
    if user and user.condominio_id:
        return user.condominio_id
    condominio = db.scalar(select(Condominio).order_by(Condominio.nome.asc()))
    if condominio is None:
        condominio = Condominio(nome="OakHill Park")
        db.add(condominio)
        db.commit()
        db.refresh(condominio)
    return condominio.id


def default_condominio(db: Session) -> Condominio:
    condominio = db.scalar(select(Condominio).order_by(Condominio.nome.asc()))
    if condominio is None:
        condominio = Condominio(nome="OakHill Park")
        db.add(condominio)
        db.commit()
        db.refresh(condominio)
    return condominio


def flat_name(value: str) -> str:
    normalized = value.strip().removeprefix("Flat ").strip()
    if normalized not in PUBLIC_FLATS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flat not found")
    return f"Flat {normalized}"


def resolve_public_flat(db: Session, value: str, condominio_id: str | None = None) -> Building:
    condominio = db.get(Condominio, condominio_id) if condominio_id else default_condominio(db)
    if condominio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condominio not found")
    name = flat_name(value)
    building = db.scalar(
        select(Building).where(Building.condominio_id == condominio.id, Building.nome == name)
    )
    if building is None:
        building = Building(nome=name, condominio_id=condominio.id)
        db.add(building)
        db.commit()
        db.refresh(building)
    return building


def active_cleaner(db: Session, condominio_id: str | None = None) -> Funcionario:
    if condominio_id is None:
        condominio_id = default_condominio(db).id
    base = select(Funcionario).where(Funcionario.cargo == 0, Funcionario.status.is_(True))
    if condominio_id:
        base = base.where(Funcionario.condominio_id == condominio_id)
    cleaner = db.scalar(base.where(Funcionario.is_default.is_(True)).order_by(Funcionario.nome.asc()))
    cleaner = cleaner or db.scalar(base.order_by(Funcionario.nome.asc()))
    if cleaner is None:
        cleaner = Funcionario(
            status=True,
            is_default=True,
            nome="Cleaner",
            mobile=None,
            cargo=0,
            email=None,
            condominio_id=condominio_id,
        )
        db.add(cleaner)
        db.commit()
        db.refresh(cleaner)
    return cleaner


def last_access(db: Session, funcionario_id: str) -> Acess | None:
    return db.scalar(
        select(Acess)
        .where(Acess.funcionario_id == funcionario_id)
        .order_by(Acess.data.desc(), Acess.operacao.asc())
    )


def open_access(db: Session, funcionario_id: str) -> Acess | None:
    latest = last_access(db, funcionario_id)
    return latest if latest and latest.operacao == 0 else None


def row_access(item: Acess) -> AcessRead:
    return AcessRead(
        id=item.id,
        status=item.status,
        data=item.data,
        operacao=item.operacao,
        building_id=item.building_id,
        funcionario_id=item.funcionario_id,
    )


def row_funcionario(item: Funcionario) -> FuncionarioRead:
    return FuncionarioRead(
        id=item.id,
        status=item.status,
        is_default=item.is_default,
        nome=item.nome,
        mobile=item.mobile,
        cargo=item.cargo,
        email=item.email,
        condominio_id=item.condominio_id,
    )


def maybe_send_cleaner_sms(body: str) -> None:
    phone = normalize_phone(settings.cleaner_status_sms_to)
    if not phone:
        return
    send_sms_notification(phone, body)


def valid_cleaner_building_name(name: str) -> bool:
    return name.strip() in {f"Flat {flat}" for flat in PUBLIC_FLATS}


def day_bounds(moment: datetime) -> tuple[datetime, datetime]:
    start = moment.astimezone(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def day_complete(db: Session, condominio_id: str, funcionario_id: str, moment: datetime) -> bool:
    start, end = day_bounds(moment)
    buildings = list(db.scalars(select(Building).where(Building.condominio_id == condominio_id)))
    valid_ids = {building.id for building in buildings if valid_cleaner_building_name(building.nome)}
    if not valid_ids:
        return False
    rows = list(
        db.scalars(
            select(Acess).where(
                Acess.funcionario_id == funcionario_id,
                Acess.data >= start,
                Acess.data < end,
                Acess.building_id.in_(valid_ids),
            )
        )
    )
    seen = {building_id: set() for building_id in valid_ids}
    for item in rows:
        seen[item.building_id].add(item.operacao)
    return all({0, 1}.issubset(ops) for ops in seen.values())


@router.get("/buildings/condominio")
def list_condominio_buildings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "manager", "employee")),
) -> dict[str, list[BuildingRead] | int]:
    condominio_id = user_condominio_id(db, current_user)
    rows = list(db.scalars(select(Building).where(Building.condominio_id == condominio_id).order_by(Building.nome.asc())))
    return {"data": [BuildingRead(id=row.id, nome=row.nome, condominio_id=row.condominio_id) for row in rows], "count": len(rows)}


@router.get("/acess/active", response_model=AcessActiveRead)
def get_active_cleaner_access(
    building_id: str | None = None,
    db: Session = Depends(get_db),
) -> AcessActiveRead:
    requested_building = resolve_public_flat(db, building_id) if building_id else None
    cleaner = active_cleaner(db)
    opened = open_access(db, cleaner.id)
    active_id = opened.building_id if opened else None
    return AcessActiveRead(
        has_open_session=opened is not None,
        building_id=building_id if requested_building and active_id == requested_building.id else active_id,
    )


@router.post("/acess/", response_model=AcessRead, status_code=status.HTTP_201_CREATED)
def create_access(payload: AcessCreate, db: Session = Depends(get_db)) -> AcessRead:
    building = resolve_public_flat(db, payload.building_id)
    if building.nome.strip().casefold() == "office":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Office is not valid for cleaner access")

    cleaner = active_cleaner(db, building.condominio_id)
    moment = payload.data or now_utc()
    is_backfill = payload.data is not None
    was_complete = day_complete(db, building.condominio_id, cleaner.id, moment) if not is_backfill else False

    if not is_backfill:
        opened = open_access(db, cleaner.id)
        if payload.operacao == 0:
            if opened and opened.building_id == building.id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cleaner already has an open session")
            if opened and opened.building_id != building.id:
                db.add(Acess(status=True, operacao=1, building_id=opened.building_id, funcionario_id=cleaner.id, data=moment))
            start, end = day_bounds(moment)
            first_in = db.scalar(
                select(Acess.id).where(Acess.funcionario_id == cleaner.id, Acess.operacao == 0, Acess.data >= start, Acess.data < end)
            )
            if first_in is None:
                maybe_send_cleaner_sms("Cleaner IN")
        elif payload.operacao == 1:
            if opened is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cleaner does not have an open session to close")
        else:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid operation")

    access = Acess(status=payload.status, operacao=payload.operacao, building_id=building.id, funcionario_id=cleaner.id, data=moment)
    db.add(access)
    db.commit()
    db.refresh(access)
    if not is_backfill and payload.operacao == 1 and not was_complete and day_complete(db, building.condominio_id, cleaner.id, moment):
        maybe_send_cleaner_sms("Cleaner OUT")
    return row_access(access)


@router.get("/acess/")
def list_access(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin", "manager", "employee")),
) -> dict[str, list[AcessRead] | int]:
    statement = select(Acess).order_by(Acess.data.desc()).offset(skip).limit(limit)
    count = db.scalar(select(func.count(Acess.id))) or 0
    rows = list(db.scalars(statement))
    return {"data": [row_access(row) for row in rows], "count": count}


@router.patch("/acess/{access_id}", response_model=AcessRead)
def update_access(access_id: str, payload: AcessUpdate, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "manager", "employee"))) -> AcessRead:
    item = db.get(Acess, access_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access not found")
    for field in ("status", "data", "operacao", "building_id"):
        value = getattr(payload, field)
        if value is not None:
            setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return row_access(item)


@router.delete("/acess/{access_id}")
def delete_access(access_id: str, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "manager", "employee"))) -> dict[str, str]:
    item = db.get(Acess, access_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access not found")
    db.delete(item)
    db.commit()
    return {"message": "Access deleted"}


@router.get("/funcionarios/")
def list_funcionarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "manager", "employee"))) -> dict[str, list[FuncionarioRead] | int]:
    count = db.scalar(select(func.count(Funcionario.id))) or 0
    rows = list(db.scalars(select(Funcionario).order_by(Funcionario.nome.asc()).offset(skip).limit(limit)))
    return {"data": [row_funcionario(row) for row in rows], "count": count}


@router.post("/funcionarios/", response_model=FuncionarioRead, status_code=status.HTTP_201_CREATED)
def create_funcionario(payload: FuncionarioCreate, db: Session = Depends(get_db), _: User = Depends(manager_user)) -> FuncionarioRead:
    item = Funcionario(**payload.model_dump())
    db.add(item)
    if item.cargo == 0 and item.is_default:
        db.query(Funcionario).filter(
            Funcionario.condominio_id == item.condominio_id,
            Funcionario.cargo == 0,
            Funcionario.id != item.id,
        ).update({"is_default": False})
    db.commit()
    db.refresh(item)
    return row_funcionario(item)


@router.patch("/funcionarios/{funcionario_id}", response_model=FuncionarioRead)
def update_funcionario(funcionario_id: str, payload: FuncionarioUpdate, db: Session = Depends(get_db), _: User = Depends(manager_user)) -> FuncionarioRead:
    item = db.get(Funcionario, funcionario_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funcionario not found")
    if payload.is_default is True and item.cargo == 0:
        db.query(Funcionario).filter(
            Funcionario.condominio_id == item.condominio_id,
            Funcionario.cargo == 0,
            Funcionario.id != item.id,
        ).update({"is_default": False})
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    return row_funcionario(item)


def normalize_name(value: str) -> str:
    return " ".join(value.casefold().strip().split())


def door_code_for(building_name: str) -> str | None:
    lookup = {normalize_name(key): value for key, value in settings.contractor_door_code_map.items()}
    return lookup.get(normalize_name(building_name))


def public_visit(row: ContractorVisit) -> ContractorPublicVisit:
    return ContractorPublicVisit(
        id=row.id,
        name=row.name,
        company=row.company,
        building_name=row.block,
        door_code=door_code_for(row.block),
        job_description=row.job_description,
        mobile=row.mobile,
        in_at=row.in_at,
        out_at=row.out_at,
        condominio_id=row.condominio_id,
    )


def visit_read(row: ContractorVisit) -> ContractorVisitRead:
    return ContractorVisitRead(
        id=row.id,
        name=row.name,
        company=row.company,
        building_name=row.block,
        job_description=row.job_description,
        mobile=row.mobile,
        extra_media_name=row.extra_media_name,
        extra_media_data=row.extra_media_data,
        extra_media_2_name=row.extra_media_2_name,
        extra_media_2_data=row.extra_media_2_data,
        extra_media_3_name=row.extra_media_3_name,
        extra_media_3_data=row.extra_media_3_data,
        extra_media_4_name=row.extra_media_4_name,
        extra_media_4_data=row.extra_media_4_data,
        in_at=row.in_at,
        out_at=row.out_at,
        condominio_id=row.condominio_id,
    )


@router.get("/contractor-access/buildings")
def contractor_buildings(
    condominio_id: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, list[ContractorBuildingRead] | int]:
    condominio = db.get(Condominio, condominio_id) if condominio_id else default_condominio(db)
    if condominio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condominio not found")
    rows = [resolve_public_flat(db, flat, condominio.id) for flat in PUBLIC_FLATS]
    return {"data": [ContractorBuildingRead(id=row.id, name=row.nome) for row in rows], "count": len(rows)}


@router.get("/contractor-access/open")
def contractor_open(
    condominio_id: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, list[ContractorOpenVisit] | int]:
    condominio = db.get(Condominio, condominio_id) if condominio_id else default_condominio(db)
    if condominio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condominio not found")
    rows = list(
        db.scalars(select(ContractorVisit).where(ContractorVisit.condominio_id == condominio.id, ContractorVisit.out_at.is_(None)).order_by(ContractorVisit.in_at.desc()))
    )
    data = [
        ContractorOpenVisit(
            id=row.id,
            name=row.name,
            company=row.company,
            building_name=row.block,
            job_description=row.job_description,
            mobile=row.mobile,
            in_at=row.in_at,
        )
        for row in rows
    ]
    return {"data": data, "count": len(data)}


@router.post("/contractor-access/check-in", response_model=ContractorPublicVisit, status_code=status.HTTP_201_CREATED)
def contractor_check_in(payload: ContractorCheckIn, db: Session = Depends(get_db)) -> ContractorPublicVisit:
    building = resolve_public_flat(db, payload.building_id, payload.condominio_id)
    row = ContractorVisit(
        name=payload.name.strip(),
        company=payload.company.strip(),
        block=building.nome,
        job_description=payload.job_description.strip(),
        mobile=payload.mobile.strip(),
        condominio_id=building.condominio_id,
        in_at=now_utc(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return public_visit(row)


@router.post("/contractor-access/check-out", response_model=ContractorPublicVisit)
def contractor_check_out(payload: ContractorCheckOut, db: Session = Depends(get_db)) -> ContractorPublicVisit:
    condominio = db.get(Condominio, payload.condominio_id) if payload.condominio_id else default_condominio(db)
    if condominio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Condominio not found")
    row = db.get(ContractorVisit, payload.visit_id)
    if row is None or row.condominio_id != condominio.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contractor visit not found")
    if row.out_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contractor already checked out")
    row.out_at = now_utc()
    db.add(row)
    db.commit()
    db.refresh(row)
    return public_visit(row)


@router.get("/contractor-access/")
def list_contractor_visits(
    skip: int = 0,
    limit: int = 200,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> dict[str, list[ContractorVisitRead] | int]:
    condominio_id = user_condominio_id(db, current_user)
    conditions = [ContractorVisit.condominio_id == condominio_id]
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        conditions.append(or_(ContractorVisit.name.ilike(pattern), ContractorVisit.company.ilike(pattern), ContractorVisit.block.ilike(pattern), ContractorVisit.job_description.ilike(pattern)))
    if date_from:
        conditions.append(ContractorVisit.in_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC))
    if date_to:
        conditions.append(ContractorVisit.in_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC))
    count = db.scalar(select(func.count(ContractorVisit.id)).where(*conditions)) or 0
    rows = list(db.scalars(select(ContractorVisit).where(*conditions).order_by(ContractorVisit.in_at.desc()).offset(skip).limit(limit)))
    return {"data": [visit_read(row) for row in rows], "count": count}


def validate_data_url(field_name: str, value: str | None) -> str | None:
    if not value:
        return None
    match = DATA_URL_RE.match(value)
    if not match:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid {field_name}")
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid {field_name}") from exc
    if not decoded:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid {field_name}")
    if len(decoded) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"{field_name} is too large")
    return value


@router.patch("/contractor-access/{visit_id}/media", response_model=ContractorVisitRead)
def update_contractor_media(visit_id: str, payload: ContractorMediaUpdate, db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> ContractorVisitRead:
    condominio_id = user_condominio_id(db, current_user)
    row = db.get(ContractorVisit, visit_id)
    if row is None or row.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contractor visit not found")
    for suffix in ("", "_2", "_3", "_4"):
        data_field = f"extra_media{suffix}_data"
        name_field = f"extra_media{suffix}_name"
        data = validate_data_url(data_field, getattr(payload, data_field))
        setattr(row, data_field, data)
        setattr(row, name_field, getattr(payload, name_field) if data else None)
    db.add(row)
    db.commit()
    db.refresh(row)
    return visit_read(row)


@router.get("/contractor-access/history/categories")
def list_history_categories(db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> dict[str, list[ContractorHistoryCategoryRead] | int]:
    condominio_id = user_condominio_id(db, current_user)
    rows = list(db.scalars(select(ContractorHistoryCategory).where(ContractorHistoryCategory.condominio_id == condominio_id).order_by(ContractorHistoryCategory.name.asc())))
    return {"data": rows, "count": len(rows)}


@router.post("/contractor-access/history/categories", response_model=ContractorHistoryCategoryRead, status_code=status.HTTP_201_CREATED)
def create_history_category(payload: ContractorHistoryCategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> ContractorHistoryCategoryRead:
    condominio_id = user_condominio_id(db, current_user)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Name is required")
    duplicate = db.scalar(select(ContractorHistoryCategory).where(ContractorHistoryCategory.condominio_id == condominio_id, func.lower(ContractorHistoryCategory.name) == name.casefold()))
    if duplicate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contractor history category already exists")
    row = ContractorHistoryCategory(name=name, condominio_id=condominio_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def add_months(value: datetime, months: int) -> datetime:
    month = value.month - 1 + months
    year = value.year + month // 12
    month = month % 12 + 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def compute_schedule(visit: ContractorVisit, enabled: bool, unit: str | None, count: int | None) -> tuple[datetime | None, datetime | None]:
    if not enabled:
        return None, None
    if unit not in {"week", "month"} or not count or count < 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid schedule")
    base = visit.out_at or visit.in_at
    if unit == "week":
        next_job = base + timedelta(weeks=count)
        return next_job, next_job - timedelta(days=2)
    next_job = add_months(base, count)
    return next_job, next_job - timedelta(days=7)


def history_read(row: ContractorHistory) -> ContractorHistoryRead:
    return ContractorHistoryRead(
        id=row.id,
        category_id=row.category_id,
        category_name=row.category.name,
        contractor_visit_id=row.contractor_visit_id,
        created_new_visit=row.created_new_visit,
        next_enabled=row.next_enabled,
        next_interval_unit=row.next_interval_unit,
        next_interval_value=row.next_interval_value,
        next_job_at=row.next_job_at,
        next_notify_at=row.next_notify_at,
        next_notification_sent_at=row.next_notification_sent_at,
        name=row.visit.name,
        company=row.visit.company,
        building_name=row.visit.block,
        job_description=row.visit.job_description,
        mobile=row.visit.mobile,
        visit_in_at=row.visit.in_at,
        visit_out_at=row.visit.out_at,
        history_created_at=row.created_at,
        history_updated_at=row.updated_at,
        condominio_id=row.condominio_id,
    )


def resolve_history_visit(payload: ContractorHistoryWrite, condominio_id: str, db: Session, existing: ContractorHistory | None = None) -> ContractorVisit:
    if not payload.created_new_visit:
        if not payload.contractor_visit_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="contractor_visit_id is required")
        visit = db.get(ContractorVisit, payload.contractor_visit_id)
        if visit is None or visit.condominio_id != condominio_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contractor visit not found")
        return visit
    if not all([payload.name, payload.company, payload.building_id, payload.job_description, payload.mobile, payload.in_at, payload.out_at]):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Manual visit fields are required")
    if payload.out_at < payload.in_at:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="out_at must be after in_at")
    building = db.get(Building, payload.building_id)
    if building is None or building.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Building not found")
    visit = existing.visit if existing and existing.created_new_visit else ContractorVisit(condominio_id=condominio_id)
    visit.name = payload.name.strip()
    visit.company = payload.company.strip()
    visit.block = building.nome
    visit.job_description = payload.job_description.strip()
    visit.mobile = payload.mobile.strip()
    visit.in_at = payload.in_at.astimezone(UTC)
    visit.out_at = payload.out_at.astimezone(UTC)
    db.add(visit)
    db.flush()
    return visit


@router.get("/contractor-access/history")
def list_history(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    building_name: str | None = None,
    category_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> dict[str, list[ContractorHistoryRead] | int]:
    condominio_id = user_condominio_id(db, current_user)
    statement = select(ContractorHistory).options(joinedload(ContractorHistory.visit), joinedload(ContractorHistory.category)).join(ContractorVisit).where(ContractorHistory.condominio_id == condominio_id)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(or_(ContractorVisit.name.ilike(pattern), ContractorVisit.company.ilike(pattern), ContractorVisit.job_description.ilike(pattern)))
    if building_name:
        statement = statement.where(ContractorVisit.block == building_name)
    if category_id:
        statement = statement.where(ContractorHistory.category_id == category_id)
    if date_from:
        statement = statement.where(ContractorVisit.in_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC))
    if date_to:
        statement = statement.where(ContractorVisit.in_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC))
    rows = list(db.scalars(statement.order_by(ContractorHistory.created_at.desc()).offset(skip).limit(limit)))
    count = len(list(db.scalars(statement)))
    return {"data": [history_read(row) for row in rows], "count": count}


@router.post("/contractor-access/history", response_model=ContractorHistoryRead, status_code=status.HTTP_201_CREATED)
def create_history(payload: ContractorHistoryWrite, db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> ContractorHistoryRead:
    condominio_id = user_condominio_id(db, current_user)
    category = db.get(ContractorHistoryCategory, payload.category_id)
    if category is None or category.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    visit = resolve_history_visit(payload, condominio_id, db)
    next_job_at, next_notify_at = compute_schedule(visit, payload.next_enabled, payload.next_interval_unit, payload.next_interval_value)
    row = ContractorHistory(
        condominio_id=condominio_id,
        category_id=category.id,
        contractor_visit_id=visit.id,
        created_new_visit=payload.created_new_visit,
        next_enabled=payload.next_enabled,
        next_interval_unit=payload.next_interval_unit if payload.next_enabled else None,
        next_interval_value=payload.next_interval_value if payload.next_enabled else None,
        next_job_at=next_job_at,
        next_notify_at=next_notify_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row, attribute_names=["visit", "category"])
    return history_read(row)


@router.patch("/contractor-access/history/{history_id}", response_model=ContractorHistoryRead)
def update_history(history_id: str, payload: ContractorHistoryWrite, db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> ContractorHistoryRead:
    condominio_id = user_condominio_id(db, current_user)
    row = db.get(ContractorHistory, history_id)
    if row is None or row.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History not found")
    category = db.get(ContractorHistoryCategory, payload.category_id)
    if category is None or category.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    visit = resolve_history_visit(payload, condominio_id, db, existing=row)
    next_job_at, next_notify_at = compute_schedule(visit, payload.next_enabled, payload.next_interval_unit, payload.next_interval_value)
    row.category_id = category.id
    row.contractor_visit_id = visit.id
    row.created_new_visit = payload.created_new_visit
    row.next_enabled = payload.next_enabled
    row.next_interval_unit = payload.next_interval_unit if payload.next_enabled else None
    row.next_interval_value = payload.next_interval_value if payload.next_enabled else None
    row.next_job_at = next_job_at
    row.next_notify_at = next_notify_at
    row.next_notification_sent_at = None
    row.updated_at = now_utc()
    db.add(row)
    db.commit()
    db.refresh(row, attribute_names=["visit", "category"])
    return history_read(row)


@router.delete("/contractor-access/history/{history_id}")
def delete_history(history_id: str, db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> dict[str, str]:
    condominio_id = user_condominio_id(db, current_user)
    row = db.get(ContractorHistory, history_id)
    if row is None or row.condominio_id != condominio_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="History not found")
    db.delete(row)
    db.commit()
    return {"message": "Contractor history deleted"}


@router.post("/contractor-access/history/execute-due", response_model=ExecuteDueRead)
def execute_due(db: Session = Depends(get_db), current_user: User = Depends(manager_user)) -> ExecuteDueRead:
    condominio_id = user_condominio_id(db, current_user)
    rows = list(
        db.scalars(
            select(ContractorHistory)
            .options(joinedload(ContractorHistory.visit), joinedload(ContractorHistory.category))
            .where(
                ContractorHistory.condominio_id == condominio_id,
                ContractorHistory.next_enabled.is_(True),
                ContractorHistory.next_notify_at.is_not(None),
                ContractorHistory.next_notify_at <= now_utc(),
                ContractorHistory.next_notification_sent_at.is_(None),
            )
        )
    )
    sent = 0
    for row in rows:
        body = (
            f"OakHill Park: next contractor job scheduled for {row.next_job_at.strftime('%d/%m/%Y %H:%M')}. "
            f"Contractor: {row.visit.name}. Company: {row.visit.company}. Job: {row.visit.job_description}. "
            f"Building: {row.visit.block}. Category: {row.category.name}."
        )
        phone = normalize_phone(row.visit.mobile)
        if phone and send_sms_notification(phone, body):
            row.next_notification_sent_at = now_utc()
            row.updated_at = now_utc()
            sent += 1
            db.add(row)
    db.commit()
    return ExecuteDueRead(checked=len(rows), triggered=len(rows), sms_sent=sent)
