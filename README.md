# CodeRefactor AI — Automated PR Review & Analysis Platform

An automated code review, static analysis, and sandboxed runtime performance profiling platform designed to integrate seamlessly with GitHub Pull Requests. It combines AST-based static analysis rule checking (Python & JS/TS) with Groq Cloud LLM code reviews to post actionable, inline suggestions directly back to pull requests while preventing duplicate comments and profiling execution time & memory footprint.

---

## Architecture Overview

```
                 GitHub Webhook Event (PR opened / synchronize)
                                      │
                                      ▼
                       FastAPI Webhook Intake (Port 8000)
                         [HMAC-SHA256 Signature Verification]
                                      │
                         (Enqueues Background Review Task)
                                      │
                                      ▼
                         Review Orchestration Service
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
             Python AST Rule Engine         @babel/parser JS Engine
             (10 Security/Bug Rules)        (JS/TS Security Smells)
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                      RAG Vector Knowledge Base
              [ChromaDB / Lightweight Vector Index]
              ├─ Authoritative Rule Standards (SEC001-PERF002)
              ├─ Historical PR Code Precedents & Fixes
              └─ Semantic Retrieval (all-MiniLM-L6-v2)
                                      │
                                      ▼
                          AI Review Layer (Groq Cloud)
                    [Llama 3.3 70B / Llama 3.1 8B Free Tier]
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
            GitHub Posting & Deduplication   Sandboxed Performance Profiler
            ├─ Top-level Executive Summary   ├─ Base vs PR Latency (ms)
            └─ Targeted Inline Suggestions   └─ Peak Memory Allocation (MB)
                         │                         │
                         └────────────┬────────────┘
                                      ▼
                           Relational Data Layer
                    (PostgreSQL / SQLite via SQLAlchemy)
                                      │
                                      ▼
                          React Dashboard (Vite + TS)
            (Repo list → PR list → Detailed Findings & Quality Trends → RAG Knowledge Base)
```

---

## Features

- **GitHub Webhook Verification**: Constant-time HMAC-SHA256 signature verification matching GitHub's `X-Hub-Signature-256` header.
- **AST-Based Static Analysis (Python)**:
  - `SEC001`: Dynamic execution detection (`eval()`, `exec()`).
  - `SEC002`: Hardcoded secret and credential token detection.
  - `SEC003`: SQL string formatting / concatenation injection risks.
  - `SEC004`: Insecure deserialization (`pickle.loads`, unsafe YAML).
  - `BUG001`: Bare `except:` catch-all clauses.
  - `BUG002`: Mutable default arguments in functions (`def f(x=[])`).
  - `BUG003`: None comparisons using `==` instead of `is`.
  - `BUG004`: Generic `raise Exception` anti-pattern.
  - `PERF001`: High cyclomatic complexity calculation (> 10 threshold).
  - `PERF002`: Unused imports detection.
- **AST-Based Static Analysis (JS/TS)**:
  - Subprocess parser powered by `@babel/parser` with regex fallbacks for `eval`, `Function()`, `document.write`, and `innerHTML` XSS sinks.
- **Retrieval-Augmented Generation (RAG) Architecture**:
  - **Vector Knowledge Base**: Backed by ChromaDB and SentenceTransformer embeddings (`all-MiniLM-L6-v2`) with zero-downtime lightweight cosine similarity fallback.
  - **Authoritative Rule Standards**: Embedded rule specifications, vulnerability impact assessments, and canonical bad vs. good code fixes.
  - **Historical Code Precedent Memory**: Automatically indexes resolved review findings and AI suggestions, retrieving prior accepted solutions when recurring patterns are flagged.
  - **Interactive RAG Explorer**: Dedicated `/rag` dashboard page featuring natural-language semantic query search and interactive rule catalog with code snippet copy.
  - **In-Context Finding Badges**: Interactive `RAG Insights` drawer directly inside finding cards showing similarity percentages and project precedents.
- **Groq Free Cloud AI Review Layer**:
  - Powered by free tier models (`llama-3.3-70b-versatile` or `llama-3.1-8b-instant`) with native structured JSON output and RAG grounding.
  - Contextual executive summary highlighting risk ratings (`low`, `medium`, `high`, `critical`).
  - Concrete inline code replacement suggestions for flagged lines.
  - Offline/Mock mode fallback when no API key is set.
- **Deduplication Engine**:
  - SHA256 content hashing prevents redundant review comments upon PR re-synchronize events.
- **Performance & Memory Benchmarking Sandbox**:
  - Isolated runtime profiling measuring base branch vs. PR branch execution latency (ms) and peak memory consumption (MB RSS).
  - Automatic regression detection flags performance degradations (>10% latency or >15% memory increases).
  - Granular micro-benchmark suite tables and historical benchmark trajectory charts.
