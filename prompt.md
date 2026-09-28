# Project: CodeRefactor AI — Automated PR Review & Analysis Platform

## Context
Build the MVP core of an automated code review platform that hooks into GitHub
pull requests, runs static + AI-driven analysis, and posts review comments
back to the PR. This is Phase 1 of a larger system — build it production-lean,
modular, and easy to extend later (I will add sandboxed execution benchmarking
and a full analytics dashboard in Phase 2, so design interfaces/abstractions
with that in mind, but do NOT build the sandbox/benchmarking system now).

## Tech stack (use these unless you have a strong reason not to — ask first if so)
- Backend: Python 3.11+, FastAPI
- DB: PostgreSQL (SQLAlchemy + Alembic migrations); SQLite fallback for local dev
- Queue/async jobs: simple background tasks via FastAPI BackgroundTasks or Celery+Redis if complexity warrants it — your call, explain the tradeoff
- GitHub integration: PyGithub or raw REST calls + webhook signature verification
- AST/static analysis: Python `ast` module for Python files; for JS/TS use an
  existing parser via subprocess (e.g. `@babel/parser` through a small Node
  helper script, or `esprima` if simpler) — pick one and justify it
- AI review layer: Anthropic Claude API (use a clean abstraction/service class
  so the model or prompt can be swapped later)
- Frontend dashboard: React + TypeScript + Vite, Tailwind for styling
- Containerization: Dockerfile + docker-compose for local dev (API + DB only —
  NOT the sandboxing feature)

## Scope for this build (build these fully)
1. **GitHub Webhook Intake**
   - Endpoint to receive `pull_request` events (opened, synchronize)
   - Verify webhook signature (HMAC secret from env var)
   - Fetch the PR's changed files/diff via GitHub API
   - Persist PR metadata (repo, PR number, author, files changed, commit SHA) to DB

2. **Static Analysis Engine**
   - AST-based parser for at least Python, with a pluggable interface so
     other languages can be added later
   - A small rule engine: 8–12 concrete rules covering common anti-patterns
     and security smells (e.g. bare except, eval/exec usage, SQL string
     concatenation, hardcoded secrets/credentials, mutable default args,
     unused imports, overly complex functions/cyclomatic complexity threshold)
   - Each rule outputs: file, line number, severity, message, rule ID

3. **AI-Driven Review Layer**
   - Given the diff + static analysis findings, call Claude API to generate:
     - A short natural-language summary of the PR's risk/quality
     - Specific inline suggestions/fixes for flagged issues (concrete code,
       not vague advice)
   - Structure the prompt so findings + surrounding code context are passed in;
     parse the model's response into structured comment objects (file, line, body)

4. **GitHub Comment Posting**
   - Post the AI summary as a top-level PR comment
   - Post individual findings as inline review comments on the correct file/line
   - Avoid duplicate comments on re-runs (track which findings were already posted)

5. **Data Layer & Basic Dashboard**
   - DB schema: repos, pull_requests, reviews, findings
   - REST API endpoints to list reviewed PRs, view findings per PR, and basic
     per-repo stats (finding counts by severity/category over time)
   - React dashboard: repo list → PR list → PR detail view showing findings
     with severity badges. Keep it clean but simple — no charts/trends yet.

## Explicitly OUT of scope (do not build, but leave clean extension points)
- Docker sandbox execution / runtime benchmarking (time & memory profiling)
- Historical trend charts / repo health scoring algorithms
- Multi-language support beyond Python (+ one other language if time allows)
- Auth/user management beyond a single API token for the dashboard
- CI/CD deployment configs (just Dockerfile + docker-compose is enough)

## Deliverables & working style
- Set up the repo structure first and show it to me before writing business logic
- Use environment variables for all secrets (GitHub webhook secret, GitHub
  App/PAT token, Anthropic API key) — provide a `.env.example`
- Write this incrementally: webhook intake → static analysis → AI review →
  GitHub posting → data layer → dashboard. Confirm each stage works
  (or show me how to test it) before moving to the next.
- Include a README with setup steps, how to configure a GitHub webhook against
  this service (e.g. via smee.io or ngrok for local dev), and how to run
  the rule engine's test suite
- Write unit tests for the rule engine and the webhook signature verification
  at minimum
- Ask me clarifying questions before making irreversible architectural choices
  (e.g. Celery vs BackgroundTasks, which JS parser) rather than guessing silently