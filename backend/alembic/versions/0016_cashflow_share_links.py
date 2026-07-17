"""add cashflow share links

Revision ID: 0016_cashflow_share_links
Revises: 0015_cashflow_invoice_number
Create Date: 2026-07-16 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0016_cashflow_share_links"
down_revision: str | None = "0015_cashflow_invoice_number"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cashflow_share_links",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("condominio_id", sa.String(length=36), nullable=False),
        sa.Column("cashflow_scope", sa.String(length=40), nullable=False),
        sa.Column("date_from", sa.Date(), nullable=False),
        sa.Column("date_to", sa.Date(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token_encrypted", sa.Text(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index("ix_cashflow_share_links_condominio_id", "cashflow_share_links", ["condominio_id"])
    op.create_index("ix_cashflow_share_links_expires_at", "cashflow_share_links", ["expires_at"])
    op.create_index("ix_cashflow_share_links_token_hash", "cashflow_share_links", ["token_hash"])


def downgrade() -> None:
    op.drop_index("ix_cashflow_share_links_token_hash", table_name="cashflow_share_links")
    op.drop_index("ix_cashflow_share_links_expires_at", table_name="cashflow_share_links")
    op.drop_index("ix_cashflow_share_links_condominio_id", table_name="cashflow_share_links")
    op.drop_table("cashflow_share_links")
