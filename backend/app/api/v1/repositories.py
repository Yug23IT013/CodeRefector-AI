from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.db.session import get_db
from app.db.models import Repository, PullRequest, ReviewRun, Finding, User
from app.core.security import verify_api_token
from app.core.jwt import get_optional_current_user, get_current_user

router = APIRouter(prefix="/repos", tags=["Repositories"])


@router.get("", dependencies=[Depends(verify_api_token)])
def list_repositories(
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """List tracked repositories. If user is authenticated, only returns repositories tracked by that user."""
    query = db.query(Repository)
    if current_user:
        # Show repositories tracked by this user
        query = query.filter(Repository.user_id == current_user.id)

    repos = query.order_by(Repository.full_name.asc()).all()
    results = []

    for r in repos:
        total_prs = db.query(func.count(PullRequest.id)).filter(PullRequest.repo_id == r.id).scalar() or 0
        open_prs = db.query(func.count(PullRequest.id)).filter(
            PullRequest.repo_id == r.id, PullRequest.status == "open"
        ).scalar() or 0

        # Find latest review status
        latest_pr = db.query(PullRequest).filter(PullRequest.repo_id == r.id).order_by(PullRequest.updated_at.desc()).first()

        results.append({
            "id": r.id,
            "github_repo_id": r.github_repo_id,
            "full_name": r.full_name,
            "default_branch": r.default_branch,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "total_prs": total_prs,
            "open_prs": open_prs,
            "latest_pr_number": latest_pr.pr_number if latest_pr else None,
            "latest_activity": latest_pr.updated_at.isoformat() if (latest_pr and latest_pr.updated_at) else None,
        })

    return results


@router.get("/{repo_id}", dependencies=[Depends(verify_api_token)])
def get_repository(repo_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get repository details by ID."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    total_prs = db.query(func.count(PullRequest.id)).filter(PullRequest.repo_id == repo.id).scalar() or 0
    return {
        "id": repo.id,
        "github_repo_id": repo.github_repo_id,
        "full_name": repo.full_name,
        "default_branch": repo.default_branch,
        "created_at": repo.created_at.isoformat() if repo.created_at else None,
        "total_prs": total_prs,
    }


@router.delete("/{repo_id}", dependencies=[Depends(verify_api_token)])
def delete_repository(
    repo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Untrack/delete a repository from tracking."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # If repo has owner, only owner can delete
    if repo.user_id and repo.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this repository")

    name = repo.full_name
    db.delete(repo)
    db.commit()

    return {"message": f"Repository '{name}' removed from tracking", "deleted_id": repo_id}


@router.get("/{repo_id}/stats", dependencies=[Depends(verify_api_token)])
def get_repository_stats(repo_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get finding counts by severity and category for this repository (based on latest review run per PR)."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    prs = db.query(PullRequest).filter(PullRequest.repo_id == repo_id).all()
    latest_review_ids = []
    for pr in prs:
        latest_review = (
            db.query(ReviewRun.id)
            .filter(ReviewRun.pr_id == pr.id)
            .order_by(ReviewRun.id.desc())
            .first()
        )
        if latest_review:
            latest_review_ids.append(latest_review[0])

    severities = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    category_map = {}

    if latest_review_ids:
        severity_counts = (
            db.query(Finding.severity, func.count(Finding.id))
            .filter(Finding.review_run_id.in_(latest_review_ids))
            .group_by(Finding.severity)
            .all()
        )
        for sev, count in severity_counts:
            if sev in severities:
                severities[sev] = count

        categories = (
            db.query(Finding.category, func.count(Finding.id))
            .filter(Finding.review_run_id.in_(latest_review_ids))
            .group_by(Finding.category)
            .all()
        )
        category_map = {cat: count for cat, count in categories}

    total_findings = sum(severities.values())

    return {
        "repo_id": repo.id,
        "repo_name": repo.full_name,
        "total_findings": total_findings,
        "by_severity": severities,
        "by_category": category_map,
    }


@router.post("/{repo_id}/sync", dependencies=[Depends(verify_api_token)])
def sync_repository_prs(repo_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Fetch open pull requests from GitHub and trigger reviews for any unreviewed or updated PRs."""
    import os
    import httpx
    from app.services.orchestrator import ReviewOrchestrator

    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    token = os.getenv("GITHUB_TOKEN")
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodeRefactor-AI-Reviewer"
    }
    if token and not token.startswith("your_"):
        headers["Authorization"] = f"Bearer {token}"

    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(f"https://api.github.com/repos/{repo.full_name}/pulls?state=open", headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=resp.status_code, detail=f"GitHub API error: {resp.text}")
            prs_data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch PRs from GitHub: {str(e)}")

    synced_count = 0
    orchestrator = ReviewOrchestrator()

    for p in prs_data:
        pr_number = p.get("number")
        head_sha = p.get("head", {}).get("sha", "")
        base_sha = p.get("base", {}).get("sha", "")

        pr_record = db.query(PullRequest).filter(
            PullRequest.repo_id == repo.id,
            PullRequest.pr_number == pr_number
        ).first()

        needs_review = False
        if not pr_record:
            pr_record = PullRequest(
                repo_id=repo.id,
                pr_number=pr_number,
                title=p.get("title", ""),
                author=p.get("user", {}).get("login", ""),
                head_sha=head_sha,
                base_sha=base_sha,
                status=p.get("state", "open"),
                html_url=p.get("html_url", "")
            )
            db.add(pr_record)
            db.commit()
            db.refresh(pr_record)
            needs_review = True
        else:
            if pr_record.head_sha != head_sha:
                pr_record.head_sha = head_sha
                needs_review = True
            pr_record.title = p.get("title", "")
            pr_record.status = p.get("state", "open")
            pr_record.html_url = p.get("html_url", "")
            db.commit()

        # Check if there's any completed review run for this head_sha
        existing_run = db.query(ReviewRun).filter(
            ReviewRun.pr_id == pr_record.id,
            ReviewRun.commit_sha == head_sha,
            ReviewRun.status == "completed"
        ).first()

        if needs_review or not existing_run:
            try:
                orchestrator.process_pr_review(pr_id=pr_record.id, commit_sha=head_sha)
                synced_count += 1
            except Exception as ex:
                pass

    return {"message": f"Successfully synced and reviewed {synced_count} PR(s)", "synced": synced_count}

