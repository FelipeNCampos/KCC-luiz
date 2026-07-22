"""add contractor maintenance calendar

Revision ID: 0017_maintenance_calendar
Revises: 0016_cashflow_share_links
Create Date: 2026-07-21 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0017_maintenance_calendar"
down_revision: str | None = "0016_cashflow_share_links"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "maintenance_categories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
        sa.UniqueConstraint("condominio_id", "name", name="uq_maintenance_category_name"),
    )
    op.create_index(op.f("ix_maintenance_categories_condominio_id"), "maintenance_categories", ["condominio_id"], unique=False)
    op.create_table(
        "maintenance_schedules",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("tag", sa.String(length=160), nullable=False),
        sa.Column("report", sa.String(length=500), nullable=False),
        sa.Column("frequency_days", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("cellphone", sa.String(length=80), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
        sa.Column("category_id", sa.String(length=36), sa.ForeignKey("maintenance_categories.id"), nullable=False),
    )
    for column in ("cellphone", "condominio_id", "category_id"):
        op.create_index(op.f(f"ix_maintenance_schedules_{column}"), "maintenance_schedules", [column], unique=False)
    op.create_table(
        "maintenance_records",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("in_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
        sa.Column("maintenance_id", sa.String(length=36), sa.ForeignKey("maintenance_schedules.id"), nullable=False),
        sa.Column("contractor_visit_id", sa.String(length=36), sa.ForeignKey("contractor_visits.id"), nullable=False),
        sa.UniqueConstraint("maintenance_id", "contractor_visit_id", name="uq_maintenance_record_visit"),
    )
    for column in ("in_at", "condominio_id", "maintenance_id", "contractor_visit_id"):
        op.create_index(op.f(f"ix_maintenance_records_{column}"), "maintenance_records", [column], unique=False)


def downgrade() -> None:
    op.drop_table("maintenance_records")
    op.drop_table("maintenance_schedules")
    op.drop_table("maintenance_categories")
