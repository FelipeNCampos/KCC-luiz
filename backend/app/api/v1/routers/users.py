from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import EmployeeCreate, EmployeeUpdate, UserAdminUpdate, UserRead

router = APIRouter()
MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024


@router.get("/me", response_model=UserRead)
def read_my_profile(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user


@router.get("", response_model=list[UserRead])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin"))],
) -> list[User]:
    return UserRepository(db).list_all()


@router.get("/employees", response_model=list[UserRead])
def list_employees(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin"))],
) -> list[User]:
    return UserRepository(db).list_by_role("employee")


@router.post("/employees", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_employee(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin"))],
    full_name: Annotated[str, Form(alias="full_name")],
    email: Annotated[str, Form(alias="email")],
    password: Annotated[str, Form(alias="password")],
    job_title: Annotated[str | None, Form(alias="job_title")] = None,
    profile_photo: Annotated[UploadFile | None, File(alias="profile_photo")] = None,
) -> User:
    repository = UserRepository(db)
    payload = EmployeeCreate(full_name=full_name, email=email, password=password, job_title=job_title)
    if repository.get_by_email(payload.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    photo_name, photo_mime, photo_data = await _read_profile_photo(profile_photo)
    employee = User(
        name=payload.full_name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role="employee",
        job_title=payload.job_title.strip() if payload.job_title else None,
        profile_photo_name=photo_name,
        profile_photo_mime=photo_mime,
        profile_photo_data=photo_data,
    )
    return repository.save(employee)


@router.patch("/employees/{employee_id}", response_model=UserRead)
async def update_employee(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin"))],
    full_name: Annotated[str | None, Form(alias="full_name")] = None,
    email: Annotated[str | None, Form(alias="email")] = None,
    password: Annotated[str | None, Form(alias="password")] = None,
    job_title: Annotated[str | None, Form(alias="job_title")] = None,
    is_active: Annotated[bool | None, Form(alias="is_active")] = None,
    profile_photo: Annotated[UploadFile | None, File(alias="profile_photo")] = None,
) -> User:
    repository = UserRepository(db)
    employee = repository.get_by_id(employee_id)
    if employee is None or employee.role != "employee":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found")

    payload = EmployeeUpdate(
        full_name=full_name,
        email=email,
        password=password,
        job_title=job_title,
        is_active=is_active,
    )

    if payload.email and payload.email.lower() != employee.email:
        existing = repository.get_by_email(payload.email)
        if existing and existing.id != employee.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        employee.email = payload.email.lower()
    if payload.full_name is not None:
        employee.name = payload.full_name.strip()
    if payload.password:
        employee.password_hash = hash_password(payload.password)
    if payload.job_title is not None:
        employee.job_title = payload.job_title.strip() or None
    if payload.is_active is not None:
        employee.is_active = payload.is_active

    if profile_photo is not None:
        photo_name, photo_mime, photo_data = await _read_profile_photo(profile_photo)
        employee.profile_photo_name = photo_name
        employee.profile_photo_mime = photo_mime
        employee.profile_photo_data = photo_data

    return repository.save(employee)


@router.get("/employees/{employee_id}/photo")
def get_employee_photo(
    employee_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin"))],
) -> Response:
    employee = UserRepository(db).get_by_id(employee_id)
    if employee is None or employee.role != "employee" or not employee.profile_photo_data or not employee.profile_photo_mime:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee photo not found")
    return Response(
        content=employee.profile_photo_data,
        media_type=employee.profile_photo_mime,
        headers={"Content-Disposition": f'inline; filename="{employee.profile_photo_name or "profile-photo"}"'},
    )


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
) -> User:
    repository = UserRepository(db)
    user = repository.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id and (payload.role is not None or payload.is_active is not None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot change your own role or active status",
        )

    if payload.role is not None:
        user.role = payload.role
    if payload.job_title is not None:
        user.job_title = payload.job_title.strip() or None
    if payload.is_active is not None:
        user.is_active = payload.is_active

    return repository.save(user)


async def _read_profile_photo(profile_photo: UploadFile | None) -> tuple[str | None, str | None, bytes | None]:
    if profile_photo is None:
        return None, None, None
    if not profile_photo.content_type or not profile_photo.content_type.startswith("image/"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Profile photo must be an image")
    payload = await profile_photo.read()
    if len(payload) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Profile photo is too large")
    return profile_photo.filename, profile_photo.content_type, payload
