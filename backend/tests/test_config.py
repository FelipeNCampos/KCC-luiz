from cryptography.fernet import Fernet

from app.core.config import Settings


def test_cashflow_share_public_base_url_matches_the_application_environment() -> None:
    development = Settings(app_env="development")
    production = Settings(
        app_env="production",
        cashflow_share_token_encryption_key=Fernet.generate_key().decode(),
    )

    assert development.cashflow_share_public_base_url == "http://localhost:15173"
    assert production.cashflow_share_public_base_url == "https://kccflats.com"
