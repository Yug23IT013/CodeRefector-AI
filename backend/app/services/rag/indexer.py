import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from app.db.models import Finding, ReviewRun, PullRequest
from app.services.rag.vector_store import vector_store

logger = logging.getLogger(__name__)


class RAGIndexer:
    """
    Indexes PR review findings and suggestions into the vector store
    to create a persistent organizational memory of code reviews.
    """

    def index_review_findings(self, review_run_id: int, db: Session) -> int:
        """
        Indexes all findings produced during a review run.
        Called automatically by ReviewOrchestrator upon completion of a review.
        """
        review_run = db.query(ReviewRun).filter(ReviewRun.id == review_run_id).first()
        if not review_run:
            logger.warning("ReviewRun #%d not found for indexing.", review_run_id)
            return 0

        pr = review_run.pull_request
        repo_id = pr.repo_id if pr else None
        pr_number = pr.pr_number if pr else None

        findings = db.query(Finding).filter(Finding.review_run_id == review_run_id).all()
        indexed_count = 0

        for f in findings:
            try:
                vector_store.index_finding(
                    finding_id=f.id,
                    rule_id=f.rule_id,
                    file_path=f.file_path,
                    message=f.message,
                    ai_suggestion=f.ai_suggestion,
                    severity=f.severity,
                    category=f.category,
                    repo_id=repo_id,
                    pr_number=pr_number,
                )
                indexed_count += 1
            except Exception as e:
                logger.error("Failed to index finding #%d: %s", f.id, e)

        logger.info("Indexed %d findings from ReviewRun #%d into RAG vector store.", indexed_count, review_run_id)
        return indexed_count

    def reindex_all_findings(self, db: Session) -> int:
        """
        Scans all findings in the relational database and upserts them
        into the RAG vector store. Useful on startup or manual refresh.
        """
        findings = (
            db.query(Finding, PullRequest.repo_id, PullRequest.pr_number)
            .join(ReviewRun, Finding.review_run_id == ReviewRun.id)
            .join(PullRequest, ReviewRun.pr_id == PullRequest.id)
            .all()
        )

        count = 0
        for f, repo_id, pr_num in findings:
            try:
                vector_store.index_finding(
                    finding_id=f.id,
                    rule_id=f.rule_id,
                    file_path=f.file_path,
                    message=f.message,
                    ai_suggestion=f.ai_suggestion,
                    severity=f.severity,
                    category=f.category,
                    repo_id=repo_id,
                    pr_number=pr_num,
                )
                count += 1
            except Exception as e:
                logger.error("Error reindexing finding #%d: %s", f.id, e)

        logger.info("Successfully re-indexed %d total historical findings into RAG.", count)
        return count

    def refresh_rule_knowledge(self) -> int:
        """Force re-seed all static rule knowledge into vector store."""
        vector_store.seed_rule_knowledge(force=True)
        return vector_store.get_rule_count()


# Global singleton indexer instance
rag_indexer = RAGIndexer()
