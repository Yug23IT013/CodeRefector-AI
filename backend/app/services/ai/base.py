from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional
from app.services.analyzer.base import FindingResult


@dataclass
class AIInlineSuggestion:
    file_path: str
    line_number: int
    suggestion_code: str
    explanation: str
    rule_id: Optional[str] = None


@dataclass
class AIReviewResponse:
    summary: str
    risk_level: str  # "low", "medium", "high", "critical"
    inline_suggestions: List[AIInlineSuggestion] = field(default_factory=list)


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
