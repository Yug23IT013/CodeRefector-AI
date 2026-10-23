import json
import logging
from typing import Any
from contextlib import contextmanager
from app.db.session import SessionLocal
from app.db.models import Repository, PullRequest, ReviewRun, Finding, BenchmarkRun
from app.services.rag.knowledge_base import RULE_KNOWLEDGE_BASE

logger = logging.getLogger("coderefactor.mcp.resources")


@contextmanager
def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def register_resources(server: Any) -> None:
    """Registers CodeRefactor URI resources on the MCPServer instance."""

    @server.resource("coderefactor://rules")
    def get_all_rules() -> str:
        """Returns the complete catalog of static analysis rules and standards."""
        return json.dumps(
            {
                "rules_count": len(RULE_KNOWLEDGE_BASE),
                "rules": RULE_KNOWLEDGE_BASE,
            },
            indent=2,
        )

    @server.resource("coderefactor://rules/{rule_id}")
    def get_rule_detail(rule_id: str) -> str:
        """Returns detailed specification and remediation guidance for a specific rule."""
        target = rule_id.strip().upper()
        for doc in RULE_KNOWLEDGE_BASE:
            if doc.get("rule_id", "").upper() == target:
                return json.dumps(doc, indent=2)
        return json.dumps(
            {
                "error": f"Rule '{rule_id}' not found.",
                "available_rules": [r["rule_id"] for r in RULE_KNOWLEDGE_BASE],
            },
            indent=2,
        )

    @server.resource("coderefactor://repos")
    def get_repositories_list() -> str:
        """Returns all tracked repositories in CodeRefactor AI."""
        with get_session() as db:
            repos = db.query(Repository).all()
            result = [
                {
                    "id": r.id,
                    "full_name": r.full_name,
                    "default_branch": r.default_branch,
                    "auto_merge_default": r.auto_merge_default,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in repos
            ]
            return json.dumps({"repositories": result}, indent=2)

    @server.resource("coderefactor://repos/{repo_id}/summary")
    def get_repo_summary(repo_id: str) -> str:
        """Returns health summary and recent PR statuses for a tracked repository."""
        try:
            r_id = int(repo_id)
        except ValueError:
            return json.dumps({"error": f"Invalid repo_id: {repo_id}"}, indent=2)

        with get_session() as db:
            repo = db.query(Repository).filter(Repository.id == r_id).first()
            if not repo:
                return json.dumps({"error": f"Repository with ID {r_id} not found."}, indent=2)

            prs = db.query(PullRequest).filter(PullRequest.repo_id == repo.id).all()
            pr_data = [
                {
                    "id": p.id,
                    "pr_number": p.pr_number,
                    "title": p.title,
                    "author": p.author,
                    "status": p.status,
                }
                for p in prs
            ]

            return json.dumps(
                {
                    "repo_id": repo.id,
                    "full_name": repo.full_name,
                    "default_branch": repo.default_branch,
                    "total_prs": len(prs),
                    "pull_requests": pr_data,
                },
                indent=2,
            )

    @server.resource("coderefactor://prs/{pr_id}")
    def get_pr_detail(pr_id: str) -> str:
        """Returns review findings and benchmark summary for a pull request."""
        try:
            p_id = int(pr_id)
        except ValueError:
            return json.dumps({"error": f"Invalid pr_id: {pr_id}"}, indent=2)

        with get_session() as db:
            pr = db.query(PullRequest).filter(PullRequest.id == p_id).first()
            if not pr:
                return json.dumps({"error": f"Pull request {p_id} not found."}, indent=2)

            latest_review = (
                db.query(ReviewRun)
                .filter(ReviewRun.pr_id == pr.id)
                .order_by(ReviewRun.id.desc())
                .first()
            )

            latest_bench = (
                db.query(BenchmarkRun)
                .filter(BenchmarkRun.pr_id == pr.id)
                .order_by(BenchmarkRun.id.desc())
                .first()
            )

            findings_data = []
            if latest_review:
                findings = (
                    db.query(Finding)
                    .filter(Finding.review_run_id == latest_review.id)
                    .all()
                )
                findings_data = [
                    {
                        "file_path": f.file_path,
                        "line_number": f.line_number,
                        "rule_id": f.rule_id,
                        "severity": f.severity,
                        "message": f.message,
                        "ai_suggestion": f.ai_suggestion,
                    }
                    for f in findings
                ]

            return json.dumps(
                {
                    "pr_id": pr.id,
                    "pr_number": pr.pr_number,
                    "title": pr.title,
                    "author": pr.author,
                    "status": pr.status,
                    "ai_summary": latest_review.ai_summary if latest_review else None,
                    "findings": findings_data,
                    "benchmark": {
                        "verdict": latest_bench.summary_verdict if latest_bench else "none",
                        "latency_change_pct": latest_bench.latency_change_pct if latest_bench else 0.0,
                        "memory_change_pct": latest_bench.memory_change_pct if latest_bench else 0.0,
                    } if latest_bench else None,
                },
                indent=2,
            )
