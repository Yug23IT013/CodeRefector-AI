import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.mcp.server import mcp_server
from app.db.models import Repository, PullRequest, ReviewRun, Finding
from contextlib import contextmanager
import app.mcp.tools as mcp_tools
import app.mcp.resources as mcp_resources


@pytest.fixture(autouse=True)
def patch_mcp_session(monkeypatch, db_session):
    @contextmanager
    def mock_get_session():
        yield db_session

    monkeypatch.setattr(mcp_tools, "get_session", mock_get_session)
    monkeypatch.setattr(mcp_resources, "get_session", mock_get_session)


@pytest.fixture
def test_repo_and_pr(db_session):
    repo = Repository(
        full_name="test-org/mcp-sample-repo",
        default_branch="main",
    )
    db_session.add(repo)
    db_session.commit()
    db_session.refresh(repo)

    pr = PullRequest(
        repo_id=repo.id,
        pr_number=101,
        title="feat: Add MCP integration",
        author="alice",
        head_sha="abcdef1234567890abcdef1234567890abcdef12",
        status="open",
    )
    db_session.add(pr)
    db_session.commit()
    db_session.refresh(pr)

    review = ReviewRun(
        pr_id=pr.id,
        commit_sha=pr.head_sha,
        status="completed",
        ai_summary="Clean PR with 1 minor security issue.",
    )
    db_session.add(review)
    db_session.commit()
    db_session.refresh(review)

    finding = Finding(
        review_run_id=review.id,
        file_path="main.py",
        line_number=10,
        rule_id="SEC001",
        severity="critical",
        category="security",
        message="Dynamic eval execution detected.",
    )
    db_session.add(finding)
    db_session.commit()

    return repo, pr


@pytest.mark.asyncio
async def test_mcp_tools_registration():
    tools = await mcp_server.list_tools()
    tool_names = [t.name for t in tools]
    assert "analyze_code_snippet" in tool_names
    assert "query_rag_knowledge" in tool_names
    assert "explain_rule" in tool_names
    assert "get_repo_health" in tool_names
    assert "get_pr_findings" in tool_names
    assert "run_review_on_diff" in tool_names
    assert "get_benchmark_metrics" in tool_names


@pytest.mark.asyncio
async def test_mcp_tool_analyze_code_snippet():
    bad_code = "def vulnerable(x):\n    return eval(x)\n"
    res = await mcp_server.call_tool("analyze_code_snippet", {"file_path": "security_test.py", "code": bad_code})
    assert res is not None
    assert not res.is_error
    assert len(res.content) > 0
    assert "SEC001" in res.content[0].text


@pytest.mark.asyncio
async def test_mcp_tool_query_rag():
    res = await mcp_server.call_tool("query_rag_knowledge", {"query": "eval arbitrary code", "top_k": 2})
    assert not res.is_error
    assert "SEC001" in res.content[0].text or "Dynamic Code Execution" in res.content[0].text


@pytest.mark.asyncio
async def test_mcp_tool_explain_rule():
    res = await mcp_server.call_tool("explain_rule", {"rule_id": "SEC001"})
    assert not res.is_error
    assert "Dynamic Code Execution" in res.content[0].text

    res_missing = await mcp_server.call_tool("explain_rule", {"rule_id": "UNKNOWN_999"})
    assert not res_missing.is_error
    assert "not found" in res_missing.content[0].text.lower()


@pytest.mark.asyncio
async def test_mcp_tool_repo_health(test_repo_and_pr):
    repo, _ = test_repo_and_pr
    res = await mcp_server.call_tool("get_repo_health", {"repo_id": repo.id})
    assert not res.is_error
    assert repo.full_name in res.content[0].text
    assert "health_score" in res.content[0].text


@pytest.mark.asyncio
async def test_mcp_tool_pr_findings(test_repo_and_pr):
    _, pr = test_repo_and_pr
    res = await mcp_server.call_tool("get_pr_findings", {"pr_id": pr.id})
    assert not res.is_error
    assert "feat: Add MCP integration" in res.content[0].text
    assert "SEC001" in res.content[0].text


@pytest.mark.asyncio
async def test_mcp_resources():
    rules_res = await mcp_server.read_resource("coderefactor://rules")
    assert len(rules_res) > 0
    assert "SEC001" in rules_res[0].content

    single_rule_res = await mcp_server.read_resource("coderefactor://rules/SEC002")
    assert len(single_rule_res) > 0
    assert "SEC002" in single_rule_res[0].content


@pytest.mark.asyncio
async def test_mcp_prompts():
    prompt_res = await mcp_server.get_prompt("review_pr_diff", {"diff": "+ eval(x)", "pr_title": "Fix"})
    assert len(prompt_res.messages) > 0
    assert "CodeRefactor AI" in prompt_res.messages[0].content.text
    assert "+ eval(x)" in prompt_res.messages[0].content.text


def test_fastapi_mcp_api_endpoints(client: TestClient, test_repo_and_pr):
    repo, _ = test_repo_and_pr

    # 1. Status
    res = client.get("/api/v1/mcp/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert data["inventory"]["tools_count"] == 7

    # 2. Tools list
    res_tools = client.get("/api/v1/mcp/tools")
    assert res_tools.status_code == 200
    assert len(res_tools.json()) == 7

    # 3. Resources list
    res_resources = client.get("/api/v1/mcp/resources")
    assert res_resources.status_code == 200
    assert len(res_resources.json()) >= 5

    # 4. Prompts list
    res_prompts = client.get("/api/v1/mcp/prompts")
    assert res_prompts.status_code == 200
    assert len(res_prompts.json()) == 3

    # 5. Execute tool via REST proxy
    exec_res = client.post(
        "/api/v1/mcp/execute",
        json={
            "tool_name": "explain_rule",
            "arguments": {"rule_id": "BUG002"},
        },
    )
    assert exec_res.status_code == 200
    assert exec_res.json()["success"] is True
    assert exec_res.json()["result"]["rule_id"] == "BUG002"

    # 6. Read resource via REST proxy
    read_res = client.get("/api/v1/mcp/read-resource?uri=coderefactor://rules")
    assert read_res.status_code == 200
    assert "rules" in read_res.json()["data"]
