from datetime import date
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.cashflow import CashFlowRecord


class CashFlowRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_next_payment_number(self) -> int:
        statement = select(func.max(CashFlowRecord.payment_number))
        current_max = self.db.scalar(statement)
        return 1 if current_max is None else int(current_max) + 1

    def create(self, record: CashFlowRecord) -> CashFlowRecord:
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_by_id(self, record_id: int) -> CashFlowRecord | None:
        return self.db.get(CashFlowRecord, record_id)

    def delete(self, record: CashFlowRecord) -> None:
        self.db.delete(record)
        self.db.commit()

    def list_month_records(self, month_start: date, month_end: date) -> list[CashFlowRecord]:
        statement: Select[tuple[CashFlowRecord]] = (
            select(CashFlowRecord)
            .where(CashFlowRecord.record_date >= month_start, CashFlowRecord.record_date < month_end)
            .order_by(CashFlowRecord.record_date.asc(), CashFlowRecord.id.asc())
        )
        return list(self.db.scalars(statement).all())

    def get_balance_before(self, month_start: date) -> Decimal:
        statement = select(func.coalesce(func.sum(CashFlowRecord.amount), 0)).where(CashFlowRecord.record_date < month_start)
        total = self.db.scalar(statement)
        return Decimal(total or 0)
