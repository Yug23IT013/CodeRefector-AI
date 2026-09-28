import json
import logging
from typing import Any, Dict
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request, Response, status, Depends
from sqlalchemy.orm import Session
from app.core.security import verify_github_signature
from app.db.session import get_db
from app.db.models import Repository, PullRequest
from app.services.orchestrator import review_orchestrator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/github", status_code=status.HTTP_202_ACCEPTED)
async def github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: str = Header(..., alias="X-GitHub-Event"),
    x_hub_signature_256: str = Header(None, alias="X-Hub-Signature-256"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Intake endpoint for GitHub Webhook events.
    Verifies HMAC-SHA256 signature, extracts PR metadata, persists to DB,
    and enqueues static + AI analysis in the background.
    """
    raw_body = await request.body()

    # 1. Verify webhook signature
    is_valid = verify_github_signature(payload_body=raw_body, signature_header=x_hub_signature_256)
    if not is_valid:
        logger.warning("Rejected webhook request due to invalid HMAC signature.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Hub-Signature-256 header",
        )

    # 2. Parse JSON body
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Malformed JSON payload: {e}",
        )

    # Handle ping event
    if x_github_event == "ping":
        return {"message": "Webhook ping received successfully!", "zen": payload.get("zen")}

    # Only process pull_request events
    if x_github_event != "pull_request":
        return {"message": f"Event '{x_github_event}' ignored. Only 'pull_request' events are analyzed."}

    action = payload.get("action")
    if action not in ("opened", "synchronize", "reopened"):
        return {"message": f"PR action '{action}' ignored. Only 'opened', 'synchronize', and 'reopened' trigger reviews."}

    pr_data = payload.get("pull_request", {})
    repo_data = payload.get("repository", {})

    repo_full_name = repo_data.get("full_name")
    github_repo_id = repo_data.get("id")
    if not repo_full_name:
        raise HTTPException(status_code=400, detail="Missing repository.full_name in payload")

    # 3. Upsert Repository record
    repo = db.query(Repository).filter(Repository.full_name == repo_full_name).first()
    if not repo:
        repo = Repository(
            github_repo_id=github_repo_id,
            full_name=repo_full_name,
            default_branch=repo_data.get("default_branch", "main"),
        )
        db.add(repo)
        db.commit()
        db.refresh(repo)

    # 4. Upsert PullRequest record
    pr_number = pr_data.get("number")
    title = pr_data.get("title", "")
    author = pr_data.get("user", {}).get("login", "")
    head_sha = pr_data.get("head", {}).get("sha", "")
    base_sha = pr_data.get("base", {}).get("sha", "")
    pr_status = "open" if pr_data.get("state") == "open" else pr_data.get("state", "closed")
    html_url = pr_data.get("html_url", "")

    pr = db.query(PullRequest).filter(
        PullRequest.repo_id == repo.id,
        PullRequest.pr_number == pr_number
    ).first()

    if not pr:
        pr = PullRequest(
            repo_id=repo.id,
            pr_number=pr_number,
            title=title,
            author=author,
            head_sha=head_sha,
            base_sha=base_sha,
            status=pr_status,
            html_url=html_url,
        )
        db.add(pr)
    else:
        pr.title = title
        pr.author = author
        pr.head_sha = head_sha
        pr.base_sha = base_sha
        pr.status = pr_status
        pr.html_url = html_url

    db.commit()
    db.refresh(pr)

    # 5. Enqueue background review run
    background_tasks.add_task(
        review_orchestrator.process_pr_review,
        pr_id=pr.id,
        commit_sha=head_sha,
    )

    logger.info(f"Enqueued background review for PR #{pr.pr_number} on {repo.full_name}")

    return {
        "status": "queued",
        "message": f"Review scheduled for PR #{pr_number} ({action})",
        "pr_id": pr.id,
        "repo": repo.full_name,
        "commit_sha": head_sha,
    }
