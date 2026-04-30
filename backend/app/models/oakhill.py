from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text, func
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


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    condominio_id: Mapped[str] = mapped_column(String(36), ForeignKey("condominios.id"), nullable=False, index=True)

    condominio: Mapped["Condominio"] = relationship("Condominio", back_populates="buildings")
    acessos: Mapped[list["Acess"]] = relationship("Acess", back_populates="building")


class Funcionario(Base):
    __tablename__ = "funcionarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid_pk)
    status: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nome: Mapped[str] = mapped_column(String(160), nullable=False)
    mobile: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
