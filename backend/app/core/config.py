import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "sqlite:///./coderefactor.db"

    # GitHub Integration
    GITHUB_WEBHOOK_SECRET: str = ""
    GITHUB_TOKEN: str = ""

    # AI Configuration (Groq Free Tier)
    # Get a free key instantly at https://console.groq.com/keys
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"

    # Security & Dashboard API
    DASHBOARD_API_TOKEN: Optional[str] = None
    JWT_SECRET: str = "coderefactor-jwt-secret-key-development"
    FRONTEND_URL: str = "http://localhost:5173"

    # GitHub OAuth Application (for Login with GitHub)
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    WEBHOOK_PUBLIC_URL: str = ""  # e.g. Smee or ngrok URL for automated webhook creation

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def resolved_database_url(self) -> str:
        if self.DATABASE_URL.startswith("sqlite:///./") or self.DATABASE_URL == "sqlite:///coderefactor.db":
            from pathlib import Path
            base_dir = Path(__file__).resolve().parent.parent.parent
            db_file = (base_dir / "coderefactor.db").resolve()
            return f"sqlite:///{db_file.as_posix()}"
        return self.DATABASE_URL


settings = Settings()
