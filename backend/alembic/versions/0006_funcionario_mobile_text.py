"""make funcionario mobile text

Revision ID: 0006_funcionario_mobile_bigint
Revises: 0005_oakhill_cleaner_contractor
Create Date: 2026-05-01 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0006_funcionario_mobile_text"
down_revision: str | None = "0005_oakhill_cleaner_contractor"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "funcionarios",
        "mobile",
        existing_type=sa.Integer(),
        type_=sa.String(length=80),
        existing_nullable=True,
        postgresql_using="mobile::text",
    )


def downgrade() -> None:
    op.alter_column(
        "funcionarios",
        "mobile",
        existing_type=sa.String(length=80),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using="NULLIF(regexp_replace(mobile, '\\D', '', 'g'), '')::integer",
    )
