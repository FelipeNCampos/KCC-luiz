"""make cashflow flat and description optional

Revision ID: 0004_cashflow_optional
Revises: 0003_add_tasks_module
Create Date: 2026-04-30 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004_cashflow_optional"
down_revision: str | None = "0003_add_tasks_module"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("cashflow_records", "description", existing_type=sa.String(length=255), nullable=True)
    op.alter_column("cashflow_records", "flat", existing_type=sa.String(length=120), nullable=True)


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE cashflow_records SET description = '' WHERE description IS NULL"
        )
    )
    op.execute(
        sa.text(
            "UPDATE cashflow_records SET flat = '' WHERE flat IS NULL"
        )
    )
    op.alter_column("cashflow_records", "description", existing_type=sa.String(length=255), nullable=False)
    op.alter_column("cashflow_records", "flat", existing_type=sa.String(length=120), nullable=False)
