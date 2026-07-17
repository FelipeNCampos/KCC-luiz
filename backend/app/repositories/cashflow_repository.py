from datetime import date
from decimal import Decimal

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.cashflow import CashFlowRecord
from app.models.user import User


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

    def save(self, record: CashFlowRecord) -> CashFlowRecord:
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def get_by_id(self, record_id: int) -> CashFlowRecord | None:
        return self.db.get(CashFlowRecord, record_id)

    def delete(self, record: CashFlowRecord) -> None:
        self.db.delete(record)
        self.db.commit()

    def list_month_records(
        self,
        month_start: date,
        month_end: date,
        cashflow_scope: str,
    ) -> list[CashFlowRecord]:
        statement: Select[tuple[CashFlowRecord]] = (
            select(CashFlowRecord)
            .where(
                CashFlowRecord.record_date >= month_start,
                CashFlowRecord.record_date < month_end,
            )
            .where(CashFlowRecord.cashflow_scope == cashflow_scope)
            .order_by(CashFlowRecord.record_date.asc(), CashFlowRecord.id.asc())
        )
        return list(self.db.scalars(statement).all())

    def list_range_records(
        self,
        start_date: date,
        end_date: date,
        cashflow_scope: str,
    ) -> list[CashFlowRecord]:
        statement: Select[tuple[CashFlowRecord]] = (
            select(CashFlowRecord)
            .where(
                CashFlowRecord.record_date >= start_date,
                CashFlowRecord.record_date < end_date,
            )
            .where(CashFlowRecord.cashflow_scope == cashflow_scope)
            .order_by(CashFlowRecord.record_date.asc(), CashFlowRecord.id.asc())
        )
        return list(self.db.scalars(statement).all())

    def get_balance_before(self, month_start: date, cashflow_scope: str) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(CashFlowRecord.amount), 0))
            .where(CashFlowRecord.record_date < month_start)
            .where(CashFlowRecord.cashflow_scope == cashflow_scope)
        )
        total = self.db.scalar(statement)
        return Decimal(total or 0)

    def list_records_for_public_share(
        self,
        start_date: date,
        end_date: date,
        cashflow_scope: str,
        condominio_id: str,
    ) -> list[CashFlowRecord]:
        statement: Select[tuple[CashFlowRecord]] = (
            select(CashFlowRecord)
            .join(User, CashFlowRecord.created_by_user_id == User.id)
            .where(
                CashFlowRecord.record_date >= start_date,
                CashFlowRecord.record_date < end_date,
                CashFlowRecord.cashflow_scope == cashflow_scope,
            )
            .order_by(CashFlowRecord.record_date.asc(), CashFlowRecord.id.asc())
        )
        if condominio_id == "legacy":
            statement = statement.where(User.condominio_id.is_(None))
        else:
            statement = statement.where(User.condominio_id == condominio_id)
        return list(self.db.scalars(statement).all())

    def get_record_for_public_share(
        self,
        record_id: int,
        start_date: date,
        end_date: date,
        cashflow_scope: str,
        condominio_id: str,
    ) -> CashFlowRecord | None:
        statement: Select[tuple[CashFlowRecord]] = (
            select(CashFlowRecord)
            .join(User, CashFlowRecord.created_by_user_id == User.id)
            .where(
                CashFlowRecord.id == record_id,
                CashFlowRecord.record_date >= start_date,
                CashFlowRecord.record_date < end_date,
                CashFlowRecord.cashflow_scope == cashflow_scope,
            )
        )
        if condominio_id == "legacy":
            statement = statement.where(User.condominio_id.is_(None))
        else:
            statement = statement.where(User.condominio_id == condominio_id)
        return self.db.scalar(statement)
