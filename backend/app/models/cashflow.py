from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

DEFAULT_CASHFLOW_SCOPE = "main"
CASHFLOW_52_SCOPE = "cashflow52"


class CashFlowRecord(Base):
    __tablename__ = "cashflow_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_number: Mapped[int] = mapped_column(
        Integer,
        unique=True,
        index=True,
        nullable=False,
    )
    cashflow_scope: Mapped[str] = mapped_column(
        String(40),
        default=DEFAULT_CASHFLOW_SCOPE,
        server_default=DEFAULT_CASHFLOW_SCOPE,
        index=True,
        nullable=False,
    )
    has_invoice: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invoice_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    invoice_media_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_media_mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    invoice_media_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    system_invoice_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    system_invoice_data: Mapped[str | None] = mapped_column(Text, nullable=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    supplier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    flat: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    created_by = relationship("User", back_populates="cashflow_records")


class CashFlowShareLink(Base):
    __tablename__ = "cashflow_share_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    condominio_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    cashflow_scope: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    date_from: Mapped[date] = mapped_column(Date, nullable=False)
    date_to: Mapped[date] = mapped_column(Date, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    created_by = relationship("User", foreign_keys=[created_by_user_id])
