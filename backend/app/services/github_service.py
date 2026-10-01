import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple
import httpx
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models import PostedComment

logger = logging.getLogger(__name__)


class GitHubService:
    """Client for GitHub REST API v3 / v4 interactions."""

    def __init__(self, token: Optional[str] = None):
        self.token = token or settings.GITHUB_TOKEN
        self.base_url = "https://api.github.com"

    def _headers(self, accept: str = "application/vnd.github.v3+json") -> Dict[str, str]:
        headers = {
            "Accept": accept,
            "User-Agent": "CodeRefactor-AI-Reviewer",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def get_pr_diff(self, owner: str, repo: str, pull_number: int) -> str:
        """Fetch raw unified diff for the pull request."""
        if not self.token:
            logger.warning("GITHUB_TOKEN not provided, returning empty diff.")
            return ""

        url = f"{self.base_url}/repos/{owner}/{repo}/pulls/{pull_number}"
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=self._headers(accept="application/vnd.github.v3.diff"))
                if response.status_code == 200:
                    return response.text
                logger.error(f"Failed to fetch PR diff: {response.status_code} - {response.text}")
                return ""
        except Exception as e:
            logger.error(f"Exception fetching PR diff: {e}")
            return ""

    def get_pr_files(self, owner: str, repo: str, pull_number: int) -> List[Dict[str, Any]]:
        """Fetch changed files list with patch and contents."""
        if not self.token:
            return []

        url = f"{self.base_url}/repos/{owner}/{repo}/pulls/{pull_number}/files"
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=self._headers())
                if response.status_code == 200:
                    return response.json()
                logger.error(f"Failed to fetch PR files: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            logger.error(f"Exception fetching PR files: {e}")
            return []

    def get_file_content(self, owner: str, repo: str, file_path: str, ref: str) -> str:
        """Fetch raw file content at specific commit ref."""
        if not self.token:
            return ""

        url = f"{self.base_url}/repos/{owner}/{repo}/contents/{file_path}?ref={ref}"
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, headers=self._headers(accept="application/vnd.github.v3.raw"))
                if response.status_code == 200:
                    return response.text
                return ""
        except Exception as e:
            logger.error(f"Exception fetching file content: {e}")
            return ""

    def post_pr_summary_comment(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        summary_text: str,
        pr_id: int,
        commit_sha: str,
        db: Session,
    ) -> Optional[str]:
        """Post top-level summary comment to the PR issue conversation."""
        body_hash = hashlib.sha256(summary_text.strip().encode("utf-8")).hexdigest()

        # Check if already posted identical summary for this PR
        existing = db.query(PostedComment).filter(
            PostedComment.pr_id == pr_id,
            PostedComment.body_hash == body_hash,
            PostedComment.comment_type == "summary"
        ).first()

        if existing:
            logger.info(f"Duplicate summary comment skipped for PR #{pull_number}")
            return existing.github_comment_id

        if not self.token:
            logger.info(f"[Dry Run] Would post PR #{pull_number} summary:\n{summary_text}")
            posted = PostedComment(
                pr_id=pr_id,
                github_comment_id="dry-run-summary",
                commit_sha=commit_sha,
                body_hash=body_hash,
                comment_type="summary",
            )
            db.add(posted)
            db.commit()
            return "dry-run-summary"

        url = f"{self.base_url}/repos/{owner}/{repo}/issues/{pull_number}/comments"
        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    url,
                    headers=self._headers(),
                    json={"body": summary_text},
                )
                if response.status_code in (200, 201):
                    comment_id = str(response.json().get("id"))
                    posted = PostedComment(
                        pr_id=pr_id,
                        github_comment_id=comment_id,
                        commit_sha=commit_sha,
                        body_hash=body_hash,
                        comment_type="summary",
                    )
                    db.add(posted)
                    db.commit()
                    return comment_id
                else:
                    logger.error(f"Error posting PR summary: {response.status_code} {response.text}")
                    return None
        except Exception as e:
            logger.error(f"Exception posting PR summary: {e}")
            return None

    def post_inline_review_comments(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        commit_sha: str,
        comments_data: List[Dict[str, Any]],
        pr_id: int,
        db: Session,
    ) -> int:
        """
        Post targeted inline review comments to the PR using GitHub Pull Request Review API.
        Deduplicates against already posted comments.
        """
        # Filter comments that haven't been posted yet
        new_comments = []
        comment_records = []

        for c in comments_data:
            path = c.get("path")
            line = c.get("line", 1)
            body = c.get("body", "")
            rule_id = c.get("rule_id", "")

            # Deduplication key: file_path + line_number + rule_id
            dedup_key = f"{path}:{line}:{rule_id}:{body[:80]}"
            body_hash = hashlib.sha256(dedup_key.encode("utf-8")).hexdigest()

            existing = db.query(PostedComment).filter(
                PostedComment.pr_id == pr_id,
                PostedComment.body_hash == body_hash,
            ).first()

            if not existing:
                new_comments.append({
                    "path": path,
                    "line": line,
                    "body": body,
                })
                comment_records.append((body_hash, path, line))

        if not new_comments:
            logger.info("No new inline review comments to post (all duplicate or none).")
            return 0

        if not self.token:
            logger.info(f"[Dry Run] Would post {len(new_comments)} inline review comments to PR #{pull_number}.")
            for body_hash, path, line in comment_records:
                db.add(PostedComment(
                    pr_id=pr_id,
                    github_comment_id="dry-run-inline",
                    file_path=path,
                    line_number=line,
                    commit_sha=commit_sha,
                    body_hash=body_hash,
                    comment_type="inline",
                ))
            db.commit()
            return len(new_comments)

        url = f"{self.base_url}/repos/{owner}/{repo}/pulls/{pull_number}/reviews"
        payload = {
            "commit_id": commit_sha,
            "event": "COMMENT",
            "body": "Automated code review findings and suggestions by **CodeRefactor AI**:",
            "comments": new_comments,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, headers=self._headers(), json=payload)
                if response.status_code in (200, 201):
                    logger.info(f"Successfully posted {len(new_comments)} inline review comments.")
                    for body_hash, path, line in comment_records:
                        db.add(PostedComment(
                            pr_id=pr_id,
                            github_comment_id=str(response.json().get("id")),
                            file_path=path,
                            line_number=line,
                            commit_sha=commit_sha,
                            body_hash=body_hash,
                            comment_type="inline",
                        ))
                    db.commit()
                    return len(new_comments)
                else:
                    logger.error(f"GitHub review post failed: {response.status_code} - {response.text}")
                    return 0
        except Exception as e:
            logger.error(f"Exception posting review comments: {e}")
            return 0

    def merge_pull_request(
        self,
        owner: str,
        repo: str,
        pull_number: int,
        commit_title: Optional[str] = None,
        commit_message: Optional[str] = None,
        merge_method: str = "squash",
        head_sha: Optional[str] = None,
    ) -> Tuple[bool, str]:
        """
        Merge a pull request using GitHub REST API:
        PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge
        Returns (success: bool, message_or_sha: str)
        """
        if not self.token:
            logger.info(f"[Dry Run] Auto-merge simulated for {owner}/{repo} PR #{pull_number}.")
            return True, f"dry-run-merge-sha-{pull_number}"

        url = f"{self.base_url}/repos/{owner}/{repo}/pulls/{pull_number}/merge"
        payload: Dict[str, Any] = {
            "commit_title": commit_title or f"Auto-merge PR #{pull_number} by CodeRefactor AI",
            "commit_message": commit_message or "All static analysis and security findings verified clean (0 findings).",
            "merge_method": merge_method,
        }
        if head_sha:
            payload["sha"] = head_sha

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.put(url, headers=self._headers(), json=payload)
                if response.status_code == 200:
                    data = response.json()
                    sha = data.get("sha", "merged")
                    logger.info(f"Successfully merged PR #{pull_number} in {owner}/{repo} (SHA: {sha})")
                    return True, sha
                else:
                    error_detail = response.json().get("message", response.text) if response.text else f"Status {response.status_code}"
                    logger.error(f"GitHub PR merge failed: {response.status_code} - {error_detail}")
                    return False, f"GitHub merge failed: {error_detail}"
        except Exception as e:
            logger.error(f"Exception merging PR #{pull_number}: {e}")
            return False, str(e)


github_service = GitHubService()
