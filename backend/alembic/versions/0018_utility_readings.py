"""add energy and gas readings by flat

Revision ID: 0018_utility_readings
Revises: 0017_maintenance_calendar
Create Date: 2026-07-22 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0018_utility_readings"
down_revision: str | None = "0017_maintenance_calendar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "utility_readings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("reading_date", sa.Date(), nullable=False),
        sa.Column("energy", sa.Integer(), nullable=False),
        sa.Column("gas", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("building_id", sa.String(length=36), sa.ForeignKey("buildings.id"), nullable=False),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
        sa.UniqueConstraint("building_id", "reading_date", name="uq_utility_reading_building_date"),
    )
    for column in ("reading_date", "building_id", "condominio_id"):
        op.create_index(op.f(f"ix_utility_readings_{column}"), "utility_readings", [column], unique=False)


def downgrade() -> None:
    op.drop_table("utility_readings")
