from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CashFlowCreate(BaseModel):
    entry_type: Literal["income", "outcome"]
    has_invoice: bool = False
    record_date: date
    value: Decimal = Field(gt=0)
    description: str = Field(min_length=1, max_length=255)
    flat: str = Field(min_length=1, max_length=120)


class CashFlowRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_number: int
    has_invoice: bool
    invoice_media_name: str | None
    record_date: date
    amount: Decimal
    description: str
    flat: str
    balance: Decimal
    created_by_user_id: int
    created_at: datetime


class CashFlowListResponse(BaseModel):
    month: str
    monthly_total: Decimal
    items: list[CashFlowRow]


class CashFlowReportRequest(BaseModel):
    email: EmailStr
    month: str
    search: str | None = None
