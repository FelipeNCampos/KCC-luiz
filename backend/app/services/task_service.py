import json
from datetime import datetime

from fastapi import HTTPException, status

from app.models.task import Task, TaskAssignment, TaskMedia, TaskMessage
from app.models.user import User
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.schemas.task import (
    TaskAssigneeRead,
    TaskCardRead,
    TaskDetailRead,
    TaskListResponse,
    TaskMediaRead,
    TaskMessageRead,
    TaskModuleSettingsRead,
    TaskUpdateRequest,
)

TASK_STATUSES = {"todo", "in_progress", "done"}
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_MEDIA_PREFIXES = ("image/", "video/")
ALLOWED_MEDIA_EXACT = {"application/pdf"}
MAX_COVER_BYTES = 5 * 1024 * 1024
MAX_MEDIA_BYTES = 20 * 1024 * 1024
MAX_MEDIA_FILES = 10


class TaskService:
    def __init__(self, task_repository: TaskRepository, user_repository: UserRepository) -> None:
        self.task_repository = task_repository
        self.user_repository = user_repository

    def get_module_settings(self) -> TaskModuleSettingsRead:
        settings = self.task_repository.get_module_settings()
        return TaskModuleSettingsRead(is_active=settings.is_active)

    def update_module_settings(self, is_active: bool) -> TaskModuleSettingsRead:
        settings = self.task_repository.get_module_settings()
        settings.is_active = is_active
        saved = self.task_repository.save_module_settings(settings)
        return TaskModuleSettingsRead(is_active=saved.is_active)

    def ensure_module_active(self) -> None:
        if not self.task_repository.get_module_settings().is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Task module is disabled")

    def list_tasks(
        self,
        user: User,
        search: str | None,
        status_filter: str | None,
        created_from: datetime | None,
        created_to: datetime | None,
        modified_from: datetime | None,
        modified_to: datetime | None,
        sort: str | None,
    ) -> TaskListResponse:
        self.ensure_module_active()
        tasks = self.task_repository.list_tasks()
        items = [self._to_task_card(task) for task in tasks]

        search_query = (search or "").strip().lower()
        if search_query:
            items = [item for item in items if search_query in item.name.lower() or search_query in item.code.lower()]

        if status_filter and status_filter != "all":
            if status_filter not in TASK_STATUSES:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid task status")
            items = [item for item in items if item.status == status_filter]

        if created_from:
            items = [item for item in items if item.created_at >= created_from]
        if created_to:
            items = [item for item in items if item.created_at <= created_to]
        if modified_from:
            items = [item for item in items if item.updated_at >= modified_from]
        if modified_to:
            items = [item for item in items if item.updated_at <= modified_to]

        sort_value = sort or "created_desc"
        if sort_value == "created_desc":
            items.sort(key=lambda item: item.created_at, reverse=True)
        elif sort_value == "created_asc":
            items.sort(key=lambda item: item.created_at)
        elif sort_value == "name_asc":
            items.sort(key=lambda item: item.name.lower())
        elif sort_value == "name_desc":
            items.sort(key=lambda item: item.name.lower(), reverse=True)
        else:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid sort option")

        return TaskListResponse(items=items)

    def get_task_detail(self, task_id: int) -> TaskDetailRead:
        self.ensure_module_active()
        task = self._require_task(task_id)
        return self._to_task_detail(task)

    def create_task(
        self,
        user: User,
        name: str,
        description: str | None,
        status_value: str,
        assigned_user_ids: list[int],
        cover_photo_name: str | None,
        cover_photo_mime: str | None,
        cover_photo_data: bytes | None,
    ) -> TaskDetailRead:
        self.ensure_module_active()
        self._ensure_admin(user)
        cleaned_status = self._validate_status(status_value)
        cleaned_name = self._validate_name(name)
        cleaned_description = self._validate_description(description)
        self._validate_cover(cover_photo_mime, cover_photo_data)

        task = Task(
            name=cleaned_name,
            description=cleaned_description,
            status=cleaned_status,
            cover_photo_name=cover_photo_name,
            cover_photo_mime=cover_photo_mime,
            cover_photo_data=cover_photo_data,
            created_by_user_id=user.id,
        )
        task.assignments = [TaskAssignment(user_id=employee.id) for employee in self._load_assignees(assigned_user_ids)]
        created = self.task_repository.create_task(task)
        return self._to_task_detail(created)

    def update_task(self, user: User, task_id: int, payload: TaskUpdateRequest) -> TaskDetailRead:
        self.ensure_module_active()
        task = self._require_task(task_id)

        if payload.name is not None or payload.description is not None or payload.assigned_user_ids is not None:
            self._ensure_admin(user)

        if payload.name is not None:
            task.name = self._validate_name(payload.name)
        if payload.description is not None:
            task.description = self._validate_description(payload.description)
        if payload.status is not None:
            task.status = self._validate_status(payload.status)
        if payload.assigned_user_ids is not None:
            task.assignments = [TaskAssignment(user_id=employee.id) for employee in self._load_assignees(payload.assigned_user_ids)]

        updated = self.task_repository.save_task(task)
        return self._to_task_detail(updated)

    def delete_task(self, user: User, task_id: int) -> None:
        self.ensure_module_active()
        self._ensure_admin(user)
        task = self._require_task(task_id)
        self.task_repository.delete_task(task)

    def add_message(self, user: User, task_id: int, content: str) -> TaskMessageRead:
        self.ensure_module_active()
        task = self._require_task(task_id)
        if user.role != "admin" and user.id not in {assignment.user_id for assignment in task.assignments}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this task")
        message = TaskMessage(task_id=task.id, sender_id=user.id, content=content.strip())
        created = self.task_repository.add_message(message)
        detail = self._require_task(task_id)
        task_message = next(item for item in detail.messages if item.id == created.id)
        return self._to_task_message(task_message)

    def add_media(
        self,
        user: User,
        task_id: int,
        file_name: str,
        file_mime: str,
        file_data: bytes,
    ) -> TaskMediaRead:
        self.ensure_module_active()
        task = self._require_task(task_id)
        self._ensure_admin(user)
        if len(task.media) >= MAX_MEDIA_FILES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Maximum of 10 files per task")
        if len(file_data) > MAX_MEDIA_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Task media is too large")
        if not file_mime.startswith(ALLOWED_MEDIA_PREFIXES) and file_mime not in ALLOWED_MEDIA_EXACT:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported media type")

        media = TaskMedia(
            task_id=task.id,
            uploaded_by_user_id=user.id,
            file_name=file_name,
            file_mime=file_mime,
            file_data=file_data,
        )
        created = self.task_repository.add_media(media)
        detail = self._require_task(task_id)
        task_media = next(item for item in detail.media if item.id == created.id)
        return self._to_task_media(task_media)

    def get_task_media(self, task_id: int, media_id: int) -> tuple[str, str, bytes]:
        self.ensure_module_active()
        task = self._require_task(task_id)
        media = next((item for item in task.media if item.id == media_id), None)
        if media is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task media not found")
        return media.file_name, media.file_mime, media.file_data

    def get_cover_photo(self, task_id: int) -> tuple[str, str, bytes]:
        self.ensure_module_active()
        task = self._require_task(task_id)
        if not task.cover_photo_data or not task.cover_photo_mime:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task cover photo not found")
        return task.cover_photo_name or "cover", task.cover_photo_mime, task.cover_photo_data

    @staticmethod
    def parse_assigned_user_ids(raw_value: str | None) -> list[int]:
        if raw_value is None or not raw_value.strip():
            return []
        try:
            parsed = json.loads(raw_value)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid assignee payload") from exc
        if not isinstance(parsed, list):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid assignee payload")
        return [int(item) for item in parsed]

    def _require_task(self, task_id: int) -> Task:
        task = self.task_repository.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task

    def _load_assignees(self, user_ids: list[int]) -> list[User]:
        employees: list[User] = []
        seen: set[int] = set()
        for user_id in user_ids:
            if user_id in seen:
                continue
            seen.add(user_id)
            employee = self.user_repository.get_by_id(user_id)
            if employee is None or employee.role != "employee":
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid employee assignment")
            employees.append(employee)
        return employees

    @staticmethod
    def _ensure_admin(user: User) -> None:
        if user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")

    @staticmethod
    def _validate_status(status_value: str) -> str:
        if status_value not in TASK_STATUSES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid task status")
        return status_value

    @staticmethod
    def _validate_name(name: str) -> str:
        cleaned = name.strip()
        if not cleaned:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Task name is required")
        if len(cleaned) > 80:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Task name is too long")
        return cleaned

    @staticmethod
    def _validate_description(description: str | None) -> str | None:
        cleaned = description.strip() if description else None
        if cleaned and len(cleaned) > 1000:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Task description is too long")
        return cleaned

    @staticmethod
    def _validate_cover(content_type: str | None, payload: bytes | None) -> None:
        if payload is None:
            return
        if len(payload) > MAX_COVER_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Cover photo is too large")
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Cover photo must be JPG, PNG or WebP")

    @staticmethod
    def _to_assignee(user: User) -> TaskAssigneeRead:
        return TaskAssigneeRead(
            id=user.id,
            name=user.name,
            email=user.email,
            job_title=user.job_title,
            is_active=user.is_active,
        )

    def _to_task_card(self, task: Task) -> TaskCardRead:
        return TaskCardRead(
            id=task.id,
            code=f"task-{task.id:02d}",
            name=task.name,
            description=task.description,
            status=task.status,
            created_at=task.created_at,
            updated_at=task.updated_at,
            has_cover_photo=bool(task.cover_photo_data),
            assignees=[self._to_assignee(assignment.user) for assignment in task.assignments],
        )

    def _to_task_message(self, message: TaskMessage) -> TaskMessageRead:
        return TaskMessageRead(
            id=message.id,
            sender=self._to_assignee(message.sender),
            content=message.content,
            created_at=message.created_at,
        )

    def _to_task_media(self, media: TaskMedia) -> TaskMediaRead:
        return TaskMediaRead(
            id=media.id,
            file_name=media.file_name,
            file_mime=media.file_mime,
            created_at=media.created_at,
            uploaded_by=self._to_assignee(media.uploaded_by),
        )

    def _to_task_detail(self, task: Task) -> TaskDetailRead:
        card = self._to_task_card(task)
        return TaskDetailRead(
            **card.model_dump(),
            media=[self._to_task_media(item) for item in task.media],
            messages=[self._to_task_message(item) for item in task.messages],
        )
