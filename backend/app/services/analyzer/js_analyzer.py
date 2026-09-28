import json
import os
import re
import subprocess
from pathlib import Path
from typing import List
from app.services.analyzer.base import LanguageAnalyzer, FindingResult


class JavaScriptAnalyzer(LanguageAnalyzer):
    """Analyzes JS and TS code using Node.js helper with @babel/parser, with fallback."""

    def __init__(self):
        # Locate the parse_js.js helper script
        current_dir = Path(__file__).resolve().parent
        self.script_path = current_dir.parent.parent / "scripts" / "parse_js.js"

    @property
    def supported_extensions(self) -> List[str]:
        return [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]

    def analyze(self, file_path: str, content: str) -> List[FindingResult]:
        if not content.strip():
            return []

        # Attempt to run Node helper
        if self.script_path.exists():
            try:
                proc = subprocess.run(
                    ["node", str(self.script_path), file_path],
                    input=content,
                    text=True,
                    capture_output=True,
                    timeout=15,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    raw_findings = json.loads(proc.stdout)
                    lines = content.splitlines()
                    findings = []
                    for item in raw_findings:
                        lineno = item.get("line_number", 1)
                        snippet = lines[lineno - 1].strip() if 1 <= lineno <= len(lines) else None
                        findings.append(FindingResult(
                            file_path=item.get("file_path", file_path),
                            line_number=lineno,
                            rule_id=item.get("rule_id", "JS_GENERAL"),
                            severity=item.get("severity", "medium"),
                            category=item.get("category", "general"),
                            message=item.get("message", ""),
                            code_snippet=snippet,
                        ))
                    return findings
            except Exception:
                pass  # Fallback below

        # Fallback to regex analysis if Node or Babel unavailable
        return self._regex_fallback(file_path, content)

    def _regex_fallback(self, file_path: str, content: str) -> List[FindingResult]:
        findings: List[FindingResult] = []
        lines = content.splitlines()
        secret_pattern = re.compile(
            r"""(?:api[_-]?key|secret|password|token|auth)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']""",
            re.IGNORECASE,
        )

        for idx, line in enumerate(lines):
            line_no = idx + 1
            if re.search(r"\beval\s*\(", line):
                findings.append(FindingResult(
                    file_path=file_path,
                    line_number=line_no,
                    rule_id="JS_SEC001",
                    severity="critical",
                    category="security",
                    message="Avoid dynamic code execution via eval(), which introduces Remote Code Execution vulnerabilities.",
                    code_snippet=line.strip(),
                ))
            if re.search(r"\bdebugger\b", line):
                findings.append(FindingResult(
                    file_path=file_path,
                    line_number=line_no,
                    rule_id="JS_BUG001",
                    severity="low",
                    category="style",
                    message="Found debugger statement leftover from debugging. Remove before merging.",
                    code_snippet=line.strip(),
                ))
            if ".innerHTML" in line and "=" in line:
                findings.append(FindingResult(
                    file_path=file_path,
                    line_number=line_no,
                    rule_id="JS_SEC004",
                    severity="high",
                    category="security",
                    message="Direct assignment to innerHTML can lead to Cross-Site Scripting (XSS).",
                    code_snippet=line.strip(),
                ))
            if secret_pattern.search(line):
                findings.append(FindingResult(
                    file_path=file_path,
                    line_number=line_no,
                    rule_id="JS_SEC005",
                    severity="high",
                    category="security",
                    message="Possible hardcoded credential token detected in source code.",
                    code_snippet=line.strip(),
                ))

        return findings
