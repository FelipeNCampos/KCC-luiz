"""add cash flow records

Revision ID: 0002_add_cashflow_records
Revises: 0001
Create Date: 2026-04-26 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0002_add_cashflow_records"
down_revision: str | None = "0001_initial_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cashflow_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("payment_number", sa.Integer(), nullable=False),
        sa.Column("has_invoice", sa.Boolean(), nullable=False),
        sa.Column("invoice_media_name", sa.String(length=255), nullable=True),
        sa.Column("invoice_media_mime", sa.String(length=120), nullable=True),
        sa.Column("invoice_media_data", sa.LargeBinary(), nullable=True),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("flat", sa.String(length=120), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cashflow_records_created_by_user_id"), "cashflow_records", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_cashflow_records_id"), "cashflow_records", ["id"], unique=False)
    op.create_index(op.f("ix_cashflow_records_payment_number"), "cashflow_records", ["payment_number"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_cashflow_records_payment_number"), table_name="cashflow_records")
    op.drop_index(op.f("ix_cashflow_records_id"), table_name="cashflow_records")
    op.drop_index(op.f("ix_cashflow_records_created_by_user_id"), table_name="cashflow_records")
    op.drop_table("cashflow_records")
