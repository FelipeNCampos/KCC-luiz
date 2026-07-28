"""allow separate energy and gas reading submissions

Revision ID: 0019_partial_utility_readings
Revises: 0018_utility_readings
Create Date: 2026-07-28 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "0019_partial_utility_readings"
down_revision: str | None = "0018_utility_readings"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("utility_readings", "energy", existing_type=sa.Integer(), nullable=True)
    op.alter_column("utility_readings", "gas", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column("utility_readings", "gas", existing_type=sa.Integer(), nullable=False)
    op.alter_column("utility_readings", "energy", existing_type=sa.Integer(), nullable=False)
