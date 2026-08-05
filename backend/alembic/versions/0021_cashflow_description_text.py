"""allow long cashflow descriptions

Revision ID: 0021_cashflow_description_text
Revises: 0020_system_invoices
Create Date: 2026-08-05
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021_cashflow_description_text"
down_revision: str | None = "0020_system_invoices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "cashflow_records",
        "description",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "cashflow_records",
        "description",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )
