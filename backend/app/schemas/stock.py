from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


StockRequestStatus = Literal["pending", "completed", "archived"]


class StockRequestCreate(BaseModel):
    condominio_id: str | None = None
    product_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(ge=1)
    photo_name: str | None = Field(default=None, max_length=255)
    photo_data: str | None = None


class StockRequestStatusUpdate(BaseModel):
    status: StockRequestStatus


class StockRequestRead(BaseModel):
    id: str
    product_name: str
    quantity: int
    photo_name: str | None = None
    photo_data: str | None = None
    status: StockRequestStatus
    created_at: datetime
    updated_at: datetime
    condominio_id: str
