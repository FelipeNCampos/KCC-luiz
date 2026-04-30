from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class CashFlowCreate(BaseModel):
    has_invoice: bool = False
    record_date: date
    value: Decimal
    description: str | None = Field(default=None, max_length=255)
    flat: str | None = Field(default=None, max_length=120)

    @field_validator("value")
    @classmethod
    def validate_non_zero_value(cls, value: Decimal) -> Decimal:
        if value == 0:
            raise ValueError("Value must be different from zero")
        return value


class CashFlowUpdate(BaseModel):
    description: str | None = Field(default=None, max_length=255)
    flat: str | None = Field(default=None, max_length=120)


class CashFlowRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_number: int
    has_invoice: bool
    invoice_media_name: str | None
    record_date: date
    amount: Decimal
    description: str | None
    flat: str | None
    balance: Decimal
    created_by_user_id: int
    created_at: datetime


class CashFlowListResponse(BaseModel):
    month: str
    monthly_total: Decimal
    items: list[CashFlowRow]


class CashFlowNextPaymentNumberResponse(BaseModel):
    next_payment_number: int


class CashFlowReportRequest(BaseModel):
    email: EmailStr
    start_month: str | None = None
    end_month: str | None = None
    month: str | None = None
    search: str | None = None
    include_invoice_table: bool = False


class CashFlowReportPreviewRequest(BaseModel):
    start_month: str | None = None
    end_month: str | None = None
    month: str | None = None
    search: str | None = None
    include_invoice_table: bool = False
