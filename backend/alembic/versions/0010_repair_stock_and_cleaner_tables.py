"""repair stock and cleaner checklist tables

Revision ID: 0010_repair_tables
Revises: 0009_stock_requests
Create Date: 2026-05-04 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "0010_repair_tables"
down_revision: str | None = "0009_stock_requests"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS cleaner_checkout_checklist_items (
            id VARCHAR(36) PRIMARY KEY,
            label VARCHAR(255) NOT NULL,
            checked BOOLEAN NOT NULL DEFAULT true,
            position INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            access_id VARCHAR(36) NOT NULL REFERENCES acess(id),
            checklist_item_id VARCHAR(36) NULL REFERENCES flat_checklist_items(id),
            building_id VARCHAR(36) NOT NULL REFERENCES buildings(id),
            condominio_id VARCHAR(36) NOT NULL REFERENCES condominios(id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_cleaner_checkout_checklist_items_access_id ON cleaner_checkout_checklist_items (access_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cleaner_checkout_checklist_items_building_id ON cleaner_checkout_checklist_items (building_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cleaner_checkout_checklist_items_checklist_item_id ON cleaner_checkout_checklist_items (checklist_item_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cleaner_checkout_checklist_items_condominio_id ON cleaner_checkout_checklist_items (condominio_id)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stock_requests (
            id VARCHAR(36) PRIMARY KEY,
            product_name VARCHAR(255) NOT NULL,
            quantity INTEGER NOT NULL,
            photo_name VARCHAR(255) NULL,
            photo_data TEXT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            condominio_id VARCHAR(36) NOT NULL REFERENCES condominios(id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_stock_requests_condominio_id ON stock_requests (condominio_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_stock_requests_created_at ON stock_requests (created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_stock_requests_status ON stock_requests (status)")


def downgrade() -> None:
    pass
