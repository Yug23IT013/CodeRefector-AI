from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Finding, ReviewRun, PullRequest
from app.core.security import verify_api_token

router = APIRouter(prefix="/findings", tags=["Findings"])


@router.get("", dependencies=[Depends(verify_api_token)])
def list_findings(
    repo_id: Optional[int] = Query(None, description="Filter by repository ID"),
    pr_id: Optional[int] = Query(None, description="Filter by pull request ID"),
    severity: Optional[str] = Query(None, description="Filter by severity (critical, high, medium, low)"),
    category: Optional[str] = Query(None, description="Filter by category (security, bug_risk, performance, style)"),
    rule_id: Optional[str] = Query(None, description="Filter by rule ID"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Query findings with filters across reviews."""
    query = db.query(Finding).join(ReviewRun, Finding.review_run_id == ReviewRun.id).join(PullRequest, ReviewRun.pr_id == PullRequest.id)

    if repo_id is not None:
        query = query.filter(PullRequest.repo_id == repo_id)
    if pr_id is not None:
        query = query.filter(PullRequest.id == pr_id)
    if severity:
        query = query.filter(Finding.severity == severity.lower())
    if category:
        query = query.filter(Finding.category == category.lower())
    if rule_id:
        query = query.filter(Finding.rule_id == rule_id.upper())

    findings = query.order_by(Finding.id.desc()).offset(offset).limit(limit).all()

    return [
        {
            "id": f.id,
            "review_run_id": f.review_run_id,
            "file_path": f.file_path,
            "line_number": f.line_number,
            "rule_id": f.rule_id,
            "severity": f.severity,
            "category": f.category,
            "message": f.message,
            "ai_suggestion": f.ai_suggestion,
        }
        for f in findings
    ]
