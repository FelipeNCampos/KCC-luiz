"""add invoice number to cashflow

Revision ID: 0015_cashflow_invoice_number
Revises: 0014_cashflow_supplier
Create Date: 2026-05-23 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0015_cashflow_invoice_number"
down_revision: str | None = "0014_cashflow_supplier"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cashflow_records",
        sa.Column("invoice_number", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cashflow_records", "invoice_number")
