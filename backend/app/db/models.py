from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Integer,
    BigInteger,
    Float,
    Boolean,
    JSON,
    String,
    Text,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    github_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    github_access_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    repositories: Mapped[List["Repository"]] = relationship("Repository", back_populates="user")


class Repository(Base):
    __tablename__ = "repositories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    github_repo_id: Mapped[Optional[int]] = mapped_column(BigInteger, unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    default_branch: Mapped[str] = mapped_column(String(100), default="main")
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="repositories")
    pull_requests: Mapped[List["PullRequest"]] = relationship(
        "PullRequest", back_populates="repository", cascade="all, delete-orphan"
    )


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    repo_id: Mapped[int] = mapped_column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), index=True)
    pr_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), default="")
    author: Mapped[str] = mapped_column(String(150), default="")
    head_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    base_sha: Mapped[str] = mapped_column(String(40), default="")
    status: Mapped[str] = mapped_column(String(50), default="open")  # open, closed, merged
    html_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        UniqueConstraint("repo_id", "pr_number", name="uq_repo_pr_number"),
    )

    repository: Mapped["Repository"] = relationship("Repository", back_populates="pull_requests")
    reviews: Mapped[List["ReviewRun"]] = relationship(
        "ReviewRun", back_populates="pull_request", cascade="all, delete-orphan", order_by="desc(ReviewRun.id)"
    )
    benchmarks: Mapped[List["BenchmarkRun"]] = relationship(
        "BenchmarkRun", back_populates="pull_request", cascade="all, delete-orphan", order_by="desc(BenchmarkRun.id)"
    )
    posted_comments: Mapped[List["PostedComment"]] = relationship(
        "PostedComment", back_populates="pull_request", cascade="all, delete-orphan"
    )


class ReviewRun(Base):
    __tablename__ = "review_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pr_id: Mapped[int] = mapped_column(Integer, ForeignKey("pull_requests.id", ondelete="CASCADE"), index=True)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, in_progress, completed, failed
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    pull_request: Mapped["PullRequest"] = relationship("PullRequest", back_populates="reviews")
    findings: Mapped[List["Finding"]] = relationship(
        "Finding", back_populates="review_run", cascade="all, delete-orphan"
    )


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pr_id: Mapped[int] = mapped_column(Integer, ForeignKey("pull_requests.id", ondelete="CASCADE"), index=True)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="completed")  # pending, in_progress, completed, failed
    base_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    pr_latency_ms: Mapped[float] = mapped_column(Float, default=0.0)
    latency_change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    base_memory_mb: Mapped[float] = mapped_column(Float, default=0.0)
    pr_memory_mb: Mapped[float] = mapped_column(Float, default=0.0)
    memory_change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    cpu_usage_pct: Mapped[float] = mapped_column(Float, default=0.0)
    test_cases_count: Mapped[int] = mapped_column(Integer, default=0)
    regression_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    summary_verdict: Mapped[str] = mapped_column(String(100), default="pass")  # pass, warning, regression
    benchmark_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    pull_request: Mapped["PullRequest"] = relationship("PullRequest", back_populates="benchmarks")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    review_run_id: Mapped[int] = mapped_column(Integer, ForeignKey("review_runs.id", ondelete="CASCADE"), index=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    line_number: Mapped[int] = mapped_column(Integer, default=1)
    rule_id: Mapped[str] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)  # critical, high, medium, low
    category: Mapped[str] = mapped_column(String(50), default="general")  # security, bug_risk, performance, style
    message: Mapped[str] = mapped_column(Text, nullable=False)
    ai_suggestion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    review_run: Mapped["ReviewRun"] = relationship("ReviewRun", back_populates="findings")


class PostedComment(Base):
    """Tracks posted comments to prevent duplicate comments upon PR re-synchronize."""
    __tablename__ = "posted_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pr_id: Mapped[int] = mapped_column(Integer, ForeignKey("pull_requests.id", ondelete="CASCADE"), index=True)
    github_comment_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    line_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    commit_sha: Mapped[str] = mapped_column(String(40), nullable=False)
    body_hash: Mapped[str] = mapped_column(String(64), index=True)
    comment_type: Mapped[str] = mapped_column(String(20), default="inline")  # summary, inline
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_posted_comments_dedup", "pr_id", "body_hash"),
    )

    pull_request: Mapped["PullRequest"] = relationship("PullRequest", back_populates="posted_comments")
