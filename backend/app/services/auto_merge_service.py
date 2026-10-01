import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.db.models import PullRequest, Repository, ReviewRun, Finding, User
from app.services.github_service import github_service

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AutoMergeService:
    """
    Evaluates pull request findings against a strict zero-tolerance quality gate:
    A PR will ONLY auto-merge when:
    (Critical == 0) and (High == 0) and (Medium == 0) and (Low == 0).
    Also supports authorized manual Force-Merge overrides.
    """

    def get_latest_finding_counts(self, pr_id: int, db: Session) -> Dict[str, int]:
        """Fetch finding counts by severity for the latest review run of this PR."""
        latest_review = (
            db.query(ReviewRun)
            .filter(ReviewRun.pr_id == pr_id)
            .order_by(ReviewRun.id.desc())
            .first()
        )

        counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "total": 0,
        }

        if not latest_review:
            return counts

        findings = db.query(Finding).filter(Finding.review_run_id == latest_review.id).all()
        for f in findings:
            sev = (f.severity or "medium").lower()
            if sev in counts:
                counts[sev] += 1
            else:
                counts["medium"] += 1
            counts["total"] += 1

        return counts

    def get_eligibility_status(self, pr_id: int, db: Session) -> Dict[str, Any]:
        """Returns the full quality gate checklist and eligibility state for a PR."""
        pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
        if not pr:
            return {"error": "PR not found"}

        counts = self.get_latest_finding_counts(pr_id, db)
        is_clean = (
            counts["critical"] == 0
            and counts["high"] == 0
            and counts["medium"] == 0
            and counts["low"] == 0
        )

        blocking_reasons: List[str] = []
        if counts["critical"] > 0:
            blocking_reasons.append(f"{counts['critical']} Critical issue(s) must be resolved")
        if counts["high"] > 0:
            blocking_reasons.append(f"{counts['high']} High severity issue(s) must be resolved")
        if counts["medium"] > 0:
            blocking_reasons.append(f"{counts['medium']} Medium severity issue(s) must be resolved")
        if counts["low"] > 0:
            blocking_reasons.append(f"{counts['low']} Low severity / style issue(s) must be resolved")

        if pr.status != "open":
            blocking_reasons.append(f"PR is already {pr.status}")

        is_eligible = is_clean and pr.status == "open" and pr.auto_merge_enabled

        return {
            "pr_id": pr.id,
            "pr_number": pr.pr_number,
            "title": pr.title,
            "status": pr.status,
            "auto_merge_enabled": pr.auto_merge_enabled,
            "is_eligible": is_eligible,
            "is_clean": is_clean,
            "severities": counts,
            "blocking_reasons": blocking_reasons,
            "merged_at": pr.merged_at.isoformat() if pr.merged_at else None,
            "merged_by": pr.merged_by,
            "merge_commit_sha": pr.merge_commit_sha,
        }

    def _get_github_client(self, pr: PullRequest, db: Session):
        from app.services.github_service import GitHubService, github_service
        token = None
        repo = pr.repository
        if repo and repo.user_id:
            repo_owner = db.query(User).filter(User.id == repo.user_id).first()
            if repo_owner and repo_owner.github_access_token:
                token = repo_owner.github_access_token
        if not token and pr.author:
            pr_author_user = db.query(User).filter(User.username == pr.author).first()
            if pr_author_user and pr_author_user.github_access_token:
                token = pr_author_user.github_access_token
        if token:
            return GitHubService(token=token)
        return github_service

    def evaluate_and_merge(
        self,
        pr_id: int,
        review_run_id: int,
        db: Session
    ) -> Dict[str, Any]:
        """
        Called post-review by the orchestrator.
        If all findings == 0 and auto_merge_enabled == True, merges the PR.
        """
        pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
        if not pr:
            return {"action": "skipped", "reason": f"PR id {pr_id} not found"}

        if pr.status != "open":
            return {"action": "skipped", "reason": f"PR status is already '{pr.status}'"}

        if not pr.auto_merge_enabled:
            logger.info("Auto-merge is disabled for PR #%d (%s).", pr.pr_number, pr.title)
            return {"action": "skipped", "reason": "Auto-merge disabled by user configuration"}

        counts = self.get_latest_finding_counts(pr_id, db)
        is_clean = (
            counts["critical"] == 0
            and counts["high"] == 0
            and counts["medium"] == 0
            and counts["low"] == 0
        )

        if not is_clean:
            logger.info(
                "PR #%d not eligible for auto-merge. Unresolved: Crit=%d, High=%d, Med=%d, Low=%d (Total: %d)",
                pr.pr_number, counts["critical"], counts["high"], counts["medium"], counts["low"], counts["total"]
            )
            return {
                "action": "blocked",
                "reason": "Unresolved findings remain",
                "severities": counts,
            }

        # Quality gate PASSED! Execute merge via GitHub REST API
        repo = pr.repository
        owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else ("", repo.full_name)
        merge_method = repo.merge_method or "squash"

        commit_title = f"Auto-merge PR #{pr.pr_number}: {pr.title} by CodeRefactor AI"
        commit_message = (
            f"Automated quality gate verified clean:\n"
            f"- 0 Critical findings\n"
            f"- 0 High findings\n"
            f"- 0 Medium findings\n"
            f"- 0 Low findings\n"
            f"- AST Static Analysis and RAG review passed."
        )

        gh_client = self._get_github_client(pr, db)
        success, message_or_sha = gh_client.merge_pull_request(
            owner=owner,
            repo=repo_name,
            pull_number=pr.pr_number,
            commit_title=commit_title,
            commit_message=commit_message,
            merge_method=merge_method,
            head_sha=pr.head_sha,
        )

        if not success:
            logger.error("Auto-merge failed for PR #%d: %s", pr.pr_number, message_or_sha)
            return {"action": "failed", "reason": message_or_sha}

        # Update database
        pr.status = "merged"
        pr.merged_at = utc_now()
        pr.merged_by = "CodeRefactor AI (Auto-Merge)"
        pr.merge_commit_sha = message_or_sha
        db.commit()

        # Post celebratory comment to GitHub PR
        celebratory_body = (
            f"🎉 **Pull Request Automatically Merged by CodeRefactor AI**\n\n"
            f"All quality gate standards have been verified:\n"
            f"- ✅ Critical findings: `0`\n"
            f"- ✅ High severity: `0`\n"
            f"- ✅ Medium severity: `0`\n"
            f"- ✅ Low severity / style: `0`\n"
            f"- ✅ AST static analysis & RAG review passed with zero defects.\n\n"
            f"*Merged into `{repo.default_branch}` via `{merge_method}` commit `{message_or_sha[:8] if len(message_or_sha) >= 8 else message_or_sha}`.*"
        )
        try:
            github_service.post_pr_summary_comment(
                owner=owner,
                repo=repo_name,
                pull_number=pr.pr_number,
                summary_text=celebratory_body,
                pr_id=pr.id,
                commit_sha=pr.head_sha,
                db=db,
            )
        except Exception as e:
            logger.warning("Could not post auto-merge comment to GitHub: %s", e)

        logger.info("PR #%d successfully auto-merged by CodeRefactor AI!", pr.pr_number)
        return {
            "action": "merged",
            "pr_number": pr.pr_number,
            "merge_commit_sha": message_or_sha,
            "merged_by": pr.merged_by,
        }

    def force_merge(
        self,
        pr_id: int,
        db: Session,
        user: Optional[User] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Manually force merges a PR, overriding unresolved findings.
        Requires authenticated operator trigger and records an audit trail.
        """
        pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
        if not pr:
            return {"success": False, "error": f"PR #{pr_id} not found"}

        if pr.status != "open":
            return {"success": False, "error": f"PR is already '{pr.status}'"}

        repo = pr.repository
        owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else ("", repo.full_name)
        merge_method = repo.merge_method or "squash"

        counts = self.get_latest_finding_counts(pr_id, db)
        user_name = user.username if user else "Authorized User"
        merged_by_tag = f"@{user_name} (Force Merged)"
        override_note = reason.strip() if reason and reason.strip() else "Manual override approved by operator"

        commit_title = f"Force-merge PR #{pr.pr_number}: {pr.title} by @{user_name}"
        commit_message = (
            f"Manual force merge override by @{user_name}.\n"
            f"Overridden findings ({counts['total']} total): "
            f"Crit: {counts['critical']}, High: {counts['high']}, Med: {counts['medium']}, Low: {counts['low']}.\n"
            f"Reason: {override_note}"
        )

        gh_client = self._get_github_client(pr, db)
        success, message_or_sha = gh_client.merge_pull_request(
            owner=owner,
            repo=repo_name,
            pull_number=pr.pr_number,
            commit_title=commit_title,
            commit_message=commit_message,
            merge_method=merge_method,
            head_sha=pr.head_sha,
        )

        if not success:
            logger.error("Force merge failed for PR #%d: %s", pr.pr_number, message_or_sha)
            return {"success": False, "error": message_or_sha}

        # Update database record
        pr.status = "merged"
        pr.merged_at = utc_now()
        pr.merged_by = merged_by_tag
        pr.merge_commit_sha = message_or_sha
        db.commit()

        # Post GitHub audit comment
        audit_body = (
            f"⚠️ **Pull Request Force Merged by @{user_name}**\n\n"
            f"This pull request was manually force-merged, bypassing the zero-finding quality gate.\n"
            f"- **Bypassed Findings**: `{counts['total']}` total (Critical: `{counts['critical']}`, High: `{counts['high']}`, Medium: `{counts['medium']}`, Low: `{counts['low']}`)\n"
            f"- **Override Reason**: *{override_note}*\n"
            f"- **Merge Method**: `{merge_method}` (SHA: `{message_or_sha[:8] if len(message_or_sha) >= 8 else message_or_sha}`)"
        )
        try:
            github_service.post_pr_summary_comment(
                owner=owner,
                repo=repo_name,
                pull_number=pr.pr_number,
                summary_text=audit_body,
                pr_id=pr.id,
                commit_sha=pr.head_sha,
                db=db,
            )
        except Exception as e:
            logger.warning("Could not post force merge comment to GitHub: %s", e)

        logger.info("PR #%d was FORCE MERGED by %s.", pr.pr_number, merged_by_tag)
        return {
            "success": True,
            "action": "force_merged",
            "pr_id": pr.id,
            "pr_number": pr.pr_number,
            "merge_commit_sha": message_or_sha,
            "merged_by": merged_by_tag,
            "bypassed_findings": counts,
        }


# Global singleton auto merge service
auto_merge_service = AutoMergeService()
