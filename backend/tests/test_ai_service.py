import pytest
from app.services.analyzer.base import FindingResult
from app.services.ai.mock_service import MockReviewService
from app.services.ai.groq_service import GroqReviewService


def test_mock_ai_service_with_findings():
    service = MockReviewService()
    findings = [
        FindingResult(
            file_path="auth.py",
            line_number=14,
            rule_id="SEC001",
            severity="critical",
            category="security",
            message="Avoid eval",
            code_snippet="eval(payload)",
        ),
        FindingResult(
            file_path="utils.py",
            line_number=5,
            rule_id="BUG002",
            severity="medium",
            category="bug_risk",
            message="Mutable default arg",
            code_snippet="def foo(items=[])",
        ),
    ]

    response = service.generate_review(
        pr_title="Add Auth",
        pr_author="alice",
        diff="diff --git a/auth.py b/auth.py",
        static_findings=findings,
    )

    assert response.risk_level == "critical"
    assert "PR Assessment" in response.summary
    assert len(response.inline_suggestions) == 2
    assert response.inline_suggestions[0].file_path == "auth.py"
    assert "ast.literal_eval" in response.inline_suggestions[0].suggestion_code


def test_mock_ai_service_clean_pr():
    service = MockReviewService()
    response = service.generate_review(
        pr_title="Docs Update",
        pr_author="bob",
        diff="diff --git a/README.md",
        static_findings=[],
    )
    assert response.risk_level == "low"
    assert len(response.inline_suggestions) == 0


def test_groq_json_parser_native_json():
    service = GroqReviewService(api_key="mock-key")
    sample_groq_output = """{
  "summary": "The PR introduces security and performance issues with dynamic eval execution.",
  "risk_level": "critical",
  "inline_suggestions": [
    {
      "file_path": "server.py",
      "line_number": 23,
      "rule_id": "SEC001",
      "explanation": "Replace eval with safe json parser",
      "suggestion_code": "data = json.loads(payload)"
    }
  ]
}"""
    parsed = service._parse_json_response(sample_groq_output, [])
    assert parsed.risk_level == "critical"
    assert "security and performance" in parsed.summary
    assert len(parsed.inline_suggestions) == 1
    assert parsed.inline_suggestions[0].suggestion_code == "data = json.loads(payload)"


def test_groq_json_parser_markdown_wrapped():
    service = GroqReviewService(api_key="mock-key")
    sample_wrapped_output = """```json
{
  "summary": "Clean pull request with minor formatting fixes.",
  "risk_level": "low",
  "inline_suggestions": []
}
```"""
    parsed = service._parse_json_response(sample_wrapped_output, [])
    assert parsed.risk_level == "low"
    assert len(parsed.inline_suggestions) == 0
