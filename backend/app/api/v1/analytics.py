from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.db.models import Repository, PullRequest, ReviewRun, Finding, User
from app.core.security import verify_api_token
from app.core.jwt import get_optional_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & Trends"])


def calculate_health_score(findings_by_severity: Dict[str, int], total_prs: int) -> Dict[str, Any]:
    """
    Calculate repository code health score on a 0-100 scale.
    Deductions are based on finding severity density per PR.
    """
    if total_prs == 0:
        return {
            "score": 100,
            "rating": "A+",
            "label": "Optimal",
            "critical_penalty": 0,
            "high_penalty": 0,
            "medium_penalty": 0,
            "low_penalty": 0,
        }

    critical = findings_by_severity.get("critical", 0)
    high = findings_by_severity.get("high", 0)
    medium = findings_by_severity.get("medium", 0)
    low = findings_by_severity.get("low", 0)

    # Calculate weighted penalties per PR
    crit_penalty = min(40.0, (critical / total_prs) * 20.0)
    high_penalty = min(30.0, (high / total_prs) * 10.0)
    med_penalty = min(20.0, (medium / total_prs) * 4.0)
    low_penalty = min(10.0, (low / total_prs) * 1.5)

    raw_score = 100.0 - (crit_penalty + high_penalty + med_penalty + low_penalty)
    final_score = max(10, min(100, int(round(raw_score))))

    if final_score >= 90:
        rating, label = "A+", "Optimal"
    elif final_score >= 80:
        rating, label = "A", "Good"
    elif final_score >= 70:
        rating, label = "B", "Fair"
    elif final_score >= 50:
        rating, label = "C", "Needs Attention"
    else:
        rating, label = "D", "Critical Risk"

    return {
        "score": final_score,
        "rating": rating,
        "label": label,
        "critical_penalty": round(crit_penalty, 1),
        "high_penalty": round(high_penalty, 1),
        "medium_penalty": round(med_penalty, 1),
        "low_penalty": round(low_penalty, 1),
    }


@router.get("/overview", dependencies=[Depends(verify_api_token)])
def get_global_analytics(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get overall analytics across all tracked repositories for the current user/platform."""
    repo_query = db.query(Repository)
    if current_user:
        repo_query = repo_query.filter(Repository.user_id == current_user.id)
    repos = repo_query.all()
    repo_ids = [r.id for r in repos]

    if not repo_ids:
        return {
            "total_repositories": 0,
            "total_prs_analyzed": 0,
            "total_findings": 0,
            "severity_breakdown": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "category_breakdown": {},
            "health_score": {"score": 100, "rating": "A+", "label": "Optimal"},
            "top_rules": [],
        }

    total_prs = db.query(PullRequest).filter(PullRequest.repo_id.in_(repo_ids)).count()

    # Get review runs for these PRs
    pr_ids = [pr.id for pr in db.query(PullRequest.id).filter(PullRequest.repo_id.in_(repo_ids)).all()]
    review_run_ids = [
        rr.id for rr in db.query(ReviewRun.id).filter(ReviewRun.pr_id.in_(pr_ids)).all()
    ] if pr_ids else []

    findings = db.query(Finding).filter(Finding.review_run_id.in_(review_run_ids)).all() if review_run_ids else []

    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    cat_counts: Dict[str, int] = {}
    rule_counts: Dict[str, int] = {}

    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1
        cat_counts[f.category] = cat_counts.get(f.category, 0) + 1
        rule_counts[f.rule_id] = rule_counts.get(f.rule_id, 0) + 1

    sorted_rules = sorted(
        [{"rule_id": k, "count": v} for k, v in rule_counts.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:5]

    health = calculate_health_score(sev_counts, total_prs=max(1, total_prs))

    return {
        "total_repositories": len(repos),
        "total_prs_analyzed": total_prs,
        "total_findings": len(findings),
        "severity_breakdown": sev_counts,
        "category_breakdown": cat_counts,
        "health_score": health,
        "top_rules": sorted_rules,
    }


@router.get("/repos/{repo_id}/trends", dependencies=[Depends(verify_api_token)])
def get_repository_trends(
    repo_id: int,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get time-series quality trends and health metrics for a specific repository."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    prs = db.query(PullRequest).filter(PullRequest.repo_id == repo_id).order_by(PullRequest.created_at.asc()).all()

    trend_points: List[Dict[str, Any]] = []
    total_sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    cat_counts: Dict[str, int] = {}

    for pr in prs:
        # Get latest review run for this PR
        latest_review = db.query(ReviewRun).filter(ReviewRun.pr_id == pr.id).order_by(ReviewRun.id.desc()).first()
        pr_findings = []
        if latest_review:
            pr_findings = db.query(Finding).filter(Finding.review_run_id == latest_review.id).all()

        pr_sev = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for f in pr_findings:
            pr_sev[f.severity] = pr_sev.get(f.severity, 0) + 1
            total_sev_counts[f.severity] = total_sev_counts.get(f.severity, 0) + 1
            cat_counts[f.category] = cat_counts.get(f.category, 0) + 1

        # Calculate PR-level mini health score
        pr_health = calculate_health_score(pr_sev, total_prs=1)["score"]

        trend_points.append({
            "pr_id": pr.id,
            "pr_number": pr.pr_number,
            "title": pr.title,
            "author": pr.author,
            "date": pr.created_at.strftime("%Y-%m-%d") if pr.created_at else "N/A",
            "timestamp": pr.created_at.isoformat() if pr.created_at else None,
            "status": pr.status,
            "findings_count": len(pr_findings),
            "critical": pr_sev["critical"],
            "high": pr_sev["high"],
            "medium": pr_sev["medium"],
            "low": pr_sev["low"],
            "health_score": pr_health,
        })

    overall_health = calculate_health_score(total_sev_counts, total_prs=max(1, len(prs)))

    return {
        "repo_id": repo.id,
        "repo_name": repo.full_name,
        "total_prs": len(prs),
        "total_findings": sum(total_sev_counts.values()),
        "health_score": overall_health,
        "severity_totals": total_sev_counts,
        "category_totals": cat_counts,
        "trends": trend_points,
    }
