from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, joinedload

from app.models.task import Task, TaskAssignment, TaskMedia, TaskMessage, TaskModuleSettings


class TaskRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_module_settings(self) -> TaskModuleSettings:
        settings = self.db.get(TaskModuleSettings, 1)
        if settings is None:
            settings = TaskModuleSettings(id=1, is_active=False)
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def save_module_settings(self, settings: TaskModuleSettings) -> TaskModuleSettings:
        self.db.add(settings)
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def list_tasks(self) -> list[Task]:
        statement: Select[tuple[Task]] = (
            select(Task)
            .options(
                joinedload(Task.assignments).joinedload(TaskAssignment.user),
            )
            .order_by(Task.updated_at.desc(), Task.id.desc())
        )
        return list(self.db.scalars(statement).unique().all())

    def get_task(self, task_id: int) -> Task | None:
        statement = (
            select(Task)
            .where(Task.id == task_id)
            .options(
                joinedload(Task.assignments).joinedload(TaskAssignment.user),
                joinedload(Task.media).joinedload(TaskMedia.uploaded_by),
                joinedload(Task.messages).joinedload(TaskMessage.sender),
            )
        )
        return self.db.scalar(statement)

    def create_task(self, task: Task) -> Task:
        self.db.add(task)
        self.db.commit()
        return self.get_task(task.id)  # type: ignore[return-value]

    def save_task(self, task: Task) -> Task:
        task.updated_at = datetime.utcnow()
        self.db.add(task)
        self.db.commit()
        return self.get_task(task.id)  # type: ignore[return-value]

    def delete_task(self, task: Task) -> None:
        self.db.delete(task)
        self.db.commit()

    def add_message(self, message: TaskMessage) -> TaskMessage:
        task = self.db.get(Task, message.task_id)
        if task is not None:
            task.updated_at = datetime.utcnow()
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def add_media(self, media: TaskMedia) -> TaskMedia:
        task = self.db.get(Task, media.task_id)
        if task is not None:
            task.updated_at = datetime.utcnow()
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media
