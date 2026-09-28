from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class FindingResult:
    file_path: str
    line_number: int
    rule_id: str
    severity: str  # "critical", "high", "medium", "low"
    category: str  # "security", "bug_risk", "performance", "style"
    message: str
    code_snippet: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "category": self.category,
            "message": self.message,
            "code_snippet": self.code_snippet,
        }


class LanguageAnalyzer(ABC):
    """Abstract base class for language-specific static AST analyzers."""

    @property
    @abstractmethod
    def supported_extensions(self) -> List[str]:
        """List of file extensions handled by this analyzer (e.g. ['.py'])."""
        pass

    @abstractmethod
    def analyze(self, file_path: str, content: str) -> List[FindingResult]:
        """Parse content and return list of static analysis findings."""
        pass
