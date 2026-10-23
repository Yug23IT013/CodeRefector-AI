import logging
from typing import Any

logger = logging.getLogger("coderefactor.mcp.prompts")


def register_prompts(server: Any) -> None:
    """Registers CodeRefactor prompt workflows on the MCPServer instance."""

    @server.prompt("review_pr_diff")
    def review_pr_diff(diff: str, pr_title: str = "") -> str:
        """Prompt template for enterprise-grade PR review adhering to CodeRefactor AI standards."""
        title_line = f"Pull Request Title: {pr_title}\n" if pr_title else ""
        return (
            "You are CodeRefactor AI, an automated code auditor and senior software engineer.\n"
            f"{title_line}"
            "Please review the following git diff according to CodeRefactor's strict standards:\n"
            "- AST Security Checks: Check for dynamic code execution (eval/exec), hardcoded secrets/tokens, SQL injection, and insecure deserialization.\n"
            "- Bug Risks: Check for bare excepts, mutable default arguments, incorrect None equality (== vs is), generic Exception raising.\n"
            "- Performance & Maintainability: Check cyclomatic complexity, redundant imports, memory regressions.\n\n"
            "Format your review as:\n"
            "1. Executive Summary & Risk Level (low / medium / high / critical)\n"
            "2. Table of Identified Issues (File, Line, Rule ID, Severity, Description)\n"
            "3. Actionable Code Replacements for each issue\n\n"
            f"```diff\n{diff}\n```"
        )

    @server.prompt("remediate_finding")
    def remediate_finding(rule_id: str, file_path: str, code_snippet: str) -> str:
        """Prompt template to remediate a specific CodeRefactor finding with canonical fixes."""
        return (
            f"You are a remediation specialist for CodeRefactor AI.\n"
            f"A code quality/security rule violation has been flagged:\n"
            f"- Rule ID: {rule_id}\n"
            f"- File: {file_path}\n\n"
            "Flagged Code Snippet:\n"
            f"```\n{code_snippet}\n```\n\n"
            "Please provide:\n"
            "1. A clear technical explanation of the security/stability vulnerability.\n"
            "2. The recommended refactored code following canonical standards.\n"
            "3. Unit test recommendations to guard against future regressions."
        )

    @server.prompt("audit_security")
    def audit_security(repo_name: str, context: str = "") -> str:
        """Prompt template for performing an in-depth security scan of a repository."""
        context_block = f"\nAdditional Context:\n{context}\n" if context else ""
        return (
            f"You are conducting a thorough security and static analysis audit of repository '{repo_name}' using CodeRefactor AI.\n"
            f"{context_block}\n"
            "Audit Checklist:\n"
            "1. [SEC001] Dynamic Code Execution: Check for eval(), exec(), Function(), and unsanitized reflection.\n"
            "2. [SEC002] Hardcoded Secrets: Identify exposed API keys, private tokens, passwords, and connection strings.\n"
            "3. [SEC003] SQL Injection: Identify dynamic string interpolation in raw database queries.\n"
            "4. [SEC004] Insecure Deserialization: Identify unsafe pickle, marshal, or unconstrained YAML loading.\n\n"
            "Analyze the codebase against this checklist and generate a risk rating and remediation priority matrix."
        )
