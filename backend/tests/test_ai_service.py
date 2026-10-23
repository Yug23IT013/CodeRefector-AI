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


def test_groq_pydantic_schema_validation_and_recovery():
    service = GroqReviewService(api_key="mock-key")

    # Invalid risk level should be safely coerced to "medium"
    malformed_output = """{
  "summary": "Security alert in payment flow.",
  "risk_level": "EXTREME_DANGER",
  "inline_suggestions": [
    {
      "file_path": "billing.py",
      "line_number": 100,
      "explanation": "Sanitize charge amount",
      "suggestion_code": "amount = abs(float(val))"
    }
  ]
}"""
    parsed = service._parse_json_response(malformed_output, [])
    assert parsed.risk_level == "medium"
    assert len(parsed.inline_suggestions) == 1
    assert parsed.inline_suggestions[0].file_path == "billing.py"

    # Completely broken JSON should fall back gracefully with medium risk
    broken_output = "I am an AI that failed to return json."
    fallback_parsed = service._parse_json_response(broken_output, [])
    assert fallback_parsed.risk_level == "medium"
    assert fallback_parsed.summary == broken_output


def test_groq_rate_limit_backoff_and_retry(monkeypatch):
    from unittest.mock import MagicMock
    import httpx

    service = GroqReviewService(api_key="fake-groq-key", model="llama-3.3-70b-versatile")

    # Mock time.sleep so test runs instantaneously
    sleep_calls = []
    monkeypatch.setattr("time.sleep", lambda sec: sleep_calls.append(sec))

    call_count = 0

    def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First attempt: 429 rate limit with Retry-After header
            resp = MagicMock(spec=httpx.Response)
            resp.status_code = 429
            resp.headers = {"Retry-After": "0.1"}
            resp.text = "Rate limit reached"
            return resp
        else:
            # Second attempt: 200 OK
            resp = MagicMock(spec=httpx.Response)
            resp.status_code = 200
            resp.json.return_value = {
                "choices": [{
                    "message": {
                        "content": '{"summary": "PR looks good after retry", "risk_level": "low", "inline_suggestions": []}'
                    }
                }]
            }
            return resp

    monkeypatch.setattr("httpx.Client.post", mock_post)

    review = service.generate_review("Feature", "dev", "diff", [])
    assert review.risk_level == "low"
    assert "after retry" in review.summary
    assert len(sleep_calls) == 1
    assert sleep_calls[0] == 0.1

