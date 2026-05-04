"""add instruction video upload fields

Revision ID: 0012_instr_video
Revises: 0011_flat_instr
Create Date: 2026-05-04 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0012_instr_video"
down_revision: str | None = "0011_flat_instr"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("flat_instructions", sa.Column("video_name", sa.String(length=255), nullable=True))
    op.add_column("flat_instructions", sa.Column("video_data", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("flat_instructions", "video_data")
    op.drop_column("flat_instructions", "video_name")
