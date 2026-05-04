import base64
import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.oakhill import Building, Condominio, FlatInstruction
from app.models.user import User
from app.schemas.instructions import FlatInstructionRead, FlatInstructionSave

router = APIRouter()
PUBLIC_FLATS = ("50", "51", "52")
VIDEO_DATA_URL_RE = re.compile(r"^data:(video/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$")
MAX_VIDEO_BYTES = 80 * 1024 * 1024


def manager_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role in {"admin", "manager"} or (current_user.cargo is not None and current_user.cargo >= 2):
        return current_user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


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
    building = db.scalar(select(Building).where(Building.condominio_id == condominio.id, Building.nome == name))
    if building is None:
        building = Building(nome=name, condominio_id=condominio.id)
        db.add(building)
        db.commit()
        db.refresh(building)
    return building


def instruction_read(row: FlatInstruction) -> FlatInstructionRead:
    return FlatInstructionRead(
        id=row.id,
        title=row.title,
        video_url=row.video_url,
        video_name=row.video_name,
        video_data=row.video_data,
        description=row.description,
        position=row.position,
        building_id=row.building_id,
        condominio_id=row.condominio_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def validate_video(value: str | None) -> str | None:
    if not value:
        return None
    match = VIDEO_DATA_URL_RE.match(value)
    if not match:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid instruction video")
    try:
        decoded = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid instruction video") from exc
    if not decoded:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid instruction video")
    if len(decoded) > MAX_VIDEO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Instruction video is too large")
    return value


def instruction_rows(db: Session, condominio_id: str, building_id: str) -> list[FlatInstruction]:
    return list(
        db.scalars(
            select(FlatInstruction)
            .where(FlatInstruction.condominio_id == condominio_id, FlatInstruction.building_id == building_id)
            .order_by(FlatInstruction.position.asc(), FlatInstruction.created_at.asc())
        )
    )


@router.get("/public-instructions/{flat}", response_model=dict[str, list[FlatInstructionRead] | int | str])
def public_flat_instructions(
    flat: str,
    condominio_id: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, list[FlatInstructionRead] | int | str]:
    building = resolve_public_flat(db, flat, condominio_id)
    rows = instruction_rows(db, building.condominio_id, building.id)
    return {"flat": flat, "building_id": building.id, "building_name": building.nome, "data": [instruction_read(row) for row in rows], "count": len(rows)}


@router.get("/flat-instructions/{flat}", response_model=dict[str, list[FlatInstructionRead] | int | str])
def get_flat_instructions(
    flat: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> dict[str, list[FlatInstructionRead] | int | str]:
    condominio_id = user_condominio_id(db, current_user)
    building = resolve_public_flat(db, flat, condominio_id)
    rows = instruction_rows(db, condominio_id, building.id)
    return {"flat": flat, "building_id": building.id, "building_name": building.nome, "data": [instruction_read(row) for row in rows], "count": len(rows)}


@router.put("/flat-instructions/{flat}", response_model=dict[str, list[FlatInstructionRead] | int | str])
def save_flat_instructions(
    flat: str,
    payload: FlatInstructionSave,
    db: Session = Depends(get_db),
    current_user: User = Depends(manager_user),
) -> dict[str, list[FlatInstructionRead] | int | str]:
    condominio_id = user_condominio_id(db, current_user)
    building = resolve_public_flat(db, flat, condominio_id)
    existing = instruction_rows(db, condominio_id, building.id)
    for row in existing:
        db.delete(row)
    db.flush()

    for index, item in enumerate(payload.items):
        title = item.title.strip()
        description = item.description.strip()
        video_url = item.video_url.strip() if item.video_url and item.video_url.strip() else None
        video_name = item.video_name.strip() if item.video_name and item.video_name.strip() else None
        video_data = validate_video(item.video_data)
        if not title or not description:
            continue
        db.add(
            FlatInstruction(
                title=title,
                video_url=video_url,
                video_name=video_name if video_data else None,
                video_data=video_data,
                description=description,
                position=index,
                building_id=building.id,
                condominio_id=condominio_id,
            )
        )

    db.commit()
    rows = instruction_rows(db, condominio_id, building.id)
    return {"flat": flat, "building_id": building.id, "building_name": building.nome, "data": [instruction_read(row) for row in rows], "count": len(rows)}
