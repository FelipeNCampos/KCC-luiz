"""add flat checklists

Revision ID: 0007_flat_checklists
Revises: 0006_funcionario_mobile_text
Create Date: 2026-05-01 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0007_flat_checklists"
down_revision: str | None = "0006_funcionario_mobile_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "flat_checklist_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("building_id", sa.String(length=36), sa.ForeignKey("buildings.id"), nullable=False),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
        sa.UniqueConstraint("building_id", "position", name="uq_flat_checklist_items_building_position"),
    )
    op.create_index(op.f("ix_flat_checklist_items_building_id"), "flat_checklist_items", ["building_id"], unique=False)
    op.create_index(op.f("ix_flat_checklist_items_condominio_id"), "flat_checklist_items", ["condominio_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_flat_checklist_items_condominio_id"), table_name="flat_checklist_items")
    op.drop_index(op.f("ix_flat_checklist_items_building_id"), table_name="flat_checklist_items")
    op.drop_table("flat_checklist_items")
