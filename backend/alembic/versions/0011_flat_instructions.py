"""add flat instructions

Revision ID: 0011_flat_instr
Revises: 0010_repair_tables
Create Date: 2026-05-04 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0011_flat_instr"
down_revision: str | None = "0010_repair_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "flat_instructions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("video_url", sa.String(length=1000), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("building_id", sa.String(length=36), sa.ForeignKey("buildings.id"), nullable=False),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_flat_instructions_building_id"), "flat_instructions", ["building_id"], unique=False)
    op.create_index(op.f("ix_flat_instructions_condominio_id"), "flat_instructions", ["condominio_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_flat_instructions_condominio_id"), table_name="flat_instructions")
    op.drop_index(op.f("ix_flat_instructions_building_id"), table_name="flat_instructions")
    op.drop_table("flat_instructions")
