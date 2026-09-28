#!/usr/bin/env python3
"""
Seed demo data (repositories, PRs, findings, AI review summaries)
into the database to test the frontend dashboard and API endpoints immediately.
"""

import os
import sys
from datetime import datetime, timezone

# Add backend to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import init_db, SessionLocal
from app.db.models import Repository, PullRequest, ReviewRun, Finding, PostedComment


def seed_demo():
    print("Initializing database tables...")
    init_db()
    db = SessionLocal()

    try:
        # Check if already seeded
        if db.query(Repository).filter(Repository.full_name == "acme-corp/payment-service").first():
            print("Database already contains demo data. Skipping seed.")
            return

        print("Seeding demo repositories and reviews...")

        # 1. Repo 1: payment-service
        repo1 = Repository(
            github_repo_id=123456,
            full_name="acme-corp/payment-service",
            default_branch="main",
        )
        db.add(repo1)
        db.commit()
        db.refresh(repo1)

        # PR 1 on Repo 1
        pr1 = PullRequest(
            repo_id=repo1.id,
            pr_number=101,
            title="Refactor Stripe payment gateway & webhook intake",
            author="alex-dev",
            head_sha="4f8a1c9e8b2d7a6f5e4c3b2a1d0e9f8a7b6c5d4e",
            base_sha="1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
            status="open",
            html_url="https://github.com/acme-corp/payment-service/pull/101",
        )
        db.add(pr1)
        db.commit()
        db.refresh(pr1)

        # ReviewRun for PR 1
        review1 = ReviewRun(
            pr_id=pr1.id,
            commit_sha=pr1.head_sha,
            status="completed",
            ai_summary=(
                "### [CodeRefactor AI] Automated Review Summary\n\n"
                "**Executive Risk Assessment: `CRITICAL`**\n\n"
                "- The pull request introduces significant security risks into the payment intake pipeline.\n"
                "- Detected dynamic code evaluation (`eval()`) on incoming webhook payload metadata.\n"
                "- Found hardcoded Stripe secret API key in `gateways/stripe_client.py`.\n"
                "- SQL string concatenation detected in customer audit transaction logging.\n\n"
                "**Recommendation:** Block merge until all critical security findings are remediated using the inline suggestions below."
            ),
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(review1)
        db.commit()
        db.refresh(review1)

        # Findings for Review 1
        f1 = Finding(
            review_run_id=review1.id,
            file_path="gateways/stripe_client.py",
            line_number=18,
            rule_id="SEC002",
            severity="high",
            category="security",
            message="Possible hardcoded secret in variable 'stripe_api_key'. Store credentials in environment variables.",
            ai_suggestion=(
                "Do not commit API credentials into version control.\n\n"
                "```python\n"
                "import os\n\n"
                "stripe_api_key = os.environ.get('STRIPE_SECRET_KEY')\n"
                "if not stripe_api_key:\n"
                "    raise RuntimeError('STRIPE_SECRET_KEY environment variable is not set.')\n"
                "```"
            ),
        )
        f2 = Finding(
            review_run_id=review1.id,
            file_path="webhooks/processor.py",
            line_number=42,
            rule_id="SEC001",
            severity="critical",
            category="security",
            message="Avoid dynamic code execution via eval(), which allows arbitrary code execution.",
            ai_suggestion=(
                "Replace dynamic eval execution with safe json or literal evaluation.\n\n"
                "```python\n"
                "import json\n\n"
                "# Safely decode structured JSON payload\n"
                "event_data = json.loads(raw_payload_body)\n"
                "```"
            ),
        )
        f3 = Finding(
            review_run_id=review1.id,
            file_path="db/audit.py",
            line_number=67,
            rule_id="SEC003",
            severity="high",
            category="security",
            message="Possible SQL Injection: SQL queries should use parameterized queries instead of string concatenation or f-strings.",
            ai_suggestion=(
                "Use parameterized query placeholders instead of f-strings.\n\n"
                "```python\n"
                "# Use query parameterization with SQLAlchemy or DB-API\n"
                "cursor.execute(\n"
                "    'INSERT INTO audit_logs (customer_id, amount) VALUES (%s, %s)',\n"
                "    (customer_id, transaction_amount)\n"
                ")\n"
                "```"
            ),
        )
        f4 = Finding(
            review_run_id=review1.id,
            file_path="utils/helpers.py",
            line_number=25,
            rule_id="BUG002",
            severity="medium",
            category="bug_risk",
            message="Mutable default argument in function 'parse_headers'. Use 'None' as default and initialize inside function.",
            ai_suggestion=(
                "Avoid mutable default list in function signature.\n\n"
                "```python\n"
                "def parse_headers(headers=None):\n"
                "    if headers is None:\n"
                "        headers = []\n"
                "    ...\n"
                "```"
            ),
        )

        db.add_all([f1, f2, f3, f4])

        # 2. Repo 2: analytics-dashboard
        repo2 = Repository(
            github_repo_id=654321,
            full_name="acme-corp/analytics-dashboard",
            default_branch="main",
        )
        db.add(repo2)
        db.commit()
        db.refresh(repo2)

        pr2 = PullRequest(
            repo_id=repo2.id,
            pr_number=45,
            title="Clean up chart render pipelines and bump dependencies",
            author="sarah-engineer",
            head_sha="9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e",
            base_sha="2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c",
            status="open",
            html_url="https://github.com/acme-corp/analytics-dashboard/pull/45",
        )
        db.add(pr2)
        db.commit()
        db.refresh(pr2)

        review2 = ReviewRun(
            pr_id=pr2.id,
            commit_sha=pr2.head_sha,
            status="completed",
            ai_summary=(
                "### [CodeRefactor AI] Automated Review Summary\n\n"
                "**Executive Risk Assessment: `LOW`**\n\n"
                "- High quality changes overall. Clean refactoring of analytics chart components.\n"
                "- Only minor code style and unused imports flagged.\n"
                "- Safe to merge once unused imports are removed."
            ),
            started_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.add(review2)
        db.commit()
        db.refresh(review2)

        f5 = Finding(
            review_run_id=review2.id,
            file_path="components/charts.py",
            line_number=3,
            rule_id="PERF002",
            severity="low",
            category="performance",
            message="Import 'math' is imported but never used.",
            ai_suggestion="Remove unused import 'math' to keep namespace clean.",
        )
        db.add(f5)

        db.commit()
        print("Successfully seeded 2 repositories, 2 pull requests, and 5 findings!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
