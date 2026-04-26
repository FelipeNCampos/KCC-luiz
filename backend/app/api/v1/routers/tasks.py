from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import MessageResponse
from app.schemas.task import (
    TaskDetailRead,
    TaskListResponse,
    TaskMediaRead,
    TaskMessageCreate,
    TaskMessageRead,
    TaskModuleSettingsRead,
    TaskModuleSettingsUpdate,
    TaskUpdateRequest,
)
from app.services.task_service import TaskService

router = APIRouter()


def _service(db: Session) -> TaskService:
    return TaskService(TaskRepository(db), UserRepository(db))


@router.get("/module", response_model=TaskModuleSettingsRead)
def get_module_settings(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> TaskModuleSettingsRead:
    return _service(db).get_module_settings()


@router.patch("/module", response_model=TaskModuleSettingsRead)
def update_module_settings(
    payload: TaskModuleSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin"))],
) -> TaskModuleSettingsRead:
    return _service(db).update_module_settings(payload.is_active)


@router.get("", response_model=TaskListResponse)
def list_tasks(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "employee"))],
    search: Annotated[str | None, Query()] = None,
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    created_from: Annotated[datetime | None, Query()] = None,
    created_to: Annotated[datetime | None, Query()] = None,
    modified_from: Annotated[datetime | None, Query()] = None,
    modified_to: Annotated[datetime | None, Query()] = None,
    sort: Annotated[str | None, Query()] = None,
) -> TaskListResponse:
    return _service(db).list_tasks(
        current_user,
        search,
        status_filter,
        created_from,
        created_to,
        modified_from,
        modified_to,
        sort,
    )


@router.post("", response_model=TaskDetailRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
    name: Annotated[str, Form(alias="name")],
    description: Annotated[str | None, Form(alias="description")] = None,
    initial_status: Annotated[str, Form(alias="initial_status")] = "todo",
    assigned_user_ids: Annotated[str | None, Form(alias="assigned_user_ids")] = None,
    cover_photo: Annotated[UploadFile | None, File(alias="cover_photo")] = None,
) -> TaskDetailRead:
    cover_data = await cover_photo.read() if cover_photo is not None else None
    return _service(db).create_task(
        user=current_user,
        name=name,
        description=description,
        status_value=initial_status,
        assigned_user_ids=TaskService.parse_assigned_user_ids(assigned_user_ids),
        cover_photo_name=cover_photo.filename if cover_photo is not None else None,
        cover_photo_mime=cover_photo.content_type if cover_photo is not None else None,
        cover_photo_data=cover_data,
    )


@router.get("/{task_id}", response_model=TaskDetailRead)
def get_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "employee"))],
) -> TaskDetailRead:
    return _service(db).get_task_detail(task_id)


@router.patch("/{task_id}", response_model=TaskDetailRead)
def update_task(
    task_id: int,
    payload: TaskUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "employee"))],
) -> TaskDetailRead:
    return _service(db).update_task(current_user, task_id, payload)


@router.delete("/{task_id}", response_model=MessageResponse)
def delete_task(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
) -> MessageResponse:
    _service(db).delete_task(current_user, task_id)
    return MessageResponse(message="Task deleted")


@router.post("/{task_id}/messages", response_model=TaskMessageRead, status_code=status.HTTP_201_CREATED)
def add_task_message(
    task_id: int,
    payload: TaskMessageCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin", "employee"))],
) -> TaskMessageRead:
    return _service(db).add_message(current_user, task_id, payload.content)


@router.post("/{task_id}/media", response_model=TaskMediaRead, status_code=status.HTTP_201_CREATED)
async def add_task_media(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles("admin"))],
    file: Annotated[UploadFile, File(alias="file")],
) -> TaskMediaRead:
    payload = await file.read()
    return _service(db).add_media(
        current_user,
        task_id,
        file.filename or "attachment",
        file.content_type or "application/octet-stream",
        payload,
    )


@router.get("/{task_id}/cover")
def get_task_cover(
    task_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "employee"))],
) -> Response:
    file_name, media_type, data = _service(db).get_cover_photo(task_id)
    return Response(content=data, media_type=media_type, headers={"Content-Disposition": f'inline; filename="{file_name}"'})


@router.get("/{task_id}/media/{media_id}")
def get_task_media(
    task_id: int,
    media_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_roles("admin", "employee"))],
) -> Response:
    file_name, media_type, data = _service(db).get_task_media(task_id, media_id)
    return Response(content=data, media_type=media_type, headers={"Content-Disposition": f'inline; filename="{file_name}"'})