- **Quality Trends & Analytics Dashboard**:
  - Repository Health Score calculation (0–100) based on severity density and resolution trends.
  - Interactive SVG time-series area/line charts tracking critical, high, medium, and low findings across pull requests.
  - Category distribution breakdowns (Security, Bug Risk, Performance, Style).

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

---

### 1. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Fill in your configuration in `.env`:

```ini
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
DEBUG=True

# SQLite (default for local dev) or PostgreSQL
DATABASE_URL=sqlite:///./coderefactor.db

# GitHub Webhook Secret (configured in your GitHub repository webhook settings)
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret_here

# GitHub Token for fetching PR diffs and posting review comments
GITHUB_TOKEN=ghp_your_github_personal_access_token_here

# Free Groq API Key from: https://console.groq.com/keys
GROQ_API_KEY=gsk_your_free_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Dashboard Authentication & GitHub OAuth (Optional)
JWT_SECRET=coderefactor-jwt-secret-key-development
FRONTEND_URL=http://localhost:5173
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

*(Note: If `GROQ_API_KEY` is omitted, the service gracefully runs in deterministic mock mode for local offline testing).*

---

### 2. Run Backend (FastAPI)

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend API is available at `http://localhost:8000`.
- Health Check: `http://localhost:8000/health`
- Interactive Swagger API Docs: `http://localhost:8000/docs`

---

### 3. Run Frontend Dashboard (React + Vite)

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The dashboard will open at `http://localhost:5173`.

---

## Docker Compose (Full Stack with PostgreSQL)

To start both the FastAPI backend and PostgreSQL 16 in containers:

```bash
docker-compose up --build
```

This provisions:
- PostgreSQL database on port `5432`
- FastAPI backend on port `8000`

---

## Setting Up GitHub Webhook for Local Testing

To receive real GitHub webhook events locally:

### Option A: Using Smee.io (Recommended by GitHub)
1. Go to [https://smee.io](https://smee.io) and click **"Start a new channel"**. Copy your Smee webhook URL.
2. In your GitHub repository:
   - Navigate to **Settings** → **Webhooks** → **Add webhook**.
   - **Payload URL**: Paste your Smee URL (e.g. `https://smee.io/abc123xyz`).
   - **Content type**: `application/json`.
   - **Secret**: Enter the secret you configured in `GITHUB_WEBHOOK_SECRET`.
   - **Which events**: Select **Let me select individual events** → Check **Pull requests**.
3. Install and run the Smee client locally:
   ```bash
   npm install --global smee-client
   smee --url https://smee.io/abc123xyz --target http://localhost:8000/api/v1/webhooks/github
   ```

### Option B: Using Ngrok
1. Run ngrok tunnel on port 8000:
   ```bash
   ngrok http 8000
   ```
2. Set the GitHub Webhook Payload URL to:
   ```
   https://<your-ngrok-subdomain>.ngrok-free.app/api/v1/webhooks/github
   ```

---

## Running Test Suite

Run the full pytest suite covering webhook signature verification, static analysis rules, AI mock layer, orchestrator execution, analytics trends, and performance benchmarking:

```bash
cd backend
pytest -v
```

To run individual test modules:
```bash
# Static analysis AST engine tests
pytest backend/tests/test_python_analyzer.py -v

# Analytics & Benchmark tests
pytest backend/tests/test_analytics_and_benchmarks.py -v

# Webhook security tests
pytest backend/tests/test_webhook_security.py -v
```

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Webhook, Repos, PRs, Findings, Analytics & Benchmark endpoints
│   │   ├── core/            # Config, HMAC verification, auth & security
│   │   ├── db/              # SQLAlchemy models (User, Repo, PR, ReviewRun, Finding, BenchmarkRun)
│   │   ├── services/
│   │   │   ├── analyzer/    # Python & JS AST static rule engine
│   │   │   ├── ai/          # Groq Cloud LLM, Claude API & Mock service layer
│   │   │   ├── github_service.py # GitHub REST diff & review comments
│   │   │   └── orchestrator.py   # Review & static analysis workflow
│   │   └── scripts/         # @babel/parser Node.js helper
│   ├── tests/               # Pytest unit & integration test suite (23 passing tests)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/      # UI badges, finding cards, navbar, modals
│   │   │   ├── analytics/   # TrendLineChart, HealthScoreGauge, CategoryDistribution
│   │   │   └── benchmarks/  # BenchmarkComparisonCard, BenchmarkTrendsChart
│   │   ├── pages/           # LandingPage, RepoListPage, PRListPage, PRDetailPage
│   │   └── services/        # Backend API client
│   ├── package.json
│   └── vite.config.ts
├── scripts/                 # Simulation, PR inspection, and demo seeding helpers
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## License

MIT License. Built for modern software engineering teams.
