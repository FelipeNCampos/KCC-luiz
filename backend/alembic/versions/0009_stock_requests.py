"""add stock requests

Revision ID: 0009_stock_requests
Revises: 0008_cleaner_checkout_checklists
Create Date: 2026-05-04 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_stock_requests"
down_revision: str | None = "0008_cleaner_checkout_checklists"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stock_requests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("photo_name", sa.String(length=255), nullable=True),
        sa.Column("photo_data", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_stock_requests_condominio_id"), "stock_requests", ["condominio_id"], unique=False)
    op.create_index(op.f("ix_stock_requests_created_at"), "stock_requests", ["created_at"], unique=False)
    op.create_index(op.f("ix_stock_requests_status"), "stock_requests", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_stock_requests_status"), table_name="stock_requests")
    op.drop_index(op.f("ix_stock_requests_created_at"), table_name="stock_requests")
    op.drop_index(op.f("ix_stock_requests_condominio_id"), table_name="stock_requests")
    op.drop_table("stock_requests")
