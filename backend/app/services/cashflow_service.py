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

from app.models.cashflow import CashFlowRecord
from app.repositories.cashflow_repository import CashFlowRepository
from app.schemas.cashflow import CashFlowCreate, CashFlowListResponse, CashFlowRow, CashFlowUpdate
from app.services.email_service import EmailService


class CashFlowService:
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
        if payload.has_invoice and not invoice_media_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invoice media is required when invoice is Yes",
            )

        description = (
            payload.description.strip()
            if payload.description and payload.description.strip()
            else None
        )
        flat = payload.flat.strip() if payload.flat and payload.flat.strip() else None

        record = CashFlowRecord(
            payment_number=self.repository.get_next_payment_number(),
            has_invoice=payload.has_invoice,
            invoice_media_name=invoice_media_name if payload.has_invoice else None,
            invoice_media_mime=invoice_media_mime if payload.has_invoice else None,
            invoice_media_data=invoice_media_data if payload.has_invoice else None,
            record_date=payload.record_date,
            amount=payload.value,
            description=description,
            flat=flat,
            created_by_user_id=user_id,
        )
        return self.repository.create(record)

    def list_month(self, month: str | None, search: str | None = None) -> CashFlowListResponse:
        month_label, month_start, month_end = self._parse_month(month)
        return self.list_range(month_label, month_start, month_end, search)

    def get_next_payment_number(self) -> int:
        return self.repository.get_next_payment_number()

    def list_range(
        self,
        period_label: str,
        start_date: date,
        end_date: date,
        search: str | None = None,
    ) -> CashFlowListResponse:
        records = self.repository.list_range_records(start_date, end_date)
        query = (search or "").strip().lower()
        opening_balance = self.repository.get_balance_before(start_date)
        running_balance = opening_balance
        period_total = Decimal("0")
        items: list[CashFlowRow] = []

        for dynamic_payment_number, record in enumerate(records, start=1):
            period_total += record.amount
            running_balance += record.amount

            description = record.description or ""
            flat = record.flat or ""

            if query and query not in description.lower() and query not in flat.lower():
                continue

            items.append(
                CashFlowRow(
                    id=record.id,
                    payment_number=dynamic_payment_number,
                    has_invoice=record.has_invoice,
                    invoice_media_name=record.invoice_media_name,
                    record_date=record.record_date,
                    amount=record.amount,
                    description=record.description,
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
        if "flat" in payload.model_fields_set:
            record.flat = self._clean_optional_text(payload.flat)
        if "value" in payload.model_fields_set and payload.value is not None:
            record.amount = payload.value
        return self.repository.save(record)

    def update_invoice_media(
        self,
        record_id: int,
        invoice_media_name: str | None,
        invoice_media_mime: str | None,
        invoice_media_data: bytes,
    ) -> CashFlowRecord:
        record = self.repository.get_by_id(record_id)
        if record is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cash flow record not found",
            )

        record.has_invoice = True
        record.invoice_media_name = invoice_media_name or "invoice"
        record.invoice_media_mime = invoice_media_mime
        record.invoice_media_data = invoice_media_data
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
        listing = self.list_month(month=record.record_date.strftime("%Y-%m"), search=None)
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
        search: str | None = None,
        include_invoice_table: bool = False,
        fallback_month: str | None = None,
    ) -> None:
        period_label, report_data = self.build_range_report_pdf(
            start_month=start_month,
            end_month=end_month,
            search=search,
            include_invoice_table=include_invoice_table,
            fallback_month=fallback_month,
        )
        file_name = f"cashflow-report-{period_label}.pdf"
        subject = f"Cashflow report {period_label}"
        body = f"Attached is the cashflow report for {period_label}."

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
        search: str | None = None,
        include_invoice_table: bool = False,
        fallback_month: str | None = None,
    ) -> tuple[str, bytes]:
        period_label, period_start, period_end = self._parse_month_range(
            start_month=start_month,
            end_month=end_month,
            fallback_month=fallback_month,
        )
        listing = self.list_range(period_label, period_start, period_end, search)
        opening_balance = self.repository.get_balance_before(period_start)
        closing_balance = opening_balance + listing.monthly_total
        report_data = self._build_report_pdf(
            listing,
            opening_balance,
            closing_balance,
            search,
            include_invoice_table,
        )
        return period_label, report_data

    def _build_report_pdf(
        self,
        listing: CashFlowListResponse,
        opening_balance: Decimal,
        closing_balance: Decimal,
        search: str | None,
        include_invoice_table: bool,
    ) -> bytes:
        writer = PdfWriter()
        summary_pdf = self._build_report_summary_pdf(
            listing,
            opening_balance,
            closing_balance,
            search,
            include_invoice_table,
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
            self._append_media_pages(writer, record.invoice_media_data, record.invoice_media_mime)

        output = BytesIO()
        writer.write(output)
        return output.getvalue()

    @staticmethod
    def _build_report_summary_pdf(
        listing: CashFlowListResponse,
        opening_balance: Decimal,
        closing_balance: Decimal,
        search: str | None,
        include_invoice_table: bool,
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
            Paragraph("Cashflow Report", styles["Title"]),
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

        rows = [["Payment #", "Invoice", "Date", "Amount", "Comments", "Flat", "Balance"]]
        rows.extend(
            [
                [
                    f"#{item.payment_number}",
                    "Yes" if item.has_invoice else "No",
                    CashFlowService._format_date(item.record_date),
                    CashFlowService._format_money(item.amount),
                    item.description or "",
                    item.flat or "",
                    CashFlowService._format_money(item.balance),
                ]
                for item in listing.items
            ]
        )
        if len(rows) == 1:
            rows.append(["-", "-", "-", "-", "No records for this period.", "-", "-"])
        story.append(
            CashFlowService._styled_table(
                rows,
                [18 * mm, 18 * mm, 23 * mm, 25 * mm, 50 * mm, 18 * mm, 25 * mm],
            )
        )

        if include_invoice_table:
            story.append(Spacer(1, 14))
            story.append(Paragraph("Invoices", styles["Heading2"]))
            invoice_rows = [["Payment #", "Date", "File", "Comments", "Flat"]]
            invoice_rows.extend(
                [
                    [
                        f"#{item.payment_number}",
                        CashFlowService._format_date(item.record_date),
                        item.invoice_media_name or "invoice",
                        item.description or "",
                        item.flat or "",
                    ]
                    for item in listing.items
                    if item.has_invoice
                ]
            )
            if len(invoice_rows) == 1:
                invoice_rows.append(["-", "-", "No invoice media in this period.", "-", "-"])
            story.append(
                CashFlowService._styled_table(
                    invoice_rows,
                    [22 * mm, 25 * mm, 45 * mm, 62 * mm, 23 * mm],
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
    def _append_media_pages(writer: PdfWriter, data: bytes, mime_type: str) -> None:
        if mime_type == "application/pdf":
            try:
                reader = PdfReader(BytesIO(data))
                for page in reader.pages:
                    writer.add_page(CashFlowService._center_pdf_page(page))
                return
            except (PdfReadError, ValueError, TypeError):
                pass

        if mime_type.startswith("image/"):
            try:
                media_pdf = CashFlowService._image_to_centered_pdf_page(data)
                for page in PdfReader(BytesIO(media_pdf)).pages:
                    writer.add_page(page)
                return
            except OSError:
                pass

        fallback_pdf = CashFlowService._placeholder_pdf_page("Unable to render invoice media")
        for page in PdfReader(BytesIO(fallback_pdf)).pages:
            writer.add_page(page)

    @staticmethod
    def _center_pdf_page(source_page: PageObject) -> PageObject:
        page_width, page_height = A4
        target_page = PageObject.create_blank_page(width=page_width, height=page_height)
        media_box = source_page.mediabox
        source_width = float(media_box.width)
        source_height = float(media_box.height)
        if source_width <= 0 or source_height <= 0:
            return target_page
        scale = min(page_width / source_width, page_height / source_height)
        x_offset = (page_width - source_width * scale) / 2
        y_offset = (page_height - source_height * scale) / 2
        source_page.cropbox = RectangleObject(media_box)
        transformation = Transformation().scale(scale).translate(x_offset, y_offset)
        target_page.merge_transformed_page(source_page, transformation)
        return target_page

    @staticmethod
    def _image_to_centered_pdf_page(data: bytes) -> bytes:
        output = BytesIO()
        page_width, page_height = A4
        image = ImageReader(BytesIO(data))
        image_width, image_height = image.getSize()
        scale = min(page_width / image_width, page_height / image_height)
        draw_width = image_width * scale
        draw_height = image_height * scale
        x = (page_width - draw_width) / 2
        y = (page_height - draw_height) / 2

        pdf = canvas.Canvas(output, pagesize=A4)
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
    def _placeholder_pdf_page(message: str) -> bytes:
        output = BytesIO()
        page_width, page_height = A4
        pdf = canvas.Canvas(output, pagesize=A4)
        pdf.setFont("Helvetica", 11)
        pdf.drawCentredString(page_width / 2, page_height / 2, message)
        pdf.showPage()
        pdf.save()
        return output.getvalue()

    @staticmethod
    def _format_money(value: Decimal) -> str:
        return f"£ {value:,.2f}"

    @staticmethod
    def _format_date(value: date) -> str:
        return value.strftime("%d-%m-%Y")

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
