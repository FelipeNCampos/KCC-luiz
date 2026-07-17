import json
from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_CASHFLOW_SHARE_TOKEN_ENCRYPTION_KEY = "dESTd8hWXKhgM7m46GKOr_3EMx9q-8vBrBqPMVxgTbc="


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "KCC Luiz"
    app_env: str = "development"
    app_domain: str = "localhost"
    database_url: str = (
        "postgresql+psycopg://kcc_user:change_this_database_password@db:5432/kcc_luiz"
    )

    secret_key: str = Field("dev_secret_key_change_me_with_32_chars", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    refresh_cookie_name: str = "kcc_refresh_token"
    cashflow_share_token_encryption_key: str = DEV_CASHFLOW_SHARE_TOKEN_ENCRYPTION_KEY
    cashflow_share_public_base_url: str = "http://localhost:15173"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cors_origins: str = "http://localhost:15173,http://localhost:18081"
    log_level: str = "INFO"

    admin_name: str | None = None
    admin_email: str | None = None
    admin_password: str | None = None
    secondary_user_name: str | None = None
    secondary_user_email: str | None = None
    secondary_user_password: str | None = None
    secondary_user_role: str = "admin"
    secondary_user_job_title: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from_email: str | None = None
    smtp_from_name: str = "KCC Luiz"
    cleaner_status_sms_to: str | None = None
    contractor_door_codes: str = (
        '{"Merlin":"CZ1247","Northwood":"CX1249",'
        '"Oak":"Back Door: CY1285\\nBoiler: CZ9612YX",'
        '"Oak Lodge":"Back Door: CY1285\\nBoiler: CZ9612YX"}'
    )

    @property
    def contractor_door_code_map(self) -> dict[str, str]:
        try:
            parsed = json.loads(self.contractor_door_codes)
        except json.JSONDecodeError:
            return {}
        return {str(key): str(value) for key, value in parsed.items()}

    @field_validator("cookie_samesite")
    @classmethod
    def validate_samesite(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("COOKIE_SAMESITE must be lax, strict or none")
        return normalized

    @model_validator(mode="after")
    def validate_cashflow_share_encryption_key(self) -> "Settings":
        if (
            self.is_production
            and self.cashflow_share_token_encryption_key == DEV_CASHFLOW_SHARE_TOKEN_ENCRYPTION_KEY
        ):
            raise ValueError("CASHFLOW_SHARE_TOKEN_ENCRYPTION_KEY must be configured in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        value = self.cors_origins.strip()
        if value.startswith("["):
            parsed = json.loads(value)
            return [str(origin).strip() for origin in parsed if str(origin).strip()]
        return [origin.strip() for origin in value.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
