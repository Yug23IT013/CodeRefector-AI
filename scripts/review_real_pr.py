"""
Directly trigger a CodeRefactor AI review on a real GitHub Pull Request
WITHOUT needing Smee, ngrok, or incoming webhooks.
"""

import os
import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / ".env")

import httpx
from app.db.session import SessionLocal
from app.db.models import Repository, PullRequest
from app.services.orchestrator import ReviewOrchestrator


def review_pr(repo_name: str, pr_number: int):
    token = os.getenv("GITHUB_TOKEN")
    if not token or token.startswith("your_"):
        print("[ERROR] Please set GITHUB_TOKEN in backend/.env with your GitHub Personal Access Token.")
        return

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "CodeRefactor-AI-Reviewer"
    }

    print(f"\n=======================================================")
    print(f"  Fetching PR #{pr_number} from GitHub: {repo_name}")
    print(f"=======================================================")

    with httpx.Client() as client:
        res = client.get(f"https://api.github.com/repos/{repo_name}/pulls/{pr_number}", headers=headers)
        if res.status_code != 200:
            print(f"[ERROR] Could not fetch PR #{pr_number} from GitHub. HTTP {res.status_code}: {res.text}")
            return
        
        pr_data = res.json()

    print(f"[INFO] Found PR #{pr_number}: '{pr_data.get('title')}' by @{pr_data.get('user', {}).get('login')}")
    print(f"[INFO] Head SHA: {pr_data.get('head', {}).get('sha')}")

    db = SessionLocal()
    try:
        repo = db.query(Repository).filter(Repository.full_name == repo_name).first()
        if not repo:
            print(f"[INFO] Adding {repo_name} to local database...")
            repo = Repository(
                github_repo_id=pr_data["base"]["repo"]["id"],
                full_name=repo_name,
                default_branch=pr_data["base"]["repo"].get("default_branch", "main"),
                user_id=1
            )
            db.add(repo)
            db.commit()
            db.refresh(repo)

        # Ensure PR record exists
        pr_record = db.query(PullRequest).filter(
            PullRequest.repo_id == repo.id,
            PullRequest.pr_number == pr_number
        ).first()

        if not pr_record:
            print(f"[INFO] Creating PR record in database...")
            pr_record = PullRequest(
                repo_id=repo.id,
                pr_number=pr_number,
                title=pr_data.get("title", ""),
                author=pr_data.get("user", {}).get("login", ""),
                head_sha=pr_data.get("head", {}).get("sha", ""),
                base_sha=pr_data.get("base", {}).get("sha", ""),
                status=pr_data.get("state", "open"),
                html_url=pr_data.get("html_url", "")
            )
            db.add(pr_record)
            db.commit()
            db.refresh(pr_record)
        else:
            # Update head sha and title if changed
            pr_record.head_sha = pr_data.get("head", {}).get("sha", "")
            pr_record.title = pr_data.get("title", "")
            pr_record.status = pr_data.get("state", "open")
            pr_record.html_url = pr_data.get("html_url", "")
            db.commit()

        # Run the full orchestrator review!
        orchestrator = ReviewOrchestrator()
        print(f"\n[INFO] Running AST Static Analysis + AI Review...")
        
        run_id = orchestrator.process_pr_review(
            pr_id=pr_record.id,
            commit_sha=pr_data.get("head", {}).get("sha", "")
        )

        print(f"\n=======================================================")
        print(f" [SUCCESS] Review completed! (Run ID: {run_id})")
        print(f"=======================================================")
        print(f"Check your PR on GitHub at: {pr_data.get('html_url')}")
        print(f"Check your local Dashboard at: http://localhost:5173/repos/{repo.id}/pulls/{pr_record.id}")

    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Trigger review on a real GitHub PR without webhooks.")
    parser.add_argument("--repo", default="Yug23IT013/coderefactor-test", help="GitHub repo")
    parser.add_argument("--pr", type=int, default=1, help="PR number on GitHub")
    args = parser.parse_args()

    review_pr(args.repo, args.pr)


if __name__ == "__main__":
    main()
