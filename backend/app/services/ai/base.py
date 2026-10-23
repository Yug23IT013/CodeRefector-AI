from abc import ABC, abstractmethod
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from app.services.analyzer.base import FindingResult


class AIInlineSuggestion(BaseModel):
    file_path: str
    line_number: int = 1
    suggestion_code: str
    explanation: str
    rule_id: Optional[str] = None


class AIReviewResponse(BaseModel):
    summary: str
    risk_level: Literal["low", "medium", "high", "critical"] = "medium"
    inline_suggestions: List[AIInlineSuggestion] = Field(default_factory=list)


class BaseAIService(ABC):
    """Abstract interface for AI review providers (e.g. Claude, Mock)."""

    @abstractmethod
    def generate_review(
        self,
        pr_title: str,
        pr_author: str,
        diff: str,
        static_findings: List[FindingResult],
        file_contents: Optional[dict[str, str]] = None,
        rag_context: Optional[str] = None,
    ) -> AIReviewResponse:
        """Generate PR review summary and targeted inline fix suggestions with optional RAG context."""
        pass
