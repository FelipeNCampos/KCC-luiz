"""add notes to cashflow

Revision ID: 0022_cashflow_notes
Revises: 0021_cashflow_description_text
Create Date: 2026-08-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0022_cashflow_notes"
down_revision: str | None = "0021_cashflow_description_text"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("cashflow_records", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("cashflow_records", "notes")
