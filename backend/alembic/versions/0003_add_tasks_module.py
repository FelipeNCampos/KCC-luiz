"""add tasks module

Revision ID: 0003_add_tasks_module
Revises: 0002_add_cashflow_records
Create Date: 2026-04-26 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0003_add_tasks_module"
down_revision: str | None = "0002_add_cashflow_records"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("job_title", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("profile_photo_name", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("profile_photo_mime", sa.String(length=120), nullable=True))
    op.add_column("users", sa.Column("profile_photo_data", sa.LargeBinary(), nullable=True))

    op.create_table(
        "task_module_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("cover_photo_name", sa.String(length=255), nullable=True),
        sa.Column("cover_photo_mime", sa.String(length=120), nullable=True),
        sa.Column("cover_photo_data", sa.LargeBinary(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tasks_id"), "tasks", ["id"], unique=False)
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"], unique=False)
    op.create_index(op.f("ix_tasks_created_by_user_id"), "tasks", ["created_by_user_id"], unique=False)

    op.create_table(
        "task_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "user_id", name="uq_task_assignment_task_user"),
    )
    op.create_index(op.f("ix_task_assignments_task_id"), "task_assignments", ["task_id"], unique=False)
    op.create_index(op.f("ix_task_assignments_user_id"), "task_assignments", ["user_id"], unique=False)

    op.create_table(
        "task_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_messages_task_id"), "task_messages", ["task_id"], unique=False)
    op.create_index(op.f("ix_task_messages_sender_id"), "task_messages", ["sender_id"], unique=False)

    op.create_table(
        "task_media",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_mime", sa.String(length=120), nullable=False),
        sa.Column("file_data", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_media_task_id"), "task_media", ["task_id"], unique=False)
    op.create_index(op.f("ix_task_media_uploaded_by_user_id"), "task_media", ["uploaded_by_user_id"], unique=False)

    op.execute("INSERT INTO task_module_settings (id, is_active) VALUES (1, false)")


def downgrade() -> None:
    op.drop_index(op.f("ix_task_media_uploaded_by_user_id"), table_name="task_media")
    op.drop_index(op.f("ix_task_media_task_id"), table_name="task_media")
    op.drop_table("task_media")

    op.drop_index(op.f("ix_task_messages_sender_id"), table_name="task_messages")
    op.drop_index(op.f("ix_task_messages_task_id"), table_name="task_messages")
    op.drop_table("task_messages")

    op.drop_index(op.f("ix_task_assignments_user_id"), table_name="task_assignments")
    op.drop_index(op.f("ix_task_assignments_task_id"), table_name="task_assignments")
    op.drop_table("task_assignments")

    op.drop_index(op.f("ix_tasks_created_by_user_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_id"), table_name="tasks")
    op.drop_table("tasks")

    op.drop_table("task_module_settings")

    op.drop_column("users", "profile_photo_data")
    op.drop_column("users", "profile_photo_mime")
    op.drop_column("users", "profile_photo_name")
    op.drop_column("users", "job_title")
