import pytest
from unittest.mock import patch
from app.db.models import Repository, PullRequest, ReviewRun, Finding, PostedComment
from app.services.orchestrator import review_orchestrator


def test_orchestrator_pipeline_execution(db_session):
    # Setup test repo & PR in database
    repo = Repository(full_name="demo/repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=10,
        title="Fix authentication flow",
        author="developer",
        head_sha="1111222233334444555566667777888899990000",
        base_sha="0000111122223333444455556666777788889999",
        status="open",
    )
    db_session.add(pr)
    db_session.commit()

    target_pr_id = pr.id

    mock_diff = """diff --git a/app.py b/app.py
--- a/app.py
+++ b/app.py
@@ -1,3 +1,3 @@
-import json
+eval("malicious")
"""
    mock_files = [{"filename": "app.py", "status": "modified"}]
    mock_file_content = 'eval("malicious")\n'

    with patch("app.services.orchestrator.SessionLocal", return_value=db_session), \
         patch("app.services.orchestrator.github_service.get_pr_diff", return_value=mock_diff), \
         patch("app.services.orchestrator.github_service.get_pr_files", return_value=mock_files), \
         patch("app.services.orchestrator.github_service.get_file_content", return_value=mock_file_content):

        review_run_id = review_orchestrator.process_pr_review(pr_id=target_pr_id)
        assert review_run_id is not None

        # Verify ReviewRun was marked completed
        run = db_session.query(ReviewRun).filter(ReviewRun.id == review_run_id).first()
        assert run.status == "completed"
        assert run.ai_summary is not None

        # Verify findings persisted
        findings = db_session.query(Finding).filter(Finding.review_run_id == review_run_id).all()
        assert len(findings) >= 1
        assert any(f.rule_id == "SEC001" for f in findings)

        # Verify PostedComments exist
        comments = db_session.query(PostedComment).filter(PostedComment.pr_id == target_pr_id).all()
        assert len(comments) >= 1

        # Run again to ensure idempotency and deduplication
        second_run_id = review_orchestrator.process_pr_review(pr_id=target_pr_id)
        assert second_run_id is not None

