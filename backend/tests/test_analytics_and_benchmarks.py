import pytest
from app.db.models import Repository, PullRequest, ReviewRun, Finding, BenchmarkRun


def test_analytics_overview_empty(client):
    response = client.get("/api/v1/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert "total_repositories" in data
    assert "health_score" in data


def test_analytics_repo_trends(client, db_session):
    # Setup test repo, PR, review, and findings
    repo = Repository(full_name="org/trend-test-repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr1 = PullRequest(
        repo_id=repo.id,
        pr_number=101,
        title="Add auth middleware",
        author="alice",
        head_sha="sha111",
        base_sha="main",
        status="open"
    )
    db_session.add(pr1)
    db_session.commit()
    db_session.refresh(pr1)

    review1 = ReviewRun(pr_id=pr1.id, commit_sha="sha111", status="completed")
    db_session.add(review1)
    db_session.commit()
    db_session.refresh(review1)

    finding1 = Finding(
        review_run_id=review1.id,
        file_path="app/auth.py",
        line_number=12,
        rule_id="SEC001",
        severity="critical",
        category="security",
        message="Dynamic execution detected."
    )
    db_session.add(finding1)
    db_session.commit()

    response = client.get(f"/api/v1/analytics/repos/{repo.id}/trends")
    assert response.status_code == 200
    data = response.json()
    assert data["repo_id"] == repo.id
    assert data["total_prs"] == 1
    assert data["total_findings"] == 1
    assert data["health_score"]["score"] < 100
    assert len(data["trends"]) == 1
    assert data["trends"][0]["critical"] == 1


def test_benchmarks_lifecycle(client, db_session):
    repo = Repository(full_name="org/perf-test-repo", default_branch="main")
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=202,
        title="Optimize AST parser",
        author="bob",
        head_sha="sha222",
        base_sha="main",
        status="open"
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)

    # 1. Get PR benchmarks (should auto-generate first benchmark)
    res = client.get(f"/api/v1/pulls/{pr.id}/benchmarks")
    assert res.status_code == 200
    b_data = res.json()
    assert b_data["pr_id"] == pr.id
    assert "base_latency_ms" in b_data
    assert "pr_latency_ms" in b_data
    assert "base_memory_mb" in b_data
    assert "pr_memory_mb" in b_data
    assert len(b_data["suites"]) > 0

    # 2. Run new benchmark on demand
    run_res = client.post(f"/api/v1/pulls/{pr.id}/benchmarks/run")
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["status"] == "completed"
    assert "pr_latency_ms" in run_data

    # 3. Get repository benchmark trends
    trend_res = client.get(f"/api/v1/repos/{repo.id}/benchmarks/trends")
    assert trend_res.status_code == 200
    trend_data = trend_res.json()
    assert trend_data["repo_id"] == repo.id
    assert len(trend_data["benchmark_trends"]) >= 1
