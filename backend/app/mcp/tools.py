import logging
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from contextlib import contextmanager
from app.db.session import SessionLocal
from app.db.models import Repository, PullRequest, ReviewRun, Finding, BenchmarkRun
from app.services.analyzer.registry import analyzer_registry
from app.services.rag.retriever import rag_retriever
from app.services.rag.knowledge_base import RULE_KNOWLEDGE_BASE
from app.services.ai import get_ai_service
from app.services.analyzer.base import FindingResult

logger = logging.getLogger("coderefactor.mcp.tools")


@contextmanager
def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def register_tools(server: Any) -> None:
    """Registers all CodeRefactor tools on the given MCPServer instance."""

    @server.tool(
        name="analyze_code_snippet",
        description="Run CodeRefactor's AST static analysis (Python and JavaScript/TypeScript) on source code. Flags security vulnerabilities (eval, secrets, SQL injection, insecure deserialization) and bug patterns."
    )
    def analyze_code_snippet(file_path: str, code: str) -> List[Dict[str, Any]]:
        findings = analyzer_registry.analyze_file(file_path, code)
        return [
            {
                "file_path": f.file_path,
                "line_number": f.line_number,
                "rule_id": f.rule_id,
                "severity": f.severity,
                "category": f.category,
                "message": f.message,
                "code_snippet": f.code_snippet,
            }
            for f in findings
        ]

    @server.tool(
        name="query_rag_knowledge",
        description="Query CodeRefactor's RAG knowledge base for authoritative rule standards, security guidelines, and historical PR resolution precedents."
    )
    def query_rag_knowledge(
        query: str,
        top_k: int = 3,
        collection: str = "all",
        repo_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        return rag_retriever.semantic_search(
            query=query,
            n_results=top_k,
            collection_type=collection,
            repo_id=repo_id,
        )

    @server.tool(
        name="explain_rule",
        description="Get in-depth explanation, vulnerability impact, code examples (bad vs good), and fix instructions for any CodeRefactor rule (e.g. SEC001, SEC002, SEC003, BUG001, BUG002, PERF001)."
    )
    def explain_rule(rule_id: str) -> Dict[str, Any]:
        target_id = rule_id.strip().upper()
        for doc in RULE_KNOWLEDGE_BASE:
            if doc.get("rule_id", "").upper() == target_id:
                return {
                    "found": True,
                    "rule_id": doc.get("rule_id"),
                    "title": doc.get("title"),
                    "category": doc.get("category"),
                    "severity": doc.get("severity"),
                    "description": doc.get("description"),
                    "remediation": doc.get("remediation"),
                    "example_bad": doc.get("example_bad"),
                    "example_good": doc.get("example_good"),
                }
        return {
            "found": False,
            "rule_id": rule_id,
            "message": f"Rule '{rule_id}' not found in knowledge base. Available rules include SEC001-SEC004, BUG001-BUG004, PERF001-PERF002."
        }

    @server.tool(
        name="get_repo_health",
        description="Get health score (0-100), active open findings count by severity (critical, high, medium, low), and PR statistics for a tracked repository."
    )
    def get_repo_health(
        repo_id: Optional[int] = None,
        repo_name: Optional[str] = None
    ) -> Dict[str, Any]:
        with get_session() as db:
            query = db.query(Repository)
            if repo_id:
                repo = query.filter(Repository.id == repo_id).first()
            elif repo_name:
                repo = query.filter(Repository.full_name == repo_name).first()
            else:
                repo = query.first()

            if not repo:
                all_repos = [r.full_name for r in db.query(Repository).all()]
                return {
                    "error": "Repository not found",
                    "available_repositories": all_repos
                }

            prs = db.query(PullRequest).filter(PullRequest.repo_id == repo.id).all()
            pr_ids = [p.id for p in prs]
            total_prs = len(prs)

            findings_by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
            if pr_ids:
                counts = (
                    db.query(Finding.severity, func.count(Finding.id))
                    .join(ReviewRun, Finding.review_run_id == ReviewRun.id)
                    .filter(ReviewRun.pr_id.in_(pr_ids))
                    .group_by(Finding.severity)
                    .all()
                )
                for sev, cnt in counts:
                    if sev in findings_by_severity:
                        findings_by_severity[sev] = cnt

            # Health score calculation
            if total_prs == 0:
                health_score = 100
                rating = "A+"
            else:
                crit = findings_by_severity.get("critical", 0)
                high = findings_by_severity.get("high", 0)
                med = findings_by_severity.get("medium", 0)
                low = findings_by_severity.get("low", 0)
                crit_penalty = min(40.0, (crit / total_prs) * 20.0)
                high_penalty = min(30.0, (high / total_prs) * 10.0)
                med_penalty = min(20.0, (med / total_prs) * 4.0)
                low_penalty = min(10.0, (low / total_prs) * 1.5)
                raw_score = 100.0 - (crit_penalty + high_penalty + med_penalty + low_penalty)
                health_score = max(10, min(100, int(round(raw_score))))
                if health_score >= 90:
                    rating = "A+"
                elif health_score >= 80:
                    rating = "A"
                elif health_score >= 70:
                    rating = "B"
                elif health_score >= 50:
                    rating = "C"
                else:
                    rating = "D"

            return {
                "repo_id": repo.id,
                "repo_name": repo.full_name,
                "default_branch": repo.default_branch,
                "total_prs": total_prs,
                "health_score": health_score,
                "rating": rating,
                "open_findings_by_severity": findings_by_severity,
            }

    @server.tool(
        name="get_pr_findings",
        description="Retrieve review summary, risk rating, benchmark verdict, and static analysis findings with line-level suggestions for a Pull Request."
    )
    def get_pr_findings(pr_id: int) -> Dict[str, Any]:
        with get_session() as db:
            pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
            if not pr:
                return {"error": f"Pull Request ID {pr_id} not found."}

            latest_review = (
                db.query(ReviewRun)
                .filter(ReviewRun.pr_id == pr.id)
                .order_by(ReviewRun.id.desc())
                .first()
            )

            latest_benchmark = (
                db.query(BenchmarkRun)
                .filter(BenchmarkRun.pr_id == pr.id)
                .order_by(BenchmarkRun.id.desc())
                .first()
            )

            findings_list = []
            if latest_review:
                findings = (
                    db.query(Finding)
                    .filter(Finding.review_run_id == latest_review.id)
                    .all()
                )
                for f in findings:
                    findings_list.append({
                        "file_path": f.file_path,
                        "line_number": f.line_number,
                        "rule_id": f.rule_id,
                        "severity": f.severity,
                        "category": f.category,
                        "message": f.message,
                        "ai_suggestion": f.ai_suggestion,
                    })

            return {
                "pr_id": pr.id,
                "pr_number": pr.pr_number,
                "title": pr.title,
                "author": pr.author,
                "status": pr.status,
                "review_status": latest_review.status if latest_review else "no_review",
                "ai_summary": latest_review.ai_summary if latest_review else None,
                "findings_count": len(findings_list),
                "findings": findings_list,
                "benchmark_verdict": latest_benchmark.summary_verdict if latest_benchmark else "unknown",
                "latency_change_pct": latest_benchmark.latency_change_pct if latest_benchmark else 0.0,
            }

    @server.tool(
        name="run_review_on_diff",
        description="Run an AI code review on an arbitrary git diff using static analysis and RAG knowledge. Returns executive summary, risk level, and inline fix suggestions."
    )
    def run_review_on_diff(
        diff: str,
        pr_title: str = "Diff Review",
        pr_author: str = "developer"
    ) -> Dict[str, Any]:
        # Extract files and code chunks from diff
        findings: List[FindingResult] = []
        current_file = None
        current_lines = []

        for line in diff.splitlines():
            if line.startswith("+++ b/"):
                if current_file and current_lines:
                    file_content = "\n".join(current_lines)
                    findings.extend(analyzer_registry.analyze_file(current_file, file_content))
                current_file = line[6:].strip()
                current_lines = []
            elif line.startswith("+") and not line.startswith("+++"):
                current_lines.append(line[1:])
            elif not line.startswith("-"):
                current_lines.append(line)

        if current_file and current_lines:
            file_content = "\n".join(current_lines)
            findings.extend(analyzer_registry.analyze_file(current_file, file_content))

        # Retrieve grounded RAG context
        rag_context = rag_retriever.retrieve_context_for_findings(findings)

        # Execute AI review
        ai_service = get_ai_service()
        response = ai_service.generate_review(
            pr_title=pr_title,
            pr_author=pr_author,
            diff=diff,
            static_findings=findings,
            rag_context=rag_context,
        )

        return {
            "summary": response.summary,
            "risk_level": response.risk_level,
            "static_findings_detected": len(findings),
            "inline_suggestions": [
                {
                    "file_path": s.file_path,
                    "line_number": s.line_number,
                    "rule_id": s.rule_id,
                    "explanation": s.explanation,
                    "suggested_code": s.suggested_code,
                }
                for s in response.inline_suggestions
            ],
        }

    @server.tool(
        name="get_benchmark_metrics",
        description="Get runtime latency (ms), peak memory (MB), and performance regression verdict for a Pull Request."
    )
    def get_benchmark_metrics(pr_id: int) -> Dict[str, Any]:
        with SessionLocal() as db:
            bench = (
                db.query(BenchmarkRun)
                .filter(BenchmarkRun.pr_id == pr_id)
                .order_by(BenchmarkRun.id.desc())
                .first()
            )
            if not bench:
                return {"error": f"No benchmark run found for PR ID {pr_id}."}

            return {
                "pr_id": pr_id,
                "status": bench.status,
                "base_latency_ms": bench.base_latency_ms,
                "pr_latency_ms": bench.pr_latency_ms,
                "latency_change_pct": bench.latency_change_pct,
                "base_memory_mb": bench.base_memory_mb,
                "pr_memory_mb": bench.pr_memory_mb,
                "memory_change_pct": bench.memory_change_pct,
                "cpu_usage_pct": bench.cpu_usage_pct,
                "test_cases_count": bench.test_cases_count,
                "regression_detected": bench.regression_detected,
                "summary_verdict": bench.summary_verdict,
            }
