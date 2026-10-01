import pytest
from app.db.models import Repository, PullRequest, ReviewRun, Finding
from app.services.auto_merge_service import auto_merge_service


def test_auto_merge_blocked_when_findings_exist(db_session):
    """PR with unresolved findings (any crit, high, med, low > 0) MUST NOT auto-merge."""
    repo = Repository(full_name="test-org/auto-merge-test-repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=101,
        title="Feature branch with issues",
        author="developer",
        head_sha="sha101",
        status="open",
        auto_merge_enabled=True,
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)

    review_run = ReviewRun(pr_id=pr.id, commit_sha=pr.head_sha, status="completed")
    db_session.add(review_run)
    db_session.commit()
    db_session.refresh(review_run)

    # Add 1 critical finding and 1 low finding
    f1 = Finding(
        review_run_id=review_run.id,
        file_path="main.py",
        line_number=10,
        rule_id="SEC001",
        severity="critical",
        message="Dynamic eval",
    )
    f2 = Finding(
        review_run_id=review_run.id,
        file_path="utils.py",
        line_number=20,
        rule_id="BUG003",
        severity="low",
        message="None comparison",
    )
    db_session.add_all([f1, f2])
    db_session.commit()

    outcome = auto_merge_service.evaluate_and_merge(pr.id, review_run.id, db_session)
    assert outcome["action"] == "blocked"
    assert outcome["severities"]["critical"] == 1
    assert outcome["severities"]["low"] == 1
    assert outcome["severities"]["total"] == 2

    # PR MUST still be open
    db_session.refresh(pr)
    assert pr.status == "open"
    assert pr.merged_at is None


def test_auto_merge_executes_when_all_findings_zero(db_session):
    """PR with 0 findings across all severities MUST auto-merge cleanly."""
    repo = Repository(full_name="test-org/clean-repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=102,
        title="Clean PR with zero defects",
        author="developer",
        head_sha="sha102",
        status="open",
        auto_merge_enabled=True,
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)

    review_run = ReviewRun(pr_id=pr.id, commit_sha=pr.head_sha, status="completed")
    db_session.add(review_run)
    db_session.commit()
    db_session.refresh(review_run)

    # 0 findings attached to review_run
    outcome = auto_merge_service.evaluate_and_merge(pr.id, review_run.id, db_session)
    assert outcome["action"] == "merged"
    assert "merge_commit_sha" in outcome

    # PR MUST transition to merged
    db_session.refresh(pr)
    assert pr.status == "merged"
    assert pr.merged_at is not None
    assert "CodeRefactor AI" in pr.merged_by


def test_force_merge_bypasses_findings(db_session):
    """Authorized manual force merge MUST bypass findings and record audit info."""
    repo = Repository(full_name="test-org/force-merge-repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=103,
        title="Urgent hotfix",
        author="hotfix-author",
        head_sha="sha103",
        status="open",
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)

    review_run = ReviewRun(pr_id=pr.id, commit_sha=pr.head_sha, status="completed")
    db_session.add(review_run)
    db_session.commit()

    f = Finding(
        review_run_id=review_run.id,
        file_path="urgent.py",
        line_number=5,
        rule_id="SEC002",
        severity="critical",
        message="Hardcoded secret in hotfix",
    )
    db_session.add(f)
    db_session.commit()

    res = auto_merge_service.force_merge(
        pr_id=pr.id,
        db=db_session,
        user=None,
        reason="Emergency hotfix verified manually",
    )
    assert res["success"] is True
    assert res["action"] == "force_merged"

    db_session.refresh(pr)
    assert pr.status == "merged"
    assert pr.merged_at is not None
    assert "Force Merged" in pr.merged_by


def test_api_auto_merge_endpoints(client, db_session):
    """Test /auto-merge checklist and toggle endpoints."""
    repo = Repository(full_name="test-org/api-endpoints-repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=104,
        title="PR for API testing",
        author="tester",
        head_sha="sha104",
        status="open",
        auto_merge_enabled=True,
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)

    # GET /auto-merge status
    res = client.get(f"/api/v1/pulls/{pr.id}/auto-merge")
    assert res.status_code == 200
    data = res.json()
    assert data["pr_id"] == pr.id
    assert data["auto_merge_enabled"] is True

    # POST /auto-merge/toggle
    res_toggle = client.post(f"/api/v1/pulls/{pr.id}/auto-merge/toggle")
    assert res_toggle.status_code == 200
    assert res_toggle.json()["auto_merge_enabled"] is False

    # POST /force-merge via API
    res_force = client.post(
        f"/api/v1/pulls/{pr.id}/force-merge",
        json={"reason": "Testing API force merge"}
    )
    assert res_force.status_code == 200
    assert res_force.json()["action"] == "force_merged"
