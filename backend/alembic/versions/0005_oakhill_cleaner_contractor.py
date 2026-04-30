"""add oakhill cleaner and contractor modules

Revision ID: 0005_oakhill_cleaner_contractor
Revises: 0004_cashflow_optional
Create Date: 2026-04-30 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_oakhill_cleaner_contractor"
down_revision: str | None = "0004_cashflow_optional"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("condominio_id", sa.String(length=36), nullable=True))
    op.add_column("users", sa.Column("cargo", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_users_condominio_id"), "users", ["condominio_id"], unique=False)

    op.create_table(
        "condominios",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("nome", sa.String(length=160), nullable=False),
    )
    op.create_table(
        "buildings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("nome", sa.String(length=160), nullable=False),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_buildings_condominio_id"), "buildings", ["condominio_id"], unique=False)
    op.create_table(
        "funcionarios",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("status", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("nome", sa.String(length=160), nullable=False),
        sa.Column("mobile", sa.Integer(), nullable=True),
        sa.Column("cargo", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_funcionarios_condominio_id"), "funcionarios", ["condominio_id"], unique=False)
    op.create_table(
        "acess",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("status", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("data", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("operacao", sa.Integer(), nullable=False),
        sa.Column("building_id", sa.String(length=36), sa.ForeignKey("buildings.id"), nullable=False),
        sa.Column("funcionario_id", sa.String(length=36), sa.ForeignKey("funcionarios.id"), nullable=False),
    )
    op.create_index(op.f("ix_acess_data"), "acess", ["data"], unique=False)
    op.create_index(op.f("ix_acess_building_id"), "acess", ["building_id"], unique=False)
    op.create_index(op.f("ix_acess_funcionario_id"), "acess", ["funcionario_id"], unique=False)

    op.create_table(
        "contractor_visits",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("company", sa.String(length=160), nullable=False),
        sa.Column("car_reg", sa.String(length=80), nullable=False, server_default=""),
        sa.Column("block", sa.String(length=160), nullable=False),
        sa.Column("job_description", sa.String(length=500), nullable=False),
        sa.Column("mobile", sa.String(length=80), nullable=False),
        sa.Column("extra_media_name", sa.String(length=255), nullable=True),
        sa.Column("extra_media_data", sa.Text(), nullable=True),
        sa.Column("extra_media_2_name", sa.String(length=255), nullable=True),
        sa.Column("extra_media_2_data", sa.Text(), nullable=True),
        sa.Column("extra_media_3_name", sa.String(length=255), nullable=True),
        sa.Column("extra_media_3_data", sa.Text(), nullable=True),
        sa.Column("extra_media_4_name", sa.String(length=255), nullable=True),
        sa.Column("extra_media_4_data", sa.Text(), nullable=True),
        sa.Column("in_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_contractor_visits_condominio_id"), "contractor_visits", ["condominio_id"], unique=False)
    op.create_index(op.f("ix_contractor_visits_in_at"), "contractor_visits", ["in_at"], unique=False)
    op.create_index(op.f("ix_contractor_visits_out_at"), "contractor_visits", ["out_at"], unique=False)
    op.create_table(
        "contractor_history_categories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
    )
    op.create_index(op.f("ix_contractor_history_categories_condominio_id"), "contractor_history_categories", ["condominio_id"], unique=False)
    op.create_table(
        "contractor_histories",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("created_new_visit", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("next_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("next_interval_unit", sa.String(length=16), nullable=True),
        sa.Column("next_interval_value", sa.Integer(), nullable=True),
        sa.Column("next_job_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_notify_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_notification_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("condominio_id", sa.String(length=36), sa.ForeignKey("condominios.id"), nullable=False),
        sa.Column("contractor_visit_id", sa.String(length=36), sa.ForeignKey("contractor_visits.id"), nullable=False),
        sa.Column("category_id", sa.String(length=36), sa.ForeignKey("contractor_history_categories.id"), nullable=False),
    )
    op.create_index(op.f("ix_contractor_histories_condominio_id"), "contractor_histories", ["condominio_id"], unique=False)
    op.create_index(op.f("ix_contractor_histories_contractor_visit_id"), "contractor_histories", ["contractor_visit_id"], unique=False)
    op.create_index(op.f("ix_contractor_histories_category_id"), "contractor_histories", ["category_id"], unique=False)


def downgrade() -> None:
    op.drop_table("contractor_histories")
    op.drop_table("contractor_history_categories")
    op.drop_table("contractor_visits")
    op.drop_table("acess")
    op.drop_table("funcionarios")
    op.drop_table("buildings")
    op.drop_table("condominios")
    op.drop_index(op.f("ix_users_condominio_id"), table_name="users")
    op.drop_column("users", "cargo")
    op.drop_column("users", "condominio_id")
