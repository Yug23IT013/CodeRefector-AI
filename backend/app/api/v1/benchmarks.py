from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Repository, PullRequest, BenchmarkRun, User
from app.core.security import verify_api_token
from app.core.jwt import get_optional_current_user
from app.services.benchmark_service import benchmark_service

router = APIRouter(tags=["Benchmarks & Performance"])


def generate_benchmark_suite(pr_number: int, commit_sha: str) -> Dict[str, Any]:
    """
    Executes real measured benchmark suites comparing execution throughput and memory.
    """
    return benchmark_service.measure_pr_benchmark_suite(pr_number, commit_sha)



@router.get("/pulls/{pr_id}/benchmarks", dependencies=[Depends(verify_api_token)])
def get_pr_benchmarks(pr_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve benchmark runs and performance comparison metrics for a pull request."""
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull Request not found")

    benchmark = db.query(BenchmarkRun).filter(BenchmarkRun.pr_id == pr_id).order_by(BenchmarkRun.id.desc()).first()

    # If no benchmark run exists yet, automatically create an initial one
    if not benchmark:
        data = generate_benchmark_suite(pr.pr_number, pr.head_sha)
        benchmark = BenchmarkRun(
            pr_id=pr.id,
            commit_sha=pr.head_sha,
            status="completed",
            base_latency_ms=data["base_latency_ms"],
            pr_latency_ms=data["pr_latency_ms"],
            latency_change_pct=data["latency_change_pct"],
            base_memory_mb=data["base_memory_mb"],
            pr_memory_mb=data["pr_memory_mb"],
            memory_change_pct=data["memory_change_pct"],
            cpu_usage_pct=data["cpu_usage_pct"],
            test_cases_count=data["test_cases_count"],
            regression_detected=data["regression_detected"],
            summary_verdict=data["summary_verdict"],
            benchmark_details={"suites": data["suite_details"]},
            created_at=datetime.now(timezone.utc),
        )
        db.add(benchmark)
        db.commit()
        db.refresh(benchmark)

    return {
        "id": benchmark.id,
        "pr_id": benchmark.pr_id,
        "commit_sha": benchmark.commit_sha,
        "status": benchmark.status,
        "base_latency_ms": benchmark.base_latency_ms,
        "pr_latency_ms": benchmark.pr_latency_ms,
        "latency_change_pct": benchmark.latency_change_pct,
        "base_memory_mb": benchmark.base_memory_mb,
        "pr_memory_mb": benchmark.pr_memory_mb,
        "memory_change_pct": benchmark.memory_change_pct,
        "cpu_usage_pct": benchmark.cpu_usage_pct,
        "test_cases_count": benchmark.test_cases_count,
        "regression_detected": benchmark.regression_detected,
        "summary_verdict": benchmark.summary_verdict,
        "suites": benchmark.benchmark_details.get("suites", []) if benchmark.benchmark_details else [],
        "created_at": benchmark.created_at.isoformat() if benchmark.created_at else None,
    }


@router.post("/pulls/{pr_id}/benchmarks/run", dependencies=[Depends(verify_api_token)])
def run_pr_benchmark(pr_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Trigger a sandboxed benchmark run measuring execution latency and memory usage."""
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull Request not found")

    data = generate_benchmark_suite(pr.pr_number, pr.head_sha)
    benchmark = BenchmarkRun(
        pr_id=pr.id,
        commit_sha=pr.head_sha,
        status="completed",
        base_latency_ms=data["base_latency_ms"],
        pr_latency_ms=data["pr_latency_ms"],
        latency_change_pct=data["latency_change_pct"],
        base_memory_mb=data["base_memory_mb"],
        pr_memory_mb=data["pr_memory_mb"],
        memory_change_pct=data["memory_change_pct"],
        cpu_usage_pct=data["cpu_usage_pct"],
        test_cases_count=data["test_cases_count"],
        regression_detected=data["regression_detected"],
        summary_verdict=data["summary_verdict"],
        benchmark_details={"suites": data["suite_details"]},
        created_at=datetime.now(timezone.utc),
    )
    db.add(benchmark)
    db.commit()
    db.refresh(benchmark)

    return {
        "message": "Benchmark execution completed successfully",
        "benchmark_id": benchmark.id,
        "status": benchmark.status,
        "pr_latency_ms": benchmark.pr_latency_ms,
        "base_latency_ms": benchmark.base_latency_ms,
        "latency_change_pct": benchmark.latency_change_pct,
        "pr_memory_mb": benchmark.pr_memory_mb,
        "base_memory_mb": benchmark.base_memory_mb,
        "memory_change_pct": benchmark.memory_change_pct,
        "regression_detected": benchmark.regression_detected,
        "summary_verdict": benchmark.summary_verdict,
        "suites": data["suite_details"],
        "created_at": benchmark.created_at.isoformat() if benchmark.created_at else None,
    }


@router.get("/repos/{repo_id}/benchmarks/trends", dependencies=[Depends(verify_api_token)])
def get_repository_benchmark_trends(repo_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Retrieve historical benchmark latency and memory trajectory across pull requests in a repository."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    prs = db.query(PullRequest).filter(PullRequest.repo_id == repo_id).order_by(PullRequest.created_at.asc()).all()

    points = []
    for pr in prs:
        bm = db.query(BenchmarkRun).filter(BenchmarkRun.pr_id == pr.id).order_by(BenchmarkRun.id.desc()).first()
        if bm:
            points.append({
                "pr_id": pr.id,
                "pr_number": pr.pr_number,
                "title": pr.title,
                "base_latency_ms": bm.base_latency_ms,
                "pr_latency_ms": bm.pr_latency_ms,
                "latency_change_pct": bm.latency_change_pct,
                "base_memory_mb": bm.base_memory_mb,
                "pr_memory_mb": bm.pr_memory_mb,
                "memory_change_pct": bm.memory_change_pct,
                "verdict": bm.summary_verdict,
                "date": bm.created_at.strftime("%Y-%m-%d") if bm.created_at else "N/A",
            })

    return {
        "repo_id": repo.id,
        "repo_name": repo.full_name,
        "total_benchmarked_prs": len(points),
        "benchmark_trends": points,
    }
