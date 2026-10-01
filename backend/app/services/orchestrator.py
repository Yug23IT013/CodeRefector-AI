import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.db.models import PullRequest, Repository, ReviewRun, Finding
from app.services.analyzer import analyzer_registry, FindingResult
from app.services.ai import get_ai_service
from app.services.github_service import github_service
from app.services.rag.retriever import rag_retriever
from app.services.rag.indexer import rag_indexer
from app.services.auto_merge_service import auto_merge_service

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReviewOrchestrator:
    """Coordinates fetching PR diffs, running static analysis, AI reviews, and GitHub posting."""

    def process_pr_review(self, pr_id: int, commit_sha: Optional[str] = None) -> Optional[int]:
        """
        Execute full review cycle for a pull request.
        Safe for background execution (creates its own database session).
        """
        db: Session = SessionLocal()
        try:
            pr = db.query(PullRequest).filter(PullRequest.id == pr_id).first()
            if not pr:
                logger.error(f"PullRequest with id={pr_id} not found.")
                return None

            repo = pr.repository
            target_sha = commit_sha or pr.head_sha

            # 1. Create or update ReviewRun record
            review_run = ReviewRun(
                pr_id=pr.id,
                commit_sha=target_sha,
                status="in_progress",
                started_at=utc_now(),
            )
            db.add(review_run)
            db.commit()
            db.refresh(review_run)

            logger.info(f"Starting review run #{review_run.id} for PR #{pr.pr_number} ({repo.full_name})")

            # 2. Fetch changed files and diff
            owner, repo_name = repo.full_name.split("/", 1) if "/" in repo.full_name else ("", repo.full_name)
            diff_text = github_service.get_pr_diff(owner, repo_name, pr.pr_number)
            changed_files = github_service.get_pr_files(owner, repo_name, pr.pr_number)

            # 3. Run Static Analysis on changed files
            static_findings: List[FindingResult] = []
            file_contents_map: Dict[str, str] = {}

            for file_info in changed_files:
                filename = file_info.get("filename", "")
                status = file_info.get("status", "")
                # Skip removed files
                if status == "removed":
                    continue

                # Get content
                content = github_service.get_file_content(owner, repo_name, filename, ref=target_sha)
                if content:
                    file_contents_map[filename] = content
                    findings = analyzer_registry.analyze_file(filename, content)
                    static_findings.extend(findings)

            # In demo/offline mode (e.g. seeded PRs where GitHub API isn't connected),
            # reuse previous findings from earlier runs so findings are not lost on re-review
            if not static_findings and not changed_files:
                prev_runs = db.query(ReviewRun).filter(ReviewRun.pr_id == pr.id, ReviewRun.id != review_run.id).order_by(ReviewRun.id.desc()).all()
                for prun in prev_runs:
                    prev_findings = db.query(Finding).filter(Finding.review_run_id == prun.id).all()
                    if prev_findings:
                        for pf in prev_findings:
                            static_findings.append(FindingResult(
                                file_path=pf.file_path,
                                line_number=pf.line_number,
                                rule_id=pf.rule_id,
                                severity=pf.severity,
                                category=pf.category,
                                message=pf.message,
                            ))
                        break

            logger.info(f"Static analysis found {len(static_findings)} issues.")

            # 3.5. Retrieve Grounded RAG Context (Knowledge Base & Past Precedents)
            rag_context = ""
            try:
                rag_context = rag_retriever.retrieve_context_for_findings(
                    findings=static_findings,
                    repo_id=repo.id,
                )
                if rag_context:
                    logger.info("Successfully retrieved RAG context for review.")
            except Exception as e:
                logger.warning(f"RAG retrieval skipped due to error: {e}")

            # 4. Invoke AI Review Layer with RAG context
            ai_service = get_ai_service()
            ai_response = ai_service.generate_review(
                pr_title=pr.title,
                pr_author=pr.author,
                diff=diff_text,
                static_findings=static_findings,
                file_contents=file_contents_map,
                rag_context=rag_context,
            )

            # 5. Persist findings to database
            # Map AI suggestions by file and line for quick lookup
            suggestion_map = {}
            for s in ai_response.inline_suggestions:
                key = f"{s.file_path}:{s.line_number}"
                suggestion_map[key] = f"{s.explanation}\n\n```python\n{s.suggestion_code}\n```"

            db_findings = []
            for f in static_findings:
                key = f"{f.file_path}:{f.line_number}"
                ai_fix = suggestion_map.get(key)
                finding_rec = Finding(
                    review_run_id=review_run.id,
                    file_path=f.file_path,
                    line_number=f.line_number,
                    rule_id=f.rule_id,
                    severity=f.severity,
                    category=f.category,
                    message=f.message,
                    ai_suggestion=ai_fix,
                )
                db.add(finding_rec)
                db_findings.append(finding_rec)

            db.commit()

            # 5.5. Index reviewed findings into RAG Vector Store
            try:
                indexed_count = rag_indexer.index_review_findings(review_run.id, db=db)
                logger.info(f"RAG indexed {indexed_count} findings from ReviewRun #{review_run.id}")
            except Exception as e:
                logger.warning(f"RAG indexing skipped due to error: {e}")

            # 6. Post comments back to GitHub PR
            # Top-level summary
            github_service.post_pr_summary_comment(
                owner=owner,
                repo=repo_name,
                pull_number=pr.pr_number,
                summary_text=ai_response.summary,
                pr_id=pr.id,
                commit_sha=target_sha,
                db=db,
            )

            # Inline review comments
            inline_comments_payload = []
            for s in ai_response.inline_suggestions:
                rule_badge = f"**[{s.rule_id}]** " if s.rule_id else ""
                body = (
                    f"⚠️ {rule_badge}**CodeRefactor AI Suggestion**\n\n"
                    f"{s.explanation}\n\n"
                    f"```suggestion\n{s.suggestion_code}\n```"
                )
                inline_comments_payload.append({
                    "path": s.file_path,
                    "line": s.line_number,
                    "body": body,
                    "rule_id": s.rule_id or "AI_SUGGESTION",
                })

            github_service.post_inline_review_comments(
                owner=owner,
                repo=repo_name,
                pull_number=pr.pr_number,
                commit_sha=target_sha,
                comments_data=inline_comments_payload,
                pr_id=pr.id,
                db=db,
            )

            # 7. Update ReviewRun to completed
            review_run.status = "completed"
            review_run.ai_summary = ai_response.summary
            review_run.completed_at = utc_now()
            db.commit()

            # 8. Evaluate Auto-Merge criteria (Strict zero-tolerance: Critical, High, Med, Low must all be 0)
            try:
                merge_outcome = auto_merge_service.evaluate_and_merge(
                    pr_id=pr.id,
                    review_run_id=review_run.id,
                    db=db,
                )
                logger.info(f"Auto-merge evaluation for PR #{pr.pr_number}: {merge_outcome.get('action')}")
            except Exception as e:
                logger.warning(f"Auto-merge evaluation skipped due to error: {e}")

            logger.info(f"Review run #{review_run.id} completed successfully.")
            return review_run.id

        except Exception as e:
            logger.error(f"Error during PR review execution: {e}", exc_info=True)
            if "review_run" in locals() and review_run:
                review_run.status = "failed"
                review_run.error_message = str(e)
                review_run.completed_at = utc_now()
                db.commit()
            return None
        finally:
            db.close()


review_orchestrator = ReviewOrchestrator()
