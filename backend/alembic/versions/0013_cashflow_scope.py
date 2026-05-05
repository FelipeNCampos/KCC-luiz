"""add cashflow scope

Revision ID: 0013_cashflow_scope
Revises: 0012_instr_video
Create Date: 2026-05-05 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0013_cashflow_scope"
down_revision: str | None = "0012_instr_video"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cashflow_records",
        sa.Column(
            "cashflow_scope",
            sa.String(length=40),
            server_default="main",
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_cashflow_records_cashflow_scope"),
        "cashflow_records",
        ["cashflow_scope"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_cashflow_records_cashflow_scope"), table_name="cashflow_records")
    op.drop_column("cashflow_records", "cashflow_scope")
