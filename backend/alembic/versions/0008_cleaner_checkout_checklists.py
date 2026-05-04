"""add cleaner checkout checklist snapshots

Revision ID: 0008_cleaner_checkout_checklists
Revises: 0007_flat_checklists
Create Date: 2026-05-04 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0008_cleaner_checkout_checklists"
down_revision: str | None = "0007_flat_checklists"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cleaner_checkout_checklist_items",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("checked", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("access_id", sa.String(length=36), sa.ForeignKey("acess.id"), nullable=False),
        sa.Column("checklist_item_id", sa.String(length=36), sa.ForeignKey("flat_checklist_items.id"), nullable=True),
        sa.Column("building_id", sa.String(length=36), sa.ForeignKey("buildings.id"), nullable=False),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_cleaner_checkout_checklist_items_access_id"), "cleaner_checkout_checklist_items", ["access_id"], unique=False)
    op.create_index(op.f("ix_cleaner_checkout_checklist_items_building_id"), "cleaner_checkout_checklist_items", ["building_id"], unique=False)
    op.create_index(op.f("ix_cleaner_checkout_checklist_items_checklist_item_id"), "cleaner_checkout_checklist_items", ["checklist_item_id"], unique=False)
    op.create_index(op.f("ix_cleaner_checkout_checklist_items_condominio_id"), "cleaner_checkout_checklist_items", ["condominio_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cleaner_checkout_checklist_items_condominio_id"), table_name="cleaner_checkout_checklist_items")
    op.drop_index(op.f("ix_cleaner_checkout_checklist_items_checklist_item_id"), table_name="cleaner_checkout_checklist_items")
    op.drop_index(op.f("ix_cleaner_checkout_checklist_items_building_id"), table_name="cleaner_checkout_checklist_items")
    op.drop_index(op.f("ix_cleaner_checkout_checklist_items_access_id"), table_name="cleaner_checkout_checklist_items")
    op.drop_table("cleaner_checkout_checklist_items")
