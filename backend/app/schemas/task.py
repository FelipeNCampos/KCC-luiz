from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserRead


class TaskModuleSettingsRead(BaseModel):
    is_active: bool


class TaskModuleSettingsUpdate(BaseModel):
    is_active: bool


class TaskAssigneeRead(BaseModel):
    id: int
    name: str
    email: str
    job_title: str | None = None
    is_active: bool


class TaskMessageRead(BaseModel):
    id: int
    sender: TaskAssigneeRead
    content: str
    created_at: datetime


class TaskMediaRead(BaseModel):
    id: int
    file_name: str
    file_mime: str
    created_at: datetime
    uploaded_by: TaskAssigneeRead


class TaskCardRead(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    has_cover_photo: bool
    assignees: list[TaskAssigneeRead]


class TaskDetailRead(TaskCardRead):
    media: list[TaskMediaRead]
    messages: list[TaskMessageRead]


class TaskListResponse(BaseModel):
    items: list[TaskCardRead]


class TaskUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=1000)
    status: str | None = None
    assigned_user_ids: list[int] | None = None


class TaskMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
