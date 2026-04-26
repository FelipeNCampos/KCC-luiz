from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class TaskModuleSettings(Base):
    __tablename__ = "task_module_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    is_active: Mapped[bool] = mapped_column(default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="todo", nullable=False, index=True)
    cover_photo_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cover_photo_mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    cover_photo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    created_by: Mapped["User"] = relationship("User", back_populates="created_tasks")
    assignments: Mapped[list["TaskAssignment"]] = relationship(
        "TaskAssignment",
        back_populates="task",
        cascade="all, delete-orphan",
    )
    messages: Mapped[list["TaskMessage"]] = relationship(
        "TaskMessage",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskMessage.created_at.asc()",
    )
    media: Mapped[list["TaskMedia"]] = relationship(
        "TaskMedia",
        back_populates="task",
        cascade="all, delete-orphan",
        order_by="TaskMedia.created_at.asc()",
    )


class TaskAssignment(Base):
    __tablename__ = "task_assignments"
    __table_args__ = (UniqueConstraint("task_id", "user_id", name="uq_task_assignment_task_user"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    task: Mapped["Task"] = relationship("Task", back_populates="assignments")
    user: Mapped["User"] = relationship("User", back_populates="task_assignments")


class TaskMessage(Base):
    __tablename__ = "task_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    task: Mapped["Task"] = relationship("Task", back_populates="messages")
    sender: Mapped["User"] = relationship("User", back_populates="task_messages")


class TaskMedia(Base):
    __tablename__ = "task_media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    uploaded_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_mime: Mapped[str] = mapped_column(String(120), nullable=False)
    file_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    task: Mapped["Task"] = relationship("Task", back_populates="media")
    uploaded_by: Mapped["User"] = relationship("User", back_populates="task_media_uploads")
