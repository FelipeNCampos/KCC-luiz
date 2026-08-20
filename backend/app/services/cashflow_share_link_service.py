import secrets
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from hashlib import sha256

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

from app.core.config import settings
from app.models.cashflow import CashFlowRecord, CashFlowShareLink
from app.models.user import User
from app.repositories.cashflow_repository import CashFlowRepository
from app.repositories.cashflow_share_link_repository import CashFlowShareLinkRepository
from app.schemas.cashflow import (
    CashFlowPublicRow,
    CashFlowPublicShareResponse,
    CashFlowShareLinkCreate,
    CashFlowShareLinkRead,
)
from app.services.cashflow_service import CashFlowService

LEGACY_CONDOMINIO_ID = "legacy"


def now_utc() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


class CashFlowShareLinkService:
    def __init__(
        self,
        share_repository: CashFlowShareLinkRepository,
        cashflow_repository: CashFlowRepository,
    ) -> None:
        self.share_repository = share_repository
        self.cashflow_repository = cashflow_repository
        self.cipher = Fernet(settings.cashflow_share_token_encryption_key.encode())

    def create(self, current_user: User, payload: CashFlowShareLinkCreate) -> CashFlowShareLinkRead:
        expires_at = payload.expires_at.astimezone(UTC)
        if expires_at <= now_utc():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="expires_at must be in the future",
            )

        token = secrets.token_urlsafe(32)
        link = CashFlowShareLink(
            condominio_id=self.condominio_id_for_user(current_user),
            cashflow_scope=CashFlowService._normalize_scope(payload.scope),
            date_from=payload.date_from,
            date_to=payload.date_to,
            expires_at=expires_at,
            token_hash=self.hash_token(token),
            token_encrypted=self.cipher.encrypt(token.encode()).decode(),
            created_by_user_id=current_user.id,
        )
        return self.to_read(self.share_repository.create(link), token)

    def list_links(
        self, current_user: User, scope: str | None = None
    ) -> list[CashFlowShareLinkRead]:
        return [
            self.to_read(link, self.decrypt_token(link.token_encrypted))
            for link in self.share_repository.list_for_condominio(
                self.condominio_id_for_user(current_user),
                CashFlowService._normalize_scope(scope),
            )
        ]

    def revoke(self, current_user: User, link_id: str) -> CashFlowShareLinkRead:
        link = self.share_repository.get_by_id_for_condominio(
            link_id,
            self.condominio_id_for_user(current_user),
        )
        if link is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Share link not found"
            )
        if link.revoked_at is None:
            link.revoked_at = now_utc()
            link = self.share_repository.save(link)
        return self.to_read(link, self.decrypt_token(link.token_encrypted))

    def public_view(self, token: str) -> CashFlowPublicShareResponse:
        link = self.require_available_link(token)
        records = self.records_for_link(link)
        credit_total = sum((record.amount for record in records if record.amount > 0), Decimal("0"))
        debit_total = sum((record.amount for record in records if record.amount < 0), Decimal("0"))

        return CashFlowPublicShareResponse(
            date_from=link.date_from,
            date_to=link.date_to,
            credit_total=credit_total,
            debit_total=debit_total,
            net_total=credit_total + debit_total,
            items=[self.public_row(record, token) for record in records],
        )

    def public_invoice(self, token: str, record_id: int) -> tuple[str, str, bytes]:
        link = self.require_available_link(token)
        record = self.cashflow_repository.get_record_for_public_share(
            record_id=record_id,
            start_date=link.date_from,
            end_date=link.date_to + timedelta(days=1),
            cashflow_scope=link.cashflow_scope,
            condominio_id=link.condominio_id,
        )
        if (
            record is None
            or not record.has_invoice
            or not record.invoice_media_data
            or not record.invoice_media_mime
        ):
            self.unavailable()
        return (
            record.invoice_media_name or "invoice",
            record.invoice_media_mime,
            record.invoice_media_data,
        )

    @staticmethod
    def condominio_id_for_user(user: User) -> str:
        return user.condominio_id or LEGACY_CONDOMINIO_ID

    @staticmethod
    def hash_token(token: str) -> str:
        return sha256(token.encode()).hexdigest()

    def require_available_link(self, token: str) -> CashFlowShareLink:
        link = self.share_repository.get_by_hash(self.hash_token(token))
        if link is None or link.revoked_at is not None or as_utc(link.expires_at) <= now_utc():
            self.unavailable()
        return link

    def records_for_link(self, link: CashFlowShareLink) -> list[CashFlowRecord]:
        return self.cashflow_repository.list_records_for_public_share(
            start_date=link.date_from,
            end_date=link.date_to + timedelta(days=1),
            cashflow_scope=link.cashflow_scope,
            condominio_id=link.condominio_id,
        )

    def to_read(self, link: CashFlowShareLink, token: str) -> CashFlowShareLinkRead:
        return CashFlowShareLinkRead(
            id=link.id,
            scope=link.cashflow_scope,
            date_from=link.date_from,
            date_to=link.date_to,
            expires_at=as_utc(link.expires_at),
            created_at=link.created_at,
            revoked_at=link.revoked_at,
            status=self.status_for(link),
            token=token,
            share_url=self.share_url(token),
        )

    def public_row(self, record: CashFlowRecord, token: str) -> CashFlowPublicRow:
        invoice_media_url = None
        if record.has_invoice and record.invoice_media_data and record.invoice_media_mime:
            invoice_media_url = f"/api/v1/cashflow/shared/{token}/records/{record.id}/invoice"
        return CashFlowPublicRow(
            record_date=record.record_date,
            amount=record.amount,
            description=record.description,
            notes=record.notes,
            supplier=record.supplier,
            flat=record.flat,
            has_invoice=record.has_invoice,
            invoice_number=record.invoice_number,
            invoice_media_name=record.invoice_media_name,
            invoice_media_mime=record.invoice_media_mime,
            invoice_media_url=invoice_media_url,
        )

    def decrypt_token(self, encrypted_token: str) -> str:
        try:
            return self.cipher.decrypt(encrypted_token.encode()).decode()
        except InvalidToken as exc:
            raise RuntimeError("Unable to decrypt cashflow share link token") from exc

    @staticmethod
    def status_for(link: CashFlowShareLink) -> str:
        if link.revoked_at is not None:
            return "revoked"
        if as_utc(link.expires_at) <= now_utc():
            return "expired"
        return "active"

    @staticmethod
    def share_url(token: str) -> str:
        return f"{settings.cashflow_share_public_base_url.rstrip('/')}/cash-flow/share/{token}"

    @staticmethod
    def unavailable() -> None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share link unavailable")
