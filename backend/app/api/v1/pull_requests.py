from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Repository, PullRequest, ReviewRun, Finding
from app.core.security import verify_api_token
from app.services.orchestrator import review_orchestrator

router = APIRouter(tags=["Pull Requests"])


class CreatePRPayload(BaseModel):
    pr_number: int
    title: str
    author: str
    head_sha: str
    base_sha: Optional[str] = "main"
    html_url: Optional[str] = None


@router.get("/repos/{repo_id}/pulls", dependencies=[Depends(verify_api_token)])
def list_pull_requests(repo_id: int, db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """List pull requests for a given repository."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    prs = db.query(PullRequest).filter(PullRequest.repo_id == repo_id).order_by(PullRequest.pr_number.desc()).all()
    results = []

    for pr in prs:
        latest_review = db.query(ReviewRun).filter(ReviewRun.pr_id == pr.id).order_by(ReviewRun.id.desc()).first()
        finding_count = 0
        critical_count = 0
        if latest_review:
            finding_count = db.query(Finding).filter(Finding.review_run_id == latest_review.id).count()
            critical_count = db.query(Finding).filter(
                Finding.review_run_id == latest_review.id,
                Finding.severity == "critical"
            ).count()

        results.append({
            "id": pr.id,
            "repo_id": pr.repo_id,
            "repo_name": repo.full_name,
            "pr_number": pr.pr_number,
            "title": pr.title,
            "author": pr.author,
            "head_sha": pr.head_sha,
            "base_sha": pr.base_sha,
            "status": pr.status,
            "html_url": pr.html_url,
            "created_at": pr.created_at.isoformat() if pr.created_at else None,
            "updated_at": pr.updated_at.isoformat() if pr.updated_at else None,
            "latest_review_status": latest_review.status if latest_review else "not_reviewed",
            "findings_count": finding_count,
            "critical_count": critical_count,
        })

    return results


@router.post("/repos/{repo_id}/pulls", dependencies=[Depends(verify_api_token)], status_code=status.HTTP_201_CREATED)
def create_pull_request(
    repo_id: int,
    payload: CreatePRPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Manually register a PR and trigger review (useful for local dev/testing)."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    pr = db.query(PullRequest).filter(
        PullRequest.repo_id == repo_id,
        PullRequest.pr_number == payload.pr_number
    ).first()

    if not pr:
        pr = PullRequest(
            repo_id=repo_id,
            pr_number=payload.pr_number,
            title=payload.title,
            author=payload.author,
            head_sha=payload.head_sha,
            base_sha=payload.base_sha or "main",
            html_url=payload.html_url,
        )
        db.add(pr)
    else:
        pr.title = payload.title
        pr.author = payload.author
        pr.head_sha = payload.head_sha
        pr.base_sha = payload.base_sha or pr.base_sha
        pr.html_url = payload.html_url

    db.commit()
    db.refresh(pr)

    background_tasks.add_task(review_orchestrator.process_pr_review, pr_id=pr.id)

    return {"message": "PR created and review scheduled", "pr_id": pr.id}


@router.get("/pulls/{pr_id}", dependencies=[Depends(verify_api_token)])
def get_pull_request(pr_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get full details of a PR including its latest review run and findings."""
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull request not found")

    repo = pr.repository
    reviews = db.query(ReviewRun).filter(ReviewRun.pr_id == pr.id).order_by(ReviewRun.id.desc()).all()
    latest_review = reviews[0] if reviews else None

    findings_list = []
    if latest_review:
        findings = db.query(Finding).filter(Finding.review_run_id == latest_review.id).order_by(Finding.id.asc()).all()
        for f in findings:
            findings_list.append({
                "id": f.id,
                "file_path": f.file_path,
                "line_number": f.line_number,
                "rule_id": f.rule_id,
                "severity": f.severity,
                "category": f.category,
                "message": f.message,
                "ai_suggestion": f.ai_suggestion,
            })

    return {
        "id": pr.id,
        "repo_id": pr.repo_id,
        "repo_name": repo.full_name,
        "pr_number": pr.pr_number,
        "title": pr.title,
        "author": pr.author,
        "head_sha": pr.head_sha,
        "base_sha": pr.base_sha,
        "status": pr.status,
        "html_url": pr.html_url,
        "created_at": pr.created_at.isoformat() if pr.created_at else None,
        "latest_review": {
            "id": latest_review.id,
            "commit_sha": latest_review.commit_sha,
            "status": latest_review.status,
            "ai_summary": latest_review.ai_summary,
            "error_message": latest_review.error_message,
            "started_at": latest_review.started_at.isoformat() if latest_review.started_at else None,
            "completed_at": latest_review.completed_at.isoformat() if latest_review.completed_at else None,
        } if latest_review else None,
        "findings": findings_list,
        "total_reviews": len(reviews),
    }


@router.post("/pulls/{pr_id}/re-review", dependencies=[Depends(verify_api_token)])
def trigger_re_review(
    pr_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Manually re-trigger a review for an existing PR."""
    pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull request not found")

    background_tasks.add_task(
        review_orchestrator.process_pr_review,
        pr_id=pr.id,
        commit_sha=pr.head_sha,
    )

    return {
        "status": "queued",
        "message": f"Re-review scheduled for PR #{pr.pr_number}",
        "pr_id": pr.id,
    }
