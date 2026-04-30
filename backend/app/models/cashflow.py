from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CashFlowRecord(Base):
    __tablename__ = "cashflow_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    payment_number: Mapped[int] = mapped_column(Integer, unique=True, index=True, nullable=False)
    has_invoice: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invoice_media_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_media_mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    invoice_media_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    record_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    flat: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    created_by = relationship("User", back_populates="cashflow_records")
