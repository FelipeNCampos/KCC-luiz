from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class PaginatedResponse(BaseModel):
    data: list
    count: int


class BuildingRead(BaseModel):
    id: str
    nome: str
    condominio_id: str


class ContractorBuildingRead(BaseModel):
    id: str
    name: str


class FuncionarioCreate(BaseModel):
    status: bool = True
    is_default: bool = False
    nome: str
    mobile: str | None = None
    cargo: int
    email: str | None = None
    condominio_id: str


class FuncionarioUpdate(BaseModel):
    status: bool | None = None
    is_default: bool | None = None
    nome: str | None = None
    mobile: str | None = None
    cargo: int | None = None
    email: str | None = None


class FuncionarioRead(FuncionarioCreate):
    id: str


class AcessCreate(BaseModel):
    status: bool = True
    operacao: int
    building_id: str
    data: datetime | None = None


class AcessUpdate(BaseModel):
    status: bool | None = None
    data: datetime | None = None
    operacao: int | None = None
    building_id: str | None = None


class AcessTimeOut(BaseModel):
    data: datetime


class CleanerCheckoutChecklistItemRead(BaseModel):
    id: str
    label: str
    checked: bool
    position: int
    access_id: str
    checklist_item_id: str | None = None
    building_id: str
    condominio_id: str
    created_at: datetime


class AcessRead(BaseModel):
    id: str
    status: bool
    data: datetime
    operacao: int
    building_id: str
    funcionario_id: str
    checkout_checklist_items: list[CleanerCheckoutChecklistItemRead] = Field(default_factory=list)


class AcessActiveRead(BaseModel):
    has_open_session: bool
    building_id: str | None = None


class CleanerOpenAccess(BaseModel):
    name: str
    mobile: str
    in_at: datetime
    building_id: str
    building_name: str


class CleanerCheckIn(BaseModel):
    condominio_id: str | None = None
    name: str
    mobile: str
    building_id: str = "50"


class CleanerCheckOut(BaseModel):
    condominio_id: str | None = None
    mobile: str
    checked_item_ids: list[str] = Field(default_factory=list)


class ContractorPublicVisit(BaseModel):
    id: str
    name: str
    company: str
    flat: str
    building_name: str
    door_code: str | None = None
    job_description: str
    mobile: str
    in_at: datetime
    out_at: datetime | None = None
    condominio_id: str


class ContractorOpenVisit(BaseModel):
    id: str
    name: str
    company: str
    flat: str
    building_name: str
    job_description: str
    mobile: str
    in_at: datetime


class ContractorCheckIn(BaseModel):
    condominio_id: str | None = None
    name: str
    company: str
    building_id: str
    job_description: str
    mobile: str


class ContractorCheckOut(BaseModel):
    condominio_id: str | None = None
    visit_id: str
    out_at: datetime | None = None


class ContractorVisitUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    building_id: str | None = None
    job_description: str | None = None
    mobile: str | None = None
    in_at: datetime | None = None
    out_at: datetime | None = None


class UtilityReadingInput(BaseModel):
    flat: Literal["50", "51", "52"]
    energy: int = Field(ge=0)
    gas: int = Field(ge=0)


class UtilityReadingBatchCreate(BaseModel):
    reading_date: date
    readings: list[UtilityReadingInput] = Field(min_length=3, max_length=3)


class UtilityReadingPublicInput(BaseModel):
    flat: Literal["50", "51", "52"]
    value: int = Field(ge=0)


class UtilityReadingPublicBatchCreate(BaseModel):
    reading_date: date
    readings: list[UtilityReadingPublicInput] = Field(min_length=3, max_length=3)


class UtilityReadingRead(BaseModel):
    id: str
    flat: str
    building_name: str
    reading_date: date
    days: int | None
    energy: int | None
    energy_used: int | None
    energy_change_percent: float | None
    gas: int | None
    gas_used: int | None
    gas_change_percent: float | None


class MaintenanceCategoryCreate(BaseModel):
    name: str


class MaintenanceCategoryRead(BaseModel):
    id: str
    name: str
    created_at: datetime
    condominio_id: str


class MaintenanceScheduleCreate(BaseModel):
    category_id: str
    tag: str
    report: str
    frequency_days: int = Field(ge=1)
    notes: str
    cellphone: str | None = None


class MaintenanceScheduleRead(BaseModel):
    id: str
    category_id: str
    category_name: str
    tag: str
    report: str
    frequency_days: int
    notes: str
    cellphone: str | None
    latest_in_at: datetime | None
    latest_out_at: datetime | None
    is_overdue: bool
    created_at: datetime
    updated_at: datetime
    condominio_id: str


class MaintenanceRecordRead(BaseModel):
    id: str
    maintenance_id: str
    category_name: str
    tag: str
    report: str
    contractor_visit_id: str
    contractor_name: str
    contractor_mobile: str
    in_at: datetime
    out_at: datetime | None
    condominio_id: str


class ContractorVisitRead(BaseModel):
    id: str
    name: str
    company: str
    flat: str
    building_name: str
    job_description: str
    mobile: str
    extra_media_name: str | None = None
    extra_media_data: str | None = None
    extra_media_2_name: str | None = None
    extra_media_2_data: str | None = None
    extra_media_3_name: str | None = None
    extra_media_3_data: str | None = None
    extra_media_4_name: str | None = None
    extra_media_4_data: str | None = None
    in_at: datetime
    out_at: datetime | None = None
    condominio_id: str


class ContractorMediaUpdate(BaseModel):
    extra_media_name: str | None = None
    extra_media_data: str | None = None
    extra_media_2_name: str | None = None
    extra_media_2_data: str | None = None
    extra_media_3_name: str | None = None
    extra_media_3_data: str | None = None
    extra_media_4_name: str | None = None
    extra_media_4_data: str | None = None


class FlatChecklistItemWrite(BaseModel):
    id: str | None = None
    label: str
    checked: bool = False
    position: int


class FlatChecklistItemRead(BaseModel):
    id: str
    label: str
    checked: bool
    position: int
    building_id: str
    condominio_id: str
    created_at: datetime
    updated_at: datetime


class FlatChecklistWrite(BaseModel):
    items: list[FlatChecklistItemWrite] = Field(default_factory=list)


class ContractorHistoryCategoryCreate(BaseModel):
    name: str


class ContractorHistoryCategoryRead(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    condominio_id: str


class ContractorHistoryWrite(BaseModel):
    category_id: str
    created_new_visit: bool = False
    next_enabled: bool = False
    next_interval_unit: Literal["week", "month"] | None = None
    next_interval_value: int | None = None
    contractor_visit_id: str | None = None
    name: str | None = None
    company: str | None = None
    building_id: str | None = None
    job_description: str | None = None
    mobile: str | None = None
    in_at: datetime | None = None
    out_at: datetime | None = None


class ContractorHistoryRead(BaseModel):
    id: str
    category_id: str
    category_name: str
    contractor_visit_id: str
    created_new_visit: bool
    next_enabled: bool
    next_interval_unit: str | None
    next_interval_value: int | None
    next_job_at: datetime | None
    next_notify_at: datetime | None
    next_notification_sent_at: datetime | None
    name: str
    company: str
    flat: str
    building_name: str
    job_description: str
    mobile: str
    visit_in_at: datetime
    visit_out_at: datetime | None
    history_created_at: datetime
    history_updated_at: datetime
    condominio_id: str


class ExecuteDueRead(BaseModel):
    checked: int
    triggered: int
    sms_sent: int
