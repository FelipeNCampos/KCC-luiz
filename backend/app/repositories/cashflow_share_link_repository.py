from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.cashflow import CashFlowShareLink


class CashFlowShareLinkRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, link: CashFlowShareLink) -> CashFlowShareLink:
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def save(self, link: CashFlowShareLink) -> CashFlowShareLink:
        self.db.add(link)
        self.db.commit()
        self.db.refresh(link)
        return link

    def get_by_hash(self, token_hash: str) -> CashFlowShareLink | None:
        return self.db.scalar(
            select(CashFlowShareLink).where(CashFlowShareLink.token_hash == token_hash)
        )

    def get_by_id_for_condominio(
        self, link_id: str, condominio_id: str
    ) -> CashFlowShareLink | None:
        return self.db.scalar(
            select(CashFlowShareLink).where(
                CashFlowShareLink.id == link_id,
                CashFlowShareLink.condominio_id == condominio_id,
            )
        )

    def list_for_condominio(
        self, condominio_id: str, cashflow_scope: str
    ) -> list[CashFlowShareLink]:
        statement: Select[tuple[CashFlowShareLink]] = (
            select(CashFlowShareLink)
            .where(
                CashFlowShareLink.condominio_id == condominio_id,
                CashFlowShareLink.cashflow_scope == cashflow_scope,
            )
            .order_by(CashFlowShareLink.created_at.desc())
        )
        return list(self.db.scalars(statement).all())
