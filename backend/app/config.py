"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str

    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

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


settings = Settings()
