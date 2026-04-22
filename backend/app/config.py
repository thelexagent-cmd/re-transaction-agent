"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    @field_validator("secret_key")
    @classmethod
    def secret_key_strength(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "secret_key must be at least 32 characters. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return v

    # Cloudflare Turnstile (CAPTCHA)
    turnstile_secret_key: str = ""  # Set in production. Test key: 1x0000000000000000000000000000000AA

    # AWS / R2 Storage
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_bucket_name: str = "real-estate-agent-docs"
    aws_region: str = "us-east-1"
    aws_endpoint_url: str | None = None  # Set for Cloudflare R2

    # Local storage fallback (used when S3 is not configured)
    local_storage_path: str = "/tmp/real-estate-agent-uploads"

    # Anthropic API
    anthropic_api_key: str = ""

    # Redis (Celery broker + result backend)
    redis_url: str = "redis://localhost:6379/0"

    # Email (Gmail SMTP)
    gmail_user: str = ""
    gmail_app_password: str = ""
    from_email: str = "the.lex.agent@gmail.com"
    from_name: str = "Lex Transaction Agent"

    # Twilio (outbound SMS)
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    # Market Overview
    zillow_rapidapi_key: str = ""
    telegram_bot_token: str = ""      # @TheLexAI_bot token
    telegram_chat_id: str = ""        # Nico's personal Telegram user ID
    google_maps_api_key: str = ""     # For frontend map embed


settings = Settings()
