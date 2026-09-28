import ast
import re
from typing import List, Set, Dict, Any, Optional
from app.services.analyzer.base import LanguageAnalyzer, FindingResult


class CyclomaticComplexityVisitor(ast.NodeVisitor):
    """Calculates cyclomatic complexity for a given AST node."""
    def __init__(self):
        self.complexity = 1

    def visit_If(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_For(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_While(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_ExceptHandler(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_With(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_AsyncWith(self, node):
        self.complexity += 1
        self.generic_visit(node)

    def visit_BoolOp(self, node):
        # Each boolean branch (and, or) adds a decision path
        self.complexity += len(node.values) - 1
        self.generic_visit(node)

    def visit_IfExp(self, node):
        self.complexity += 1
        self.generic_visit(node)


class PythonASTVisitor(ast.NodeVisitor):
    """Visits Python AST to identify anti-patterns, security risks, and code smells."""

    SECRET_VAR_PATTERN = re.compile(
        r"^(.*_)?(api[_-]?key|secret[_-]?key|secret|password|token|auth|private[_-]?key|aws_access_key_id|access[_-]?key|stripe[_-]?key|key)$",
        re.IGNORECASE
    )
    SECRET_VAL_PREFIXES = (
        "ghp_", "ghs_", "ghr_",        # GitHub tokens
        "sk-", "sk_live_", "sk_test_",  # OpenAI / Stripe secret keys
        "pk_live_", "pk_test_",          # Stripe public keys (still sensitive)
        "AKIA", "ASIA",                  # AWS access keys
        "glpat-",                        # GitLab PATs
        "xoxb-", "xoxp-", "xoxr-",      # Slack tokens
        "ya29.",                          # Google OAuth tokens
        "ey",                            # JWTs (base64 header)
    )

    def __init__(self, file_path: str, lines: List[str]):
        self.file_path = file_path
        self.lines = lines
        self.findings: List[FindingResult] = []
        self.imported_names: Dict[str, int] = {}  # alias/name -> lineno
        self.used_names: Set[str] = set()
        # Maps variable name -> line number where it was assigned a tainted SQL string.
        # Used for two-pass SQL injection detection (catches `query = f"..."; cursor.execute(query)`).
        self._tainted_sql_vars: Dict[str, int] = {}

    def _get_snippet(self, lineno: int) -> Optional[str]:
        if 1 <= lineno <= len(self.lines):
            return self.lines[lineno - 1].strip()
        return None

    def visit_Name(self, node: ast.Name):
        if isinstance(node.ctx, ast.Load):
            self.used_names.add(node.id)
        self.generic_visit(node)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            lookup = alias.asname or alias.name.split(".")[0]
            self.imported_names[lookup] = node.lineno
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        for alias in node.names:
            if alias.name == "*":
                continue
            lookup = alias.asname or alias.name
            self.imported_names[lookup] = node.lineno
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        # Rule SEC001: eval/exec dynamic execution
        func_name = None
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        if func_name in ("eval", "exec"):
            self.findings.append(FindingResult(
                file_path=self.file_path,
                line_number=node.lineno,
                rule_id="SEC001",
                severity="critical",
                category="security",
                message=f"Avoid dynamic code execution via {func_name}(), which allows arbitrary code execution.",
                code_snippet=self._get_snippet(node.lineno),
            ))

        # Rule SEC004: Insecure deserialization (pickle or yaml)
        if isinstance(node.func, ast.Attribute):
            attr = node.func.attr
            obj_name = getattr(node.func.value, "id", None) if isinstance(node.func.value, ast.Name) else None

            if obj_name == "pickle" and attr in ("loads", "load"):
                self.findings.append(FindingResult(
                    file_path=self.file_path,
                    line_number=node.lineno,
                    rule_id="SEC004",
                    severity="critical",
                    category="security",
                    message="pickle.loads() can execute arbitrary code on untrusted input. Use JSON or safe serialization.",
                    code_snippet=self._get_snippet(node.lineno),
                ))
            elif obj_name == "yaml" and attr == "load":
                has_safe_loader = any(
                    kw.arg == "Loader" and "SafeLoader" in getattr(kw.value, "id", "")
                    for kw in node.keywords
                )
                if not has_safe_loader:
                    self.findings.append(FindingResult(
                        file_path=self.file_path,
                        line_number=node.lineno,
                        rule_id="SEC004",
                        severity="high",
                        category="security",
                        message="yaml.load() without SafeLoader is vulnerable to arbitrary object instantiation. Use yaml.safe_load().",
                        code_snippet=self._get_snippet(node.lineno),
                    ))

        # Rule SEC003: SQL string concatenation / formatting
        if isinstance(node.func, ast.Attribute) and node.func.attr in ("execute", "executemany"):
            if node.args:
                first_arg = node.args[0]
                is_sql_injection_risk = False
                tainted_line = node.lineno  # default: flag the execute() call line

                # Case A: inline f-string / format / concat directly inside execute()
                if isinstance(first_arg, ast.JoinedStr):
                    is_sql_injection_risk = True
                elif isinstance(first_arg, ast.BinOp) and isinstance(first_arg.op, (ast.Add, ast.Mod)):
                    is_sql_injection_risk = True
                elif (isinstance(first_arg, ast.Call)
                      and isinstance(first_arg.func, ast.Attribute)
                      and first_arg.func.attr == "format"):
                    is_sql_injection_risk = True

                # Case B: variable reference — check if the variable was tainted
                # earlier (e.g. `query = f"..."` then `cursor.execute(query)`).
                elif isinstance(first_arg, ast.Name):
                    if first_arg.id in self._tainted_sql_vars:
                        is_sql_injection_risk = True
                        tainted_line = self._tainted_sql_vars[first_arg.id]

                if is_sql_injection_risk:
                    self.findings.append(FindingResult(
                        file_path=self.file_path,
                        line_number=tainted_line,
                        rule_id="SEC003",
                        severity="critical",
                        category="security",
                        message="SQL Injection risk: SQL query built with string formatting instead of parameterized queries. Use placeholders (?) or ORM.",
                        code_snippet=self._get_snippet(tainted_line),
                    ))

        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign):
        # Rule SEC002: Hardcoded secrets detection
        for target in node.targets:
            var_name = getattr(target, "id", None)
            if var_name and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                val = node.value.value
                # Check variable name heuristic or explicit secret prefix in value
                is_secret_name = bool(self.SECRET_VAR_PATTERN.match(var_name))
                has_secret_prefix = any(val.startswith(p) for p in self.SECRET_VAL_PREFIXES)

                if (is_secret_name and len(val) >= 8 and not val.startswith("${") and not val.startswith("env:")) or has_secret_prefix:
                    self.findings.append(FindingResult(
                        file_path=self.file_path,
                        line_number=node.lineno,
                        rule_id="SEC002",
                        severity="critical",
                        category="security",
                        message=f"Hardcoded secret detected in variable '{var_name}'. Store credentials in environment variables or a secrets manager.",
                        code_snippet=self._get_snippet(node.lineno),
                    ))

        # Two-pass SQL injection: track variables assigned tainted SQL strings so
        # that `cursor.execute(query)` is caught even when the f-string is built
        # in a separate assignment statement (not inline in the execute() call).
        if len(node.targets) == 1:
            var_name = getattr(node.targets[0], "id", None)
            if var_name:
                value = node.value
                is_tainted = (
                    isinstance(value, ast.JoinedStr)  # f-string
                    or (isinstance(value, ast.BinOp) and isinstance(value.op, (ast.Add, ast.Mod)))
                    or (isinstance(value, ast.Call)
                        and isinstance(value.func, ast.Attribute)
                        and value.func.attr == "format")
                )
                if is_tainted:
                    self._tainted_sql_vars[var_name] = node.lineno

        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        # Rule BUG001: Bare except
        if node.type is None:
            self.findings.append(FindingResult(
                file_path=self.file_path,
                line_number=node.lineno,
                rule_id="BUG001",
                severity="medium",
                category="bug_risk",
                message="Avoid bare 'except:'. Catch specific exceptions instead to prevent catching KeyboardInterrupt or SystemExit.",
                code_snippet=self._get_snippet(node.lineno),
            ))
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._check_function(node)
        self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._check_function(node)
        self.generic_visit(node)

    def _check_function(self, node):
        # Rule BUG002: Mutable default arguments
        for default in node.args.defaults + node.args.kw_defaults:
            if default is not None and isinstance(default, (ast.List, ast.Dict, ast.Set)):
                self.findings.append(FindingResult(
                    file_path=self.file_path,
                    line_number=default.lineno,
                    rule_id="BUG002",
                    severity="medium",
                    category="bug_risk",
                    message=f"Mutable default argument in function '{node.name}'. Use 'None' as default and initialize inside function.",
                    code_snippet=self._get_snippet(default.lineno),
                ))

        # Rule PERF001: Cyclomatic complexity threshold (> 10)
        calc = CyclomaticComplexityVisitor()
        calc.visit(node)
        if calc.complexity > 10:
            self.findings.append(FindingResult(
                file_path=self.file_path,
                line_number=node.lineno,
                rule_id="PERF001",
                severity="medium",
                category="performance",
                message=f"Function '{node.name}' has high cyclomatic complexity ({calc.complexity} > threshold 10). Consider refactoring.",
                code_snippet=self._get_snippet(node.lineno),
            ))

    def visit_Compare(self, node: ast.Compare):
        # Rule BUG003: Comparison using == None or != None
        for op, comparator in zip(node.ops, node.comparators):
            if isinstance(comparator, ast.Constant) and comparator.value is None:
                if isinstance(op, (ast.Eq, ast.NotEq)):
                    op_str = "==" if isinstance(op, ast.Eq) else "!="
                    better_op = "is None" if isinstance(op, ast.Eq) else "is not None"
                    self.findings.append(FindingResult(
                        file_path=self.file_path,
                        line_number=node.lineno,
                        rule_id="BUG003",
                        severity="low",
                        category="style",
                        message=f"Comparison with None using '{op_str}'. Use '{better_op}' instead.",
                        code_snippet=self._get_snippet(node.lineno),
                    ))
        self.generic_visit(node)

    def visit_Raise(self, node: ast.Raise):
        # Rule BUG004: Generic raise Exception
        if node.exc:
            is_generic = False
            if isinstance(node.exc, ast.Call) and isinstance(node.exc.func, ast.Name):
                if node.exc.func.id in ("Exception", "BaseException"):
                    is_generic = True
            elif isinstance(node.exc, ast.Name) and node.exc.id in ("Exception", "BaseException"):
                is_generic = True

            if is_generic:
                self.findings.append(FindingResult(
                    file_path=self.file_path,
                    line_number=node.lineno,
                    rule_id="BUG004",
                    severity="medium",
                    category="bug_risk",
                    message="Raising generic 'Exception'. Define and raise specific, meaningful exception classes.",
                    code_snippet=self._get_snippet(node.lineno),
                ))
        self.generic_visit(node)


class PythonAnalyzer(LanguageAnalyzer):
    """Analyzes Python code using the standard library ast module."""

    @property
    def supported_extensions(self) -> List[str]:
        return [".py"]

    def analyze(self, file_path: str, content: str) -> List[FindingResult]:
        try:
            tree = ast.parse(content, filename=file_path)
        except SyntaxError as e:
            return [
                FindingResult(
                    file_path=file_path,
                    line_number=e.lineno or 1,
                    rule_id="SYN001",
                    severity="critical",
                    category="bug_risk",
                    message=f"Python syntax error: {e.msg}",
                    code_snippet=e.text.strip() if e.text else None,
                )
            ]

        lines = content.splitlines()
        visitor = PythonASTVisitor(file_path=file_path, lines=lines)
        visitor.visit(tree)

        # Rule PERF002: Unused imports (exclude __init__.py files)
        if not file_path.endswith("__init__.py"):
            for imported_name, lineno in visitor.imported_names.items():
                if imported_name not in visitor.used_names:
                    visitor.findings.append(FindingResult(
                        file_path=file_path,
                        line_number=lineno,
                        rule_id="PERF002",
                        severity="low",
                        category="performance",
                        message=f"Import '{imported_name}' is imported but never used.",
                        code_snippet=visitor._get_snippet(lineno),
                    ))

        # Sort findings by line number
        visitor.findings.sort(key=lambda x: x.line_number)
        return visitor.findings
