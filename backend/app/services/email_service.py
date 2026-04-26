import smtplib
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import settings


class EmailService:
    def send_report(
        self,
        recipient: str,
        subject: str,
        body: str,
        attachment_name: str,
        attachment_data: bytes,
        attachment_mime: str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ) -> None:
        if not settings.smtp_host or not settings.smtp_from_email:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Email service is not configured",
            )

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = (
            f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
            if settings.smtp_from_name
            else settings.smtp_from_email
        )
        message["To"] = recipient
        message.set_content(body)

        maintype, subtype = attachment_mime.split("/", maxsplit=1)
        message.add_attachment(
            attachment_data,
            maintype=maintype,
            subtype=subtype,
            filename=attachment_name,
        )

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username and settings.smtp_password:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.send_message(message)
        except OSError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to send report email",
            ) from exc
