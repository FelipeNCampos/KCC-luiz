from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def uuid_pk() -> str:
    return str(uuid4())


class Condominio(Base):
    __tablename__ = "condominios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)

    buildings: Mapped[list["Building"]] = relationship("Building", back_populates="condominio")
    funcionarios: Mapped[list["Funcionario"]] = relationship("Funcionario", back_populates="condominio")
    contractor_visits: Mapped[list["ContractorVisit"]] = relationship("ContractorVisit", back_populates="condominio")
    stock_requests: Mapped[list["StockRequest"]] = relationship("StockRequest", back_populates="condominio")


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    condominio: Mapped["Condominio"] = relationship("Condominio", back_populates="buildings")
    acessos: Mapped[list["Acess"]] = relationship("Acess", back_populates="building")


class UtilityReading(Base):
    __tablename__ = "utility_readings"
    __table_args__ = (UniqueConstraint("building_id", "reading_date", name="uq_utility_reading_building_date"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    reading_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    energy: Mapped[int] = mapped_column(Integer, nullable=False)
    gas: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    building_id: Mapped[str] = mapped_column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)


class Funcionario(Base):
    __tablename__ = "funcionarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    status: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    mobile: Mapped[str | None] = mapped_column(String(80), nullable=True)
    cargo: Mapped[int] = mapped_column(Integer, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    condominio: Mapped["Condominio"] = relationship("Condominio", back_populates="funcionarios")
    acessos: Mapped[list["Acess"]] = relationship("Acess", back_populates="funcionario")


class Acess(Base):
    __tablename__ = "acess"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    status: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    data: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    operacao: Mapped[int] = mapped_column(Integer, nullable=False)
    building_id: Mapped[str] = mapped_column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    funcionario_id: Mapped[str] = mapped_column(String(36), ForeignKey("funcionarios.id"), nullable=False, index=True)

    building: Mapped["Building"] = relationship("Building", back_populates="acessos")
    funcionario: Mapped["Funcionario"] = relationship("Funcionario", back_populates="acessos")
    checkout_checklist_items: Mapped[list["CleanerCheckoutChecklistItem"]] = relationship(
        "CleanerCheckoutChecklistItem",
        back_populates="access",
        cascade="all, delete-orphan",
    )


class ContractorVisit(Base):
    __tablename__ = "contractor_visits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    company: Mapped[str] = mapped_column(String(160), nullable=False)
    car_reg: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    block: Mapped[str] = mapped_column(String(160), nullable=False)
    job_description: Mapped[str] = mapped_column(String(500), nullable=False)
    mobile: Mapped[str] = mapped_column(String(80), nullable=False)
    extra_media_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_media_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_media_2_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_media_2_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_media_3_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_media_3_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_media_4_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extra_media_4_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    condominio: Mapped["Condominio"] = relationship("Condominio", back_populates="contractor_visits")
    histories: Mapped[list["ContractorHistory"]] = relationship("ContractorHistory", back_populates="visit")
    maintenance_records: Mapped[list["MaintenanceRecord"]] = relationship(
        "MaintenanceRecord", back_populates="contractor_visit"
    )


class MaintenanceCategory(Base):
    __tablename__ = "maintenance_categories"
    __table_args__ = (UniqueConstraint("condominio_id", "name", name="uq_maintenance_category_name"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    schedules: Mapped[list["MaintenanceSchedule"]] = relationship("MaintenanceSchedule", back_populates="category")


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    tag: Mapped[str] = mapped_column(String(160), nullable=False)
    report: Mapped[str] = mapped_column(String(500), nullable=False)
    frequency_days: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False)
    cellphone: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("maintenance_categories.id"), nullable=False, index=True)

    category: Mapped["MaintenanceCategory"] = relationship("MaintenanceCategory", back_populates="schedules")
    records: Mapped[list["MaintenanceRecord"]] = relationship("MaintenanceRecord", back_populates="maintenance", cascade="all, delete-orphan")


class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    __table_args__ = (UniqueConstraint("maintenance_id", "contractor_visit_id", name="uq_maintenance_record_visit"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)
    maintenance_id: Mapped[str] = mapped_column(String(36), ForeignKey("maintenance_schedules.id"), nullable=False, index=True)
    contractor_visit_id: Mapped[str] = mapped_column(String(36), ForeignKey("contractor_visits.id"), nullable=False, index=True)

    maintenance: Mapped["MaintenanceSchedule"] = relationship("MaintenanceSchedule", back_populates="records")
    contractor_visit: Mapped["ContractorVisit"] = relationship("ContractorVisit", back_populates="maintenance_records")


class ContractorHistoryCategory(Base):
    __tablename__ = "contractor_history_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)


class ContractorHistory(Base):
    __tablename__ = "contractor_histories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    created_new_visit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    next_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    next_interval_unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    next_interval_value: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_job_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_notify_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_notification_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)
    contractor_visit_id: Mapped[str] = mapped_column(String(36), ForeignKey("contractor_visits.id"), nullable=False, index=True)
    category_id: Mapped[str] = mapped_column(String(36), ForeignKey("contractor_history_categories.id"), nullable=False, index=True)

    visit: Mapped["ContractorVisit"] = relationship("ContractorVisit", back_populates="histories")
    category: Mapped["ContractorHistoryCategory"] = relationship("ContractorHistoryCategory")


class FlatChecklistItem(Base):
    __tablename__ = "flat_checklist_items"
    __table_args__ = (UniqueConstraint("building_id", "position", name="uq_flat_checklist_items_building_position"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    building_id: Mapped[str] = mapped_column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)


class FlatInstruction(Base):
    __tablename__ = "flat_instructions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    video_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    video_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    building_id: Mapped[str] = mapped_column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)


class CleanerCheckoutChecklistItem(Base):
    __tablename__ = "cleaner_checkout_checklist_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    checked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    access_id: Mapped[str] = mapped_column(String(36), ForeignKey("acess.id"), nullable=False, index=True)
    checklist_item_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("flat_checklist_items.id"), nullable=True, index=True)
    building_id: Mapped[str] = mapped_column(String(36), ForeignKey("buildings.id"), nullable=False, index=True)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    access: Mapped["Acess"] = relationship("Acess", back_populates="checkout_checklist_items")


class StockRequest(Base):
    __tablename__ = "stock_requests"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    photo_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    photo_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    condominio: Mapped["Condominio"] = relationship("Condominio", back_populates="stock_requests")
