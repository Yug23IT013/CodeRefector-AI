import json
import re
import logging
from typing import List, Optional
import anthropic
from app.core.config import settings
from app.services.analyzer.base import FindingResult
from app.services.ai.base import BaseAIService, AIReviewResponse, AIInlineSuggestion

logger = logging.getLogger(__name__)


class ClaudeReviewService(BaseAIService):
    """Anthropic Claude integration for AI-powered code reviews."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.model = model or settings.ANTHROPIC_MODEL
        self.client = anthropic.Anthropic(api_key=self.api_key) if self.api_key else None

    def generate_review(
        self,
        pr_title: str,
        pr_author: str,
        diff: str,
        static_findings: List[FindingResult],
        file_contents: Optional[dict[str, str]] = None,
        rag_context: Optional[str] = None,
    ) -> AIReviewResponse:
        if not self.client:
            raise ValueError("Anthropic API key is not configured. Use MockReviewService or set ANTHROPIC_API_KEY.")

        findings_summary = []
        for f in static_findings:
            findings_summary.append(
                f"- [{f.severity.upper()}] {f.file_path}:{f.line_number} ({f.rule_id}) - {f.message}"
            )
        findings_text = "\n".join(findings_summary) if findings_summary else "No static analysis issues flagged."

        # Cap diff size to avoid token overflow
        truncated_diff = diff[:25000] if len(diff) > 25000 else diff

        rag_block = f"\n\n{rag_context}\n" if rag_context else ""

        system_prompt = (
            "You are an expert senior software engineer and security auditor conducting an automated code review on a GitHub Pull Request.\n"
            "Your review consists of two parts:\n"
            "1. An Executive Summary evaluating overall PR quality, security risk, and architectural integrity.\n"
            "2. Actionable Inline Suggestions: For static analysis findings and other critical bugs in the diff, provide concrete replacement code fixes.\n"
            f"{rag_block}\n"
            "Return ONLY a valid JSON object with the following schema:\n"
            "{\n"
            '  "summary": "Markdown text with a concise executive overview and risk assessment.",\n'
            '  "risk_level": "low" | "medium" | "high" | "critical",\n'
            '  "inline_suggestions": [\n'
            '    {\n'
            '      "file_path": "path/to/file.ext",\n'
            '      "line_number": 42,\n'
            '      "rule_id": "SEC001",\n'
            '      "explanation": "Why this is an issue and how the proposed change fixes it.",\n'
            '      "suggestion_code": "Exact replacement code or patch snippet."\n'
            '    }\n'
            '  ]\n'
            "}"
        )

        user_content = (
            f"Pull Request Title: {pr_title}\n"
            f"Author: {pr_author}\n\n"
            f"### Static Analysis Findings:\n{findings_text}\n\n"
            f"### PR Unified Diff:\n```diff\n{truncated_diff}\n```\n"
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4000,
                temperature=0.2,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
            )

            response_text = ""
            for block in response.content:
                if block.type == "text":
                    response_text += block.text

            return self._parse_json_response(response_text, static_findings)
        except Exception as e:
            logger.error(f"Error calling Claude API: {e}", exc_info=True)
            raise

    def _parse_json_response(self, text: str, static_findings: List[FindingResult]) -> AIReviewResponse:
        """Extract and parse JSON from Claude response, handling code fence wrappers."""
        clean_text = text.strip()
        # Remove ```json ... ``` wrapper if present
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text)
            clean_text = re.sub(r"\s*```$", "", clean_text)

        try:
            data = json.loads(clean_text)
        except json.JSONDecodeError:
            # Fallback regex extraction of JSON object
            match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
            else:
                return AIReviewResponse(
                    summary=text,
                    risk_level="medium",
                    inline_suggestions=[],
                )

        summary = data.get("summary", "Automated code review completed.")
        risk_level = data.get("risk_level", "medium").lower()
        if risk_level not in ("low", "medium", "high", "critical"):
            risk_level = "medium"

        suggestions: List[AIInlineSuggestion] = []
        for s in data.get("inline_suggestions", []):
            file_p = s.get("file_path", "")
            line_n = s.get("line_number", 1)
            explanation = s.get("explanation", "")
            suggestion_code = s.get("suggestion_code", "")
            rule_id = s.get("rule_id")

            if file_p and explanation:
                suggestions.append(AIInlineSuggestion(
                    file_path=file_p,
                    line_number=line_n,
                    suggestion_code=suggestion_code,
                    explanation=explanation,
                    rule_id=rule_id,
                ))

        return AIReviewResponse(
            summary=summary,
            risk_level=risk_level,
            inline_suggestions=suggestions,
        )
