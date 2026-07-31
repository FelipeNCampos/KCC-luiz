from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class CashFlowCreate(BaseModel):
    has_invoice: bool = False
    invoice_number: str | None = Field(default=None, max_length=120)
    scope: str | None = None
    record_date: date
    value: Decimal
    description: str | None = Field(default=None, max_length=255)
    supplier: str | None = Field(default=None, max_length=255)
    flat: str | None = Field(default=None, max_length=120)

    @field_validator("value")
    @classmethod
    def validate_non_zero_value(cls, value: Decimal) -> Decimal:
        if value == 0:
            raise ValueError("Value must be different from zero")
        return value


class CashFlowUpdate(BaseModel):
    record_date: date | None = None
    value: Decimal | None = None
    scope: str | None = None
    description: str | None = Field(default=None, max_length=255)
    supplier: str | None = Field(default=None, max_length=255)
    flat: str | None = Field(default=None, max_length=120)

    @field_validator("value")
    @classmethod
    def validate_optional_non_zero_value(cls, value: Decimal | None) -> Decimal | None:
        if value == 0:
            raise ValueError("Value must be different from zero")
        return value


class CashFlowRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_number: int
    has_invoice: bool
    invoice_number: str | None
    invoice_media_name: str | None
    system_invoice_type: Literal["cleaner", "contractor"] | None
    record_date: date
    amount: Decimal
    description: str | None
    supplier: str | None
    flat: str | None
    balance: Decimal
    created_by_user_id: int
    created_at: datetime


class CashFlowSystemInvoice(BaseModel):
    system_invoice_type: Literal["cleaner", "contractor"]
    system_invoice_data: dict[str, Any]


class CashFlowListResponse(BaseModel):
    month: str
    monthly_total: Decimal
    current_balance: Decimal
    items: list[CashFlowRow]


class CashFlowNextPaymentNumberResponse(BaseModel):
    next_payment_number: int


class CashFlowReportRequest(BaseModel):
    email: EmailStr
    scope: str | None = None
    start_month: str | None = None
    end_month: str | None = None
    month: str | None = None
    search: str | None = None
    include_invoice_table: bool = False


class CashFlowReportPreviewRequest(BaseModel):
    scope: str | None = None
    start_month: str | None = None
    end_month: str | None = None
    month: str | None = None
    search: str | None = None
    include_invoice_table: bool = False


class CashFlowShareLinkCreate(BaseModel):
    scope: str | None = None
    date_from: date
    date_to: date
    expires_at: datetime

    @model_validator(mode="after")
    def validate_period(self) -> "CashFlowShareLinkCreate":
        if self.date_from > self.date_to:
            raise ValueError("date_from must be before or equal to date_to")
        if self.expires_at.tzinfo is None:
            raise ValueError("expires_at must include a timezone")
        return self


class CashFlowShareLinkRead(BaseModel):
    id: str
    scope: str
    date_from: date
    date_to: date
    expires_at: datetime
    created_at: datetime
    revoked_at: datetime | None
    status: str
    token: str
    share_url: str


class CashFlowShareLinkListResponse(BaseModel):
    items: list[CashFlowShareLinkRead]


class CashFlowPublicRow(BaseModel):
    record_date: date
    amount: Decimal
    description: str | None
    supplier: str | None
    flat: str | None
    has_invoice: bool
    invoice_number: str | None
    invoice_media_name: str | None
    invoice_media_mime: str | None
    invoice_media_url: str | None


class CashFlowPublicShareResponse(BaseModel):
    date_from: date
    date_to: date
    credit_total: Decimal
    debit_total: Decimal
    net_total: Decimal
    items: list[CashFlowPublicRow]
