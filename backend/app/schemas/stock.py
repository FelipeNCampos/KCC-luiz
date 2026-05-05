from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, model_validator


StockRequestStatus = Literal["pending", "completed", "archived"]


class StockRequestItemCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    quantity: int = Field(ge=1)


class StockRequestCreate(BaseModel):
    condominio_id: str | None = None
    product_name: str | None = Field(default=None, min_length=1, max_length=255)
    quantity: int | None = Field(default=None, ge=1)
    photo_name: str | None = Field(default=None, max_length=255)
    photo_data: str | None = None
    items: list[StockRequestItemCreate] | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_single_or_batch(self) -> "StockRequestCreate":
        if self.items:
            return self

        if self.product_name is None or self.quantity is None:
            raise ValueError("Provide a product or at least one stock request item")

        return self


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


class StockRequestCreateResponse(BaseModel):
    data: list[StockRequestRead]
    count: int
