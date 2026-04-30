import logging
import re

logger = logging.getLogger(__name__)

E164_RE = re.compile(r"^\+[1-9]\d{8,19}$")


def normalize_phone(value: str | int | None, default_country_code: str = "+44") -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    prefix = "+" if raw.startswith("+") else ""
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    normalized = f"{prefix}{digits}" if prefix else f"{default_country_code}{digits.lstrip('0')}"
    return normalized if E164_RE.match(normalized) else None


def send_sms_notification(phone_to: str, body: str) -> bool:
    logger.info("SMS notification queued to %s: %s", phone_to, body)
    return True
