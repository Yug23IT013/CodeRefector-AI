from typing import Dict, List, Optional

RULE_KNOWLEDGE_BASE: List[Dict[str, str]] = [
    {
        "rule_id": "SEC001",
        "title": "Dynamic Code Execution (eval / exec)",
        "category": "security",
        "severity": "critical",
        "description": "Dynamic execution of code strings via eval() or exec() allows arbitrary code execution. Untrusted inputs passed to eval/exec allow an attacker to escape sandbox environments, execute system commands, or access internal memory.",
        "remediation": "Replace dynamic eval/exec with safe literal parsing using ast.literal_eval() for standard Python literals, or use structured parsers like json.loads() or schema validation (e.g., Pydantic).",
        "example_bad": "result = eval(user_supplied_string)",
        "example_good": "import ast\nresult = ast.literal_eval(user_supplied_string)",
    },
    {
        "rule_id": "SEC002",
        "title": "Hardcoded Secrets & API Keys",
        "category": "security",
        "severity": "critical",
        "description": "Hardcoding API tokens, private keys, JWT secrets, or cloud credentials in source code exposes sensitive infrastructure when committed to version control systems.",
        "remediation": "Store credentials in environment variables, .env files excluded from git, or secure key management systems (AWS Secrets Manager, HashiCorp Vault). Access them via os.environ or Pydantic BaseSettings.",
        "example_bad": "API_KEY = 'dummy_secret_api_key_12345'",
        "example_good": "import os\nAPI_KEY = os.environ.get('API_KEY')",
    },
    {
        "rule_id": "SEC003",
        "title": "SQL Injection Risk (String Formatting in Queries)",
        "category": "security",
        "severity": "critical",
        "description": "Constructing SQL queries using f-strings, format(), or % string concatenation allows SQL injection attacks where unvalidated input modifies query logic.",
        "remediation": "Always use parameterized queries with bind variables (placeholders like %s, ?, or :name) provided by database drivers or ORM query abstractions (SQLAlchemy, Peewee).",
        "example_bad": "cursor.execute(f'SELECT * FROM users WHERE email = {email}')",
        "example_good": "cursor.execute('SELECT * FROM users WHERE email = %s', (email,))",
    },
    {
        "rule_id": "SEC004",
        "title": "Insecure Deserialization (pickle / unsafe YAML)",
        "category": "security",
        "severity": "critical",
        "description": "Deserializing data with pickle.loads() or unconstrained yaml.load() can instantiate arbitrary objects and execute arbitrary bytecode during deserialization.",
        "remediation": "Use safe data serialization formats like JSON, MessagePack, or Protocol Buffers. If YAML is required, always use yaml.safe_load() or specify Loader=yaml.SafeLoader.",
        "example_bad": "data = pickle.loads(raw_user_payload)",
        "example_good": "import json\ndata = json.loads(raw_user_payload)",
    },
    {
        "rule_id": "BUG001",
        "title": "Bare Exception Handling",
        "category": "bug_risk",
        "severity": "medium",
        "description": "A bare 'except:' clause intercepts all exceptions, including KeyboardInterrupt, SystemExit, and MemoryError, preventing clean application shutdown and hiding critical errors.",
        "remediation": "Catch specific exception types (e.g. ValueError, KeyError, httpx.HTTPError) or at least specify 'except Exception as exc:' to allow base system interrupts to propagate.",
        "example_bad": "try:\n    do_task()\nexcept:\n    pass",
        "example_good": "try:\n    do_task()\nexcept SpecificTaskError as e:\n    logger.warning('Task failed: %s', e)",
    },
    {
        "rule_id": "BUG002",
        "title": "Mutable Default Argument in Function Definition",
        "category": "bug_risk",
        "severity": "medium",
        "description": "Default argument expressions in Python are evaluated once at function definition time. Using mutable defaults (list, dict, set) causes state to persist across calls.",
        "remediation": "Use None as the default argument value and initialize the mutable object inside the function body.",
        "example_bad": "def append_item(val, items=[]):\n    items.append(val)\n    return items",
        "example_good": "def append_item(val, items=None):\n    if items is None:\n        items = []\n    items.append(val)\n    return items",
    },
    {
        "rule_id": "BUG003",
        "title": "Comparison with None using Equality Operator",
        "category": "style",
        "severity": "low",
        "description": "Comparing against None using '== None' or '!= None' can invoke custom __eq__ implementations and violates PEP 8 identity comparison conventions.",
        "remediation": "Always use 'is None' or 'is not None' for identity comparisons with singleton None.",
        "example_bad": "if value == None:",
        "example_good": "if value is None:",
    },
    {
        "rule_id": "BUG004",
        "title": "Generic Exception Raising",
        "category": "bug_risk",
        "severity": "medium",
        "description": "Raising generic 'raise Exception()' obscures the failure reason from callers and makes precise error handling impossible upstream.",
        "remediation": "Define and raise custom domain exceptions or use specific built-in standard exceptions like ValueError, TypeError, or RuntimeError.",
        "example_bad": "if not valid:\n    raise Exception('Invalid input')",
        "example_good": "if not valid:\n    raise ValueError('Invalid user payload: email is required')",
    },
    {
        "rule_id": "PERF001",
        "title": "High Cyclomatic Complexity",
        "category": "performance",
        "severity": "medium",
        "description": "Functions with high cyclomatic complexity (> 10) have excessive branching, nested loops, and conditional logic. They are hard to test, error-prone, and slow to maintain.",
        "remediation": "Decompose complex functions into smaller focused helper functions, leverage polymorphism, or use dispatch dictionaries to flatten execution flow.",
        "example_bad": "def deeply_nested_processor(data):\n    # 15 nested if/else and loop conditions",
        "example_good": "def clean_processor(data):\n    # Broken into validate_data(), transform_data(), format_output()",
    },
    {
        "rule_id": "PERF002",
        "title": "Unused Import Statement",
        "category": "performance",
        "severity": "low",
        "description": "Importing modules that are never referenced bloats namespace, adds unnecessary module loading overhead at startup, and degrades code clarity.",
        "remediation": "Remove unused import statements or use linters like autoflake / ruff to clean up imports automatically.",
        "example_bad": "import math\n# math is never used anywhere in file",
        "example_good": "# Remove the unused 'import math' line",
    },
    {
        "rule_id": "JS_SEC001",
        "title": "JavaScript Dynamic Code Execution (eval)",
        "category": "security",
        "severity": "critical",
        "description": "Calling eval() or new Function() in JavaScript/TypeScript executes arbitrary strings in the browser or Node.js runtime, opening severe Cross-Site Scripting (XSS) or RCE vulnerabilities.",
        "remediation": "Parse data strictly using JSON.parse() or dedicated parser libraries without dynamic code execution.",
        "example_bad": "const userConfig = eval('(' + req.body.config + ')');",
        "example_good": "const userConfig = JSON.parse(req.body.config);",
    },
    {
        "rule_id": "JS_SEC004",
        "title": "Unsafe innerHTML Assignment (DOM XSS)",
        "category": "security",
        "severity": "high",
        "description": "Directly assigning user-controlled strings to element.innerHTML creates Cross-Site Scripting (XSS) vulnerabilities.",
        "remediation": "Use textContent, innerText, or sanitize HTML using DOMPurify before inserting it into the DOM.",
        "example_bad": "container.innerHTML = '<div>' + userBio + '</div>';",
        "example_good": "container.textContent = userBio;",
    },
    {
        "rule_id": "JS_SEC005",
        "title": "Hardcoded Credential in Frontend / Node Source",
        "category": "security",
        "severity": "high",
        "description": "Hardcoding secrets or private tokens in client-side JavaScript or TypeScript makes them publicly visible to anyone inspecting browser network bundles.",
        "remediation": "Never bundle private keys or backend secrets in client builds. Use secure HTTP-only cookies or environment variables on the backend.",
        "example_bad": "const stripeKey = 'api_key_mock_secret_token_12345';",
        "example_good": "const response = await fetch('/api/checkout-session');",
    },
]


def get_all_rules_knowledge() -> List[Dict[str, str]]:
    """Returns the full rule knowledge base."""
    return RULE_KNOWLEDGE_BASE


def get_rule_knowledge(rule_id: str) -> Optional[Dict[str, str]]:
    """Look up rule documentation by rule ID."""
    clean_id = rule_id.strip().upper()
    for rule in RULE_KNOWLEDGE_BASE:
        if rule["rule_id"].upper() == clean_id:
            return rule
    return None
