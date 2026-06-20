from datetime import date
from decimal import Decimal
from io import BytesIO

from fastapi import HTTPException, status
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf._page import PageObject
from pypdf.errors import PdfReadError
from pypdf.generic import RectangleObject
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.cashflow import CASHFLOW_52_SCOPE, DEFAULT_CASHFLOW_SCOPE, CashFlowRecord
from app.repositories.cashflow_repository import CashFlowRepository
from app.schemas.cashflow import CashFlowCreate, CashFlowListResponse, CashFlowRow, CashFlowUpdate
from app.services.email_service import EmailService


class CashFlowService:
    CASHFLOW_SCOPE_ALIASES = {
        DEFAULT_CASHFLOW_SCOPE: DEFAULT_CASHFLOW_SCOPE,
        "principal": DEFAULT_CASHFLOW_SCOPE,
        "cashflow52": CASHFLOW_52_SCOPE,
        "cashflow_52": CASHFLOW_52_SCOPE,
        "cashflow-52": CASHFLOW_52_SCOPE,
        "flat52": CASHFLOW_52_SCOPE,
        "flat_52": CASHFLOW_52_SCOPE,
        "flat-52": CASHFLOW_52_SCOPE,
        "52": CASHFLOW_52_SCOPE,
    }

    def __init__(
        self,
        repository: CashFlowRepository,
        email_service: EmailService | None = None,
    ) -> None:
        self.repository = repository
        self.email_service = email_service or EmailService()

    def create_record(
        self,
        user_id: int,
        payload: CashFlowCreate,
        invoice_media_name: str | None = None,
        invoice_media_mime: str | None = None,
        invoice_media_data: bytes | None = None,
    ) -> CashFlowRecord:
        description = self._clean_optional_text(payload.description)
        invoice_number = self._clean_optional_text(payload.invoice_number)
        supplier = self._clean_optional_text(payload.supplier)
        cashflow_scope = self._normalize_scope(payload.scope)
        flat = (
            payload.flat.strip()
            if self._scope_has_flat(cashflow_scope) and payload.flat and payload.flat.strip()
            else None
        )

        record = CashFlowRecord(
            payment_number=self.repository.get_next_payment_number(),
            cashflow_scope=cashflow_scope,
            has_invoice=payload.has_invoice,
            invoice_number=invoice_number if payload.has_invoice else None,
            invoice_media_name=invoice_media_name if payload.has_invoice else None,
            invoice_media_mime=invoice_media_mime if payload.has_invoice else None,
            invoice_media_data=invoice_media_data if payload.has_invoice else None,
            record_date=payload.record_date,
            amount=payload.value,
            description=description,
            supplier=supplier,
            flat=flat,
            created_by_user_id=user_id,
        )
        return self.repository.create(record)

    def list_month(
        self,
        month: str | None,
        search: str | None = None,
        scope: str | None = None,
    ) -> CashFlowListResponse:
        month_label, month_start, month_end = self._parse_month(month)
        return self.list_range(month_label, month_start, month_end, search, scope)

    def get_next_payment_number(self) -> int:
        return self.repository.get_next_payment_number()

    def list_range(
        self,
        period_label: str,
        start_date: date,
        end_date: date,
        search: str | None = None,
        scope: str | None = None,
    ) -> CashFlowListResponse:
        cashflow_scope = self._normalize_scope(scope)
        records = self.repository.list_range_records(start_date, end_date, cashflow_scope)
        query = (search or "").strip().lower()
        opening_balance = self.repository.get_balance_before(start_date, cashflow_scope)
        running_balance = opening_balance
        period_total = Decimal("0")
        items: list[CashFlowRow] = []
        include_flat = self._scope_has_flat(cashflow_scope)

        for dynamic_payment_number, record in enumerate(records, start=1):
            period_total += record.amount
            running_balance += record.amount

            description = record.description or ""
            supplier = record.supplier or ""
            flat = record.flat or ""
            matches_description = query in description.lower()
            matches_supplier = query in supplier.lower()
            matches_flat = include_flat and query in flat.lower()

            if query and not matches_description and not matches_supplier and not matches_flat:
                continue

            items.append(
                CashFlowRow(
                    id=record.id,
                    payment_number=dynamic_payment_number,
                    has_invoice=record.has_invoice,
                    invoice_number=record.invoice_number,
                    invoice_media_name=record.invoice_media_name,
                    record_date=record.record_date,
                    amount=record.amount,
                    description=record.description,
                    supplier=record.supplier,
                    flat=record.flat,
                    balance=running_balance,
                    created_by_user_id=record.created_by_user_id,
                    created_at=record.created_at,
                )
            )

        return CashFlowListResponse(
            month=period_label,
            monthly_total=period_total,
            current_balance=opening_balance + period_total,
            items=items,
        )

    def delete_record(self, record_id: int) -> None:
        record = self.repository.get_by_id(record_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash flow record not found",
            )
        self.repository.delete(record)

    def update_record(self, record_id: int, payload: CashFlowUpdate) -> CashFlowRecord:
        record = self.repository.get_by_id(record_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash flow record not found",
            )

        if "description" in payload.model_fields_set:
            record.description = self._clean_optional_text(payload.description)
        if "supplier" in payload.model_fields_set:
            record.supplier = self._clean_optional_text(payload.supplier)
        if "flat" in payload.model_fields_set:
            record.flat = (
                self._clean_optional_text(payload.flat)
                if self._scope_has_flat(record.cashflow_scope)
                else None
            )
        if "value" in payload.model_fields_set and payload.value is not None:
            record.amount = payload.value
        return self.repository.save(record)

    def update_invoice_media(
        self,
        record_id: int,
        invoice_number: str | None = None,
        invoice_media_name: str | None = None,
        invoice_media_mime: str | None = None,
        invoice_media_data: bytes | None = None,
    ) -> CashFlowRecord:
        record = self.repository.get_by_id(record_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash flow record not found",
            )

        if invoice_number is not None:
            record.invoice_number = self._clean_optional_text(invoice_number)

        if invoice_media_data is not None:
            record.has_invoice = True
            record.invoice_media_name = invoice_media_name or "invoice"
            record.invoice_media_mime = invoice_media_mime
            record.invoice_media_data = invoice_media_data
        elif record.invoice_number:
            record.has_invoice = True
        return self.repository.save(record)

    def get_invoice_media(self, record_id: int) -> tuple[str, str, bytes]:
        record = self.repository.get_by_id(record_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash flow record not found",
            )
        if not record.has_invoice or not record.invoice_media_data or not record.invoice_media_mime:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice media not found",
            )

        return (
            record.invoice_media_name or "invoice",
            record.invoice_media_mime,
            record.invoice_media_data,
        )

    def row_for_record(self, record: CashFlowRecord) -> CashFlowRow:
        listing = self.list_month(
            month=record.record_date.strftime("%Y-%m"),
            search=None,
            scope=record.cashflow_scope,
        )
        for row in listing.items:
            if row.id == record.id:
                return row
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to build response",
        )

    def send_month_report(self, recipient: str, month: str, search: str | None = None) -> None:
        self.send_range_report(
            recipient=recipient,
            start_month=month,
            end_month=month,
            search=search,
            include_invoice_table=False,
        )

    def send_range_report(
        self,
        recipient: str,
        start_month: str | None,
        end_month: str | None,
        scope: str | None = None,
        search: str | None = None,
        include_invoice_table: bool = False,
        fallback_month: str | None = None,
    ) -> None:
        period_label, report_data = self.build_range_report_pdf(
            start_month=start_month,
            end_month=end_month,
            scope=scope,
            search=search,
            include_invoice_table=include_invoice_table,
            fallback_month=fallback_month,
        )
        cashflow_scope = self._normalize_scope(scope)
        report_name = self._scope_report_name(cashflow_scope)
        file_prefix = "cashflow-52" if cashflow_scope == CASHFLOW_52_SCOPE else "cashflow"
        file_name = f"{file_prefix}-report-{period_label}.pdf"
        subject = f"{report_name} report {period_label}"
        body = f"Attached is the {report_name.lower()} report for {period_label}."

        self.email_service.send_report(
            recipient=recipient,
            subject=subject,
            body=body,
            attachment_name=file_name,
            attachment_data=report_data,
            attachment_mime="application/pdf",
        )

    def build_range_report_pdf(
        self,
        start_month: str | None,
        end_month: str | None,
        scope: str | None = None,
        search: str | None = None,
        include_invoice_table: bool = False,
        fallback_month: str | None = None,
    ) -> tuple[str, bytes]:
        period_label, period_start, period_end = self._parse_month_range(
            start_month=start_month,
            end_month=end_month,
            fallback_month=fallback_month,
        )
        cashflow_scope = self._normalize_scope(scope)
        listing = self.list_range(period_label, period_start, period_end, search, cashflow_scope)
        opening_balance = self.repository.get_balance_before(period_start, cashflow_scope)
        closing_balance = opening_balance + listing.monthly_total
        report_data = self._build_report_pdf(
            listing,
            opening_balance,
            closing_balance,
            self._scope_report_name(cashflow_scope),
            search,
            include_invoice_table,
            self._scope_has_flat(cashflow_scope),
        )
        return period_label, report_data

    def _build_report_pdf(
        self,
        listing: CashFlowListResponse,
        opening_balance: Decimal,
        closing_balance: Decimal,
        report_title: str,
        search: str | None,
        include_invoice_table: bool,
        include_flat_fields: bool,
    ) -> bytes:
        writer = PdfWriter()
        summary_pdf = self._build_report_summary_pdf(
            listing,
            opening_balance,
            closing_balance,
            report_title,
            search,
            include_invoice_table,
            include_flat_fields,
        )
        for page in PdfReader(BytesIO(summary_pdf)).pages:
            writer.add_page(page)

        for item in listing.items:
            record = self.repository.get_by_id(item.id)
            if (
                not record
                or not record.has_invoice
                or not record.invoice_media_data
                or not record.invoice_media_mime
            ):
                continue
            self._append_media_pages(
                writer,
                record.invoice_media_data,
                record.invoice_media_mime,
                self._report_invoice_label(record.invoice_number, item.payment_number),
            )

        output = BytesIO()
        writer.write(output)
        return output.getvalue()

    @staticmethod
    def _build_report_summary_pdf(
        listing: CashFlowListResponse,
        opening_balance: Decimal,
        closing_balance: Decimal,
        report_title: str,
        search: str | None,
        include_invoice_table: bool,
        include_flat_fields: bool,
    ) -> bytes:
        output = BytesIO()
        doc = SimpleDocTemplate(
            output,
            pagesize=A4,
            leftMargin=14 * mm,
            rightMargin=14 * mm,
            topMargin=14 * mm,
            bottomMargin=14 * mm,
        )
        styles = getSampleStyleSheet()
        story = [
            Paragraph(f"{report_title} Report", styles["Title"]),
            Paragraph(f"Period: {listing.month}", styles["Normal"]),
            Paragraph(
                f"Filter: {search.strip()}"
                if search and search.strip()
                else "Filter: All records",
                styles["Normal"],
            ),
            Spacer(1, 8),
        ]

        summary_rows = [
            ["Opening Balance", CashFlowService._format_money(opening_balance)],
            ["Period Balance", CashFlowService._format_money(listing.monthly_total)],
            ["Closing Balance", CashFlowService._format_money(closing_balance)],
        ]
        story.append(
            CashFlowService._styled_table(summary_rows, [90 * mm, 55 * mm], has_header=False)
        )
        story.append(Spacer(1, 12))

        if include_flat_fields:
            rows = [["Invoice No", "Invoice", "Date", "Amount", "Comments", "Supplier", "Flat", "Balance"]]
            rows.extend(
                [
                    [
                        f"#{item.payment_number}",
                        "Yes" if item.has_invoice else "No",
                        CashFlowService._format_date(item.record_date),
                        CashFlowService._format_money(item.amount),
                        item.description or "",
                        item.supplier or "",
                        item.flat or "",
                        CashFlowService._format_money(item.balance),
                    ]
                    for item in listing.items
                ]
            )
            if len(rows) == 1:
                rows.append(["-", "-", "-", "-", "No records for this period.", "-", "-", "-"])
            record_widths = [16 * mm, 16 * mm, 20 * mm, 22 * mm, 38 * mm, 34 * mm, 16 * mm, 21 * mm]
        else:
            rows = [["Invoice No", "Invoice", "Date", "Amount", "Comments", "Supplier", "Balance"]]
            rows.extend(
                [
                    [
                        f"#{item.payment_number}",
                        "Yes" if item.has_invoice else "No",
                        CashFlowService._format_date(item.record_date),
                        CashFlowService._format_money(item.amount),
                        item.description or "",
                        item.supplier or "",
                        CashFlowService._format_money(item.balance),
                    ]
                    for item in listing.items
                ]
            )
            if len(rows) == 1:
                rows.append(["-", "-", "-", "-", "No records for this period.", "-", "-"])
            record_widths = [18 * mm, 18 * mm, 22 * mm, 24 * mm, 48 * mm, 32 * mm, 22 * mm]
        story.append(
            CashFlowService._styled_table(
                rows,
                record_widths,
            )
        )

        if include_invoice_table:
            story.append(Spacer(1, 14))
            story.append(Paragraph("Invoices", styles["Heading2"]))
            if include_flat_fields:
                invoice_rows = [["Invoice No", "Date", "File", "Comments", "Supplier", "Flat"]]
                invoice_rows.extend(
                    [
                        [
                            f"#{item.payment_number}",
                            CashFlowService._format_date(item.record_date),
                            item.invoice_media_name or "invoice",
                            item.description or "",
                            item.supplier or "",
                            item.flat or "",
                        ]
                        for item in listing.items
                        if item.has_invoice
                    ]
                )
                if len(invoice_rows) == 1:
                    invoice_rows.append(["-", "-", "No invoice media in this period.", "-", "-", "-"])
                invoice_widths = [20 * mm, 22 * mm, 34 * mm, 42 * mm, 38 * mm, 18 * mm]
            else:
                invoice_rows = [["Invoice No", "Date", "File", "Comments", "Supplier"]]
                invoice_rows.extend(
                    [
                        [
                            f"#{item.payment_number}",
                            CashFlowService._format_date(item.record_date),
                            item.invoice_media_name or "invoice",
                            item.description or "",
                            item.supplier or "",
                        ]
                        for item in listing.items
                        if item.has_invoice
                    ]
                )
                if len(invoice_rows) == 1:
                    invoice_rows.append(["-", "-", "No invoice media in this period.", "-", "-"])
                invoice_widths = [22 * mm, 24 * mm, 36 * mm, 52 * mm, 42 * mm]
            story.append(
                CashFlowService._styled_table(
                    invoice_rows,
                    invoice_widths,
                )
            )

        doc.build(story)
        return output.getvalue()

    @staticmethod
    def _styled_table(
        rows: list[list[object]],
        widths: list[float],
        has_header: bool = True,
    ) -> Table:
        table = Table(rows, colWidths=widths, repeatRows=1 if has_header else 0)
        style = [
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E0DC")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ]
        if has_header:
            style.extend(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#8C7569")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ]
            )
        else:
            style.extend(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F5F1EE")),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ]
            )
        table.setStyle(TableStyle(style))
        return table

    @staticmethod
    def _append_media_pages(
        writer: PdfWriter,
        data: bytes,
        mime_type: str,
        invoice_label: str,
    ) -> None:
        if mime_type == "application/pdf":
            try:
                reader = PdfReader(BytesIO(data))
                for page in reader.pages:
                    writer.add_page(CashFlowService._center_pdf_page(page, invoice_label))
                return
            except (PdfReadError, ValueError, TypeError):
                pass

        if mime_type.startswith("image/"):
            try:
                media_pdf = CashFlowService._image_to_centered_pdf_page(data, invoice_label)
                for page in PdfReader(BytesIO(media_pdf)).pages:
                    writer.add_page(page)
                return
            except OSError:
                pass

        fallback_pdf = CashFlowService._placeholder_pdf_page(
            "Unable to render invoice media",
            invoice_label,
        )
        for page in PdfReader(BytesIO(fallback_pdf)).pages:
            writer.add_page(page)

    @staticmethod
    def _center_pdf_page(source_page: PageObject, invoice_label: str) -> PageObject:
        page_width, page_height = A4
        target_page = PageObject.create_blank_page(width=page_width, height=page_height)
        media_box = source_page.mediabox
        source_width = float(media_box.width)
        source_height = float(media_box.height)
        if source_width <= 0 or source_height <= 0:
            target_page.merge_page(CashFlowService._invoice_header_page(invoice_label))
            return target_page
        content_x, content_y, content_width, content_height = CashFlowService._media_content_box()
        scale = min(content_width / source_width, content_height / source_height)
        x_offset = content_x + (content_width - source_width * scale) / 2
        y_offset = content_y + (content_height - source_height * scale) / 2
        source_page.cropbox = RectangleObject(media_box)
        transformation = Transformation().scale(scale).translate(x_offset, y_offset)
        target_page.merge_transformed_page(source_page, transformation)
        target_page.merge_page(CashFlowService._invoice_header_page(invoice_label))
        return target_page

    @staticmethod
    def _image_to_centered_pdf_page(data: bytes, invoice_label: str) -> bytes:
        output = BytesIO()
        page_width, page_height = A4
        image = ImageReader(BytesIO(data))
        image_width, image_height = image.getSize()
        content_x, content_y, content_width, content_height = CashFlowService._media_content_box()
        scale = min(content_width / image_width, content_height / image_height)
        draw_width = image_width * scale
        draw_height = image_height * scale
        x = content_x + (content_width - draw_width) / 2
        y = content_y + (content_height - draw_height) / 2

        pdf = canvas.Canvas(output, pagesize=A4)
        CashFlowService._draw_invoice_header(pdf, page_width, page_height, invoice_label)
        pdf.drawImage(
            image,
            x,
            y,
            width=draw_width,
            height=draw_height,
            preserveAspectRatio=True,
            mask="auto",
        )
        pdf.showPage()
        pdf.save()
        return output.getvalue()

    @staticmethod
    def _placeholder_pdf_page(message: str, invoice_label: str) -> bytes:
        output = BytesIO()
        page_width, page_height = A4
        pdf = canvas.Canvas(output, pagesize=A4)
        CashFlowService._draw_invoice_header(pdf, page_width, page_height, invoice_label)
        pdf.setFont("Helvetica", 11)
        _, content_y, _, content_height = CashFlowService._media_content_box()
        pdf.drawCentredString(page_width / 2, content_y + content_height / 2, message)
        pdf.showPage()
        pdf.save()
        return output.getvalue()

    @staticmethod
    def _invoice_header_page(invoice_label: str) -> PageObject:
        overlay_pdf = BytesIO()
        page_width, page_height = A4
        pdf = canvas.Canvas(overlay_pdf, pagesize=A4)
        CashFlowService._draw_invoice_header(pdf, page_width, page_height, invoice_label)
        pdf.showPage()
        pdf.save()
        return PdfReader(BytesIO(overlay_pdf.getvalue())).pages[0]

    @staticmethod
    def _draw_invoice_header(
        pdf: canvas.Canvas,
        page_width: float,
        page_height: float,
        invoice_label: str,
    ) -> None:
        header_height = page_height * 0.07
        pdf.setFillColor(colors.HexColor("#C62828"))
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(10 * mm, page_height - header_height / 2, invoice_label)

    @staticmethod
    def _media_content_box() -> tuple[float, float, float, float]:
        page_width, page_height = A4
        header_height = page_height * 0.07
        horizontal_padding = 10 * mm
        vertical_padding = 8 * mm
        return (
            horizontal_padding,
            vertical_padding,
            page_width - (horizontal_padding * 2),
            (page_height - header_height) - (vertical_padding * 2),
        )

    @staticmethod
    def _report_invoice_label(invoice_number: str | None, payment_number: int) -> str:
        return f"Invoice: {invoice_number}" if invoice_number else f"Invoice No #{payment_number}"

    @staticmethod
    def _format_money(value: Decimal) -> str:
        return f"£ {value:,.2f}"

    @staticmethod
    def _format_date(value: date) -> str:
        return value.strftime("%d-%m-%Y")

    @classmethod
    def _normalize_scope(cls, scope: str | None) -> str:
        normalized = (scope or DEFAULT_CASHFLOW_SCOPE).strip().lower().replace(" ", "")
        if not normalized:
            normalized = DEFAULT_CASHFLOW_SCOPE

        cashflow_scope = cls.CASHFLOW_SCOPE_ALIASES.get(normalized)
        if cashflow_scope is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid cashflow scope",
            )
        return cashflow_scope

    @classmethod
    def _scope_has_flat(cls, scope: str | None) -> bool:
        return cls._normalize_scope(scope) == DEFAULT_CASHFLOW_SCOPE

    @classmethod
    def _scope_report_name(cls, scope: str | None) -> str:
        return "Cashflow 52" if cls._normalize_scope(scope) == CASHFLOW_52_SCOPE else "Cashflow"

    @staticmethod
    def _parse_month(month: str | None) -> tuple[str, date, date]:
        if month is None or not month.strip():
            today = date.today()
            month_start = date(today.year, today.month, 1)
            month_label = f"{today.year:04d}-{today.month:02d}"
        else:
            try:
                year_str, month_str = month.split("-", maxsplit=1)
                year = int(year_str)
                month_value = int(month_str)
                month_start = date(year, month_value, 1)
                month_label = f"{year:04d}-{month_value:02d}"
            except (TypeError, ValueError) as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Invalid month format. Use YYYY-MM",
                ) from exc

        if month_start.month == 12:
            month_end = date(month_start.year + 1, 1, 1)
        else:
            month_end = date(month_start.year, month_start.month + 1, 1)

        return month_label, month_start, month_end

    @classmethod
    def _parse_month_range(
        cls,
        start_month: str | None,
        end_month: str | None,
        fallback_month: str | None = None,
    ) -> tuple[str, date, date]:
        if fallback_month and (not start_month or not end_month):
            start_month = fallback_month
            end_month = fallback_month

        if not start_month or not end_month:
            today = date.today()
            default_month = f"{today.year:04d}-{today.month:02d}"
            start_month = start_month or default_month
            end_month = end_month or start_month

        start_label, start_date, _ = cls._parse_month(start_month)
        end_label, end_start, end_exclusive = cls._parse_month(end_month)
        if start_date > end_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Start month must be before or equal to end month",
            )

        period_label = start_label if start_label == end_label else f"{start_label}_to_{end_label}"
        return period_label, start_date, end_exclusive

    @staticmethod
    def _clean_optional_text(value: str | None) -> str | None:
        cleaned = value.strip() if value and value.strip() else None
        return cleaned
