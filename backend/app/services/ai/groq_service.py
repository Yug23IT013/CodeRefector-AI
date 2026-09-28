import json
import logging
import re
from typing import List, Optional
import httpx
from app.core.config import settings
from app.services.analyzer.base import FindingResult
from app.services.ai.base import BaseAIService, AIReviewResponse, AIInlineSuggestion
from app.services.ai.mock_service import MockReviewService

logger = logging.getLogger(__name__)

FALLBACK_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "groq/compound-mini",
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]


class GroqReviewService(BaseAIService):
    """
    Groq Free Cloud AI integration for high-speed automated code reviews.
    Supports auto-fallback across available Groq models and graceful mock fallback.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.GROQ_API_KEY
        self.model = model or settings.GROQ_MODEL
        self.base_url = "https://api.groq.com/openai/v1/chat/completions"

    def generate_review(
        self,
        pr_title: str,
        pr_author: str,
        diff: str,
        static_findings: List[FindingResult],
        file_contents: Optional[dict[str, str]] = None,
    ) -> AIReviewResponse:
        if not self.api_key:
            logger.info("No GROQ_API_KEY set. Using MockReviewService fallback.")
            return MockReviewService().generate_review(pr_title, pr_author, diff, static_findings, file_contents)

        findings_summary = []
        for f in static_findings:
            findings_summary.append(
                f"- [{f.severity.upper()}] {f.file_path}:{f.line_number} ({f.rule_id}) - {f.message}"
            )
        findings_text = "\n".join(findings_summary) if findings_summary else "No static analysis issues flagged."

        # Truncate diff to avoid exceeding token limits
        truncated_diff = diff[:20000] if len(diff) > 20000 else diff

        system_prompt = (
            "You are an expert senior software engineer and security auditor conducting an automated code review on a GitHub Pull Request.\n"
            "Your review consists of two parts:\n"
            "1. An Executive Summary evaluating overall PR quality, security risk, and architectural integrity.\n"
            "2. Actionable Inline Suggestions: For static analysis findings and other critical bugs in the diff, provide concrete replacement code fixes.\n\n"
            "You MUST respond ONLY with a valid JSON object matching this exact schema:\n"
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

        user_prompt = (
            f"Pull Request Title: {pr_title}\n"
            f"Author: @{pr_author}\n\n"
            f"### Static Analysis Findings:\n{findings_text}\n\n"
            f"### PR Unified Diff:\n```diff\n{truncated_diff}\n```\n"
        )

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Models to try (configured model first, then fallback models)
        models_to_try = [self.model] + [m for m in FALLBACK_MODELS if m != self.model]

        for target_model in models_to_try:
            payload = {
                "model": target_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
                "max_tokens": 4096,
            }

            try:
                with httpx.Client(timeout=45.0) as client:
                    response = client.post(self.base_url, headers=headers, json=payload)
                    if response.status_code == 200:
                        res_data = response.json()
                        content = res_data["choices"][0]["message"]["content"]
                        return self._parse_json_response(content, static_findings)

                    # If model not found (404), try next model in loop
                    if response.status_code == 404 or "model_not_found" in response.text:
                        logger.warning(f"Groq model '{target_model}' not available on this account, trying next fallback...")
                        continue

                    logger.error(f"Groq API error ({response.status_code}): {response.text}")
                    break

            except Exception as e:
                logger.warning(f"Error calling Groq model '{target_model}': {e}")
                continue

        # If all Groq models fail or encounter error, gracefully use MockReviewService fallback
        logger.warning("All Groq model attempts failed. Falling back to MockReviewService.")
        return MockReviewService().generate_review(pr_title, pr_author, diff, static_findings, file_contents)

    def _parse_json_response(self, text: str, static_findings: List[FindingResult]) -> AIReviewResponse:
        """Parse structured JSON from Groq completion."""
        clean_text = text.strip()
        if clean_text.startswith("```"):
            clean_text = re.sub(r"^```(?:json)?\s*", "", clean_text)
            clean_text = re.sub(r"\s*```$", "", clean_text)

        try:
            data = json.loads(clean_text)
        except json.JSONDecodeError:
            match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
            if match:
                data = json.loads(match.group(1))
            else:
                return AIReviewResponse(
                    summary=text,
                    risk_level="medium",
                    inline_suggestions=[],
                )

        summary = data.get("summary", "Automated code review completed via Groq AI.")
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
