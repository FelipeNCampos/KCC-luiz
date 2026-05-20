"""add supplier to cashflow

Revision ID: 0014_cashflow_supplier
Revises: 0013_cashflow_scope
Create Date: 2026-05-18 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0014_cashflow_supplier"
down_revision: str | None = "0013_cashflow_scope"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cashflow_records",
        sa.Column("supplier", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cashflow_records", "supplier")
