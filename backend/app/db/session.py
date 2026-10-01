from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.db.base import Base

connect_args = {}
if settings.is_sqlite:
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.resolved_database_url,
    connect_args=connect_args,
    echo=settings.DEBUG and settings.ENVIRONMENT == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create tables if they don't exist yet (for dev and tests) and migrate schema."""
    from app.db import models  # noqa: F401
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)

    # Safe lightweight schema migrations for existing databases
    with engine.connect() as conn:
        for col, col_type in [
            ("auto_merge_enabled", "BOOLEAN DEFAULT 1"),
            ("merged_at", "DATETIME"),
            ("merged_by", "VARCHAR(150)"),
            ("merge_commit_sha", "VARCHAR(40)"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE pull_requests ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists

        for col, col_type in [
            ("auto_merge_default", "BOOLEAN DEFAULT 1"),
            ("merge_method", "VARCHAR(20) DEFAULT 'squash'"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE repositories ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass  # column already exists
