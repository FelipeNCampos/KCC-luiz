"""store editable system invoice drafts

Revision ID: 0020_system_invoices
Revises: 0019_partial_utility_readings
Create Date: 2026-07-30 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_system_invoices"
down_revision: str | None = "0019_partial_utility_readings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cashflow_records",
        sa.Column("system_invoice_type", sa.String(length=40), nullable=True),
    )
    op.add_column("cashflow_records", sa.Column("system_invoice_data", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cashflow_records", "system_invoice_data")
    op.drop_column("cashflow_records", "system_invoice_type")
