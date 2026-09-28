from typing import List, Optional
from app.services.analyzer.base import FindingResult
from app.services.ai.base import BaseAIService, AIReviewResponse, AIInlineSuggestion


class MockReviewService(BaseAIService):
    """Deterministic mock AI review service for unit tests and local development."""

    def generate_review(
        self,
        pr_title: str,
        pr_author: str,
        diff: str,
        static_findings: List[FindingResult],
        file_contents: Optional[dict[str, str]] = None,
    ) -> AIReviewResponse:
        total = len(static_findings)
        critical_count = sum(1 for f in static_findings if f.severity == "critical")
        high_count = sum(1 for f in static_findings if f.severity == "high")

        if critical_count > 0:
            risk_level = "critical"
        elif high_count > 0:
            risk_level = "high"
        elif total > 0:
            risk_level = "medium"
        else:
            risk_level = "low"

        summary_lines = [
            f"### 🤖 Automated AI Code Review Summary",
            f"**PR Assessment:** Reviewed pull request *'{pr_title}'* by @{pr_author}.",
            f"- **Overall Risk Level:** `{risk_level.upper()}`",
            f"- **Total Static Analysis Findings:** `{total}` (Critical: {critical_count}, High: {high_count})",
            "",
            "#### Key Observations:",
        ]

        if total == 0:
            summary_lines.append("✅ Clean diff! No immediate security or anti-pattern smells detected.")
        else:
            summary_lines.append("⚠️ The changes introduce potential security or maintainability concerns that require remediation before merging.")

        suggestions: List[AIInlineSuggestion] = []
        for finding in static_findings:
            fix_code, explanation = self._generate_fix(finding)
            suggestions.append(AIInlineSuggestion(
                file_path=finding.file_path,
                line_number=finding.line_number,
                suggestion_code=fix_code,
                explanation=explanation,
                rule_id=finding.rule_id,
            ))

        return AIReviewResponse(
            summary="\n".join(summary_lines),
            risk_level=risk_level,
            inline_suggestions=suggestions,
        )

    def _generate_fix(self, finding: FindingResult) -> tuple[str, str]:
        rule = finding.rule_id
        if rule == "SEC001":
            return (
                "# Replace eval/exec with safe literal parsing\nimport ast\nsafe_val = ast.literal_eval(user_input)",
                "Avoid eval() which executes arbitrary Python code. ast.literal_eval() safely evaluates only standard Python literals."
            )
        elif rule == "SEC002":
            return (
                'import os\napi_key = os.environ["API_KEY"]',
                "Do not store secrets in source control. Retrieve credentials from environment variables or a secrets manager."
            )
        elif rule == "SEC003":
            return (
                'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
                "Use parameterized queries instead of string concatenation to eliminate SQL injection vulnerabilities."
            )
        elif rule == "SEC004":
            return (
                'import json\ndata = json.loads(payload)',
                "Avoid pickle for untrusted input. Use JSON or safe serialization formats."
            )
        elif rule == "BUG001":
            return (
                "except Exception as e:\n    logger.error(f'Operation failed: {e}')",
                "Catch specific exception types or at least Exception instead of a bare except clause."
            )
        elif rule == "BUG002":
            return (
                "def func(items=None):\n    if items is None:\n        items = []",
                "Mutable default arguments persist state across invocations. Use None as the default argument."
            )
        elif rule == "BUG003":
            return (
                "if variable is None:",
                "None is a singleton in Python. Use 'is None' or 'is not None' for identity comparisons."
            )
        elif rule == "PERF002":
            return (
                "# Remove unused import line",
                "Unused imports clutter the namespace and slow down startup time."
            )
        else:
            return (
                f"# Refactor {finding.file_path}:{finding.line_number}",
                f"Address finding {finding.rule_id}: {finding.message}"
            )
