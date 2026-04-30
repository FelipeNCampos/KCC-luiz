from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.cashflow import CashFlowRecord
    from app.models.task import Task, TaskAssignment, TaskMedia, TaskMessage


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="user", nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(120), nullable=True)
    profile_photo_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_photo_mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    profile_photo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    condominio_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    cargo: Mapped[int | None] = mapped_column(Integer, nullable=True)
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

    cashflow_records: Mapped[list["CashFlowRecord"]] = relationship(
        "CashFlowRecord",
        back_populates="created_by",
    )
    created_tasks: Mapped[list["Task"]] = relationship("Task", back_populates="created_by")
    task_messages: Mapped[list["TaskMessage"]] = relationship("TaskMessage", back_populates="sender")
    task_media_uploads: Mapped[list["TaskMedia"]] = relationship("TaskMedia", back_populates="uploaded_by")
    task_assignments: Mapped[list["TaskAssignment"]] = relationship("TaskAssignment", back_populates="user")
