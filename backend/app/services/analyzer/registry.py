import os
from typing import Dict, List, Optional
from app.services.analyzer.base import LanguageAnalyzer, FindingResult
from app.services.analyzer.python_analyzer import PythonAnalyzer
from app.services.analyzer.js_analyzer import JavaScriptAnalyzer


class AnalyzerRegistry:
    """Registry mapping file extensions to language analyzers."""

    def __init__(self):
        self._analyzers: List[LanguageAnalyzer] = [
            PythonAnalyzer(),
            JavaScriptAnalyzer(),
        ]
        self._extension_map: Dict[str, LanguageAnalyzer] = {}
        for analyzer in self._analyzers:
            for ext in analyzer.supported_extensions:
                self._extension_map[ext.lower()] = analyzer

    def get_analyzer(self, file_path: str) -> Optional[LanguageAnalyzer]:
        _, ext = os.path.splitext(file_path)
        return self._extension_map.get(ext.lower())

    def analyze_file(self, file_path: str, content: str) -> List[FindingResult]:
        analyzer = self.get_analyzer(file_path)
        if not analyzer:
            return []
        return analyzer.analyze(file_path, content)


analyzer_registry = AnalyzerRegistry()
