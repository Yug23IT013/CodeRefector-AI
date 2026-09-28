from app.core.config import settings
from app.services.ai.base import BaseAIService, AIReviewResponse, AIInlineSuggestion
from app.services.ai.groq_service import GroqReviewService
from app.services.ai.mock_service import MockReviewService


def get_ai_service() -> BaseAIService:
    """Returns GroqReviewService if GROQ_API_KEY configured, otherwise MockReviewService."""
    if settings.GROQ_API_KEY and len(settings.GROQ_API_KEY.strip()) > 5:
        return GroqReviewService()
    return MockReviewService()


__all__ = [
    "BaseAIService",
    "AIReviewResponse",
    "AIInlineSuggestion",
    "GroqReviewService",
    "MockReviewService",
    "get_ai_service",
]
