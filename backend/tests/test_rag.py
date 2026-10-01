import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.analyzer.base import FindingResult
from app.services.rag.vector_store import vector_store
from app.services.rag.retriever import rag_retriever
from app.services.rag.knowledge_base import get_rule_knowledge, get_all_rules_knowledge

client = TestClient(app)


def test_rule_knowledge_base():
    """Verify static rule knowledge base completeness."""
    rules = get_all_rules_knowledge()
    assert len(rules) >= 10

    sec001 = get_rule_knowledge("SEC001")
    assert sec001 is not None
    assert sec001["category"] == "security"
    assert "eval" in sec001["description"]

    sec003 = get_rule_knowledge("SEC003")
    assert sec003 is not None
    assert "SQL" in sec003["title"]


def test_vector_store_rule_query():
    """Verify vector store retrieval of rules."""
    stats = vector_store.get_stats()
    assert stats["rule_knowledge_count"] >= 10

    results = vector_store.query_rule_knowledge("SQL injection formatting", n_results=1)
    assert len(results) > 0
    assert "SEC003" in results[0]["id"] or "SEC003" in results[0]["document"]


def test_vector_store_historical_indexing_and_query():
    """Verify indexing of a past finding and subsequent retrieval."""
    vector_store.index_finding(
        finding_id=9999,
        rule_id="SEC001",
        file_path="app/test_eval.py",
        message="Avoid dynamic code execution via eval()",
        ai_suggestion="Use ast.literal_eval() instead",
        severity="critical",
        category="security",
        repo_id=1,
        pr_number=42,
    )

    history_results = vector_store.query_historical_findings("eval execution", n_results=1)
    assert len(history_results) > 0
    assert any("finding_9999" in r["id"] or "SEC001" in r["document"] for r in history_results)


def test_rag_retriever_context_generation():
    """Verify RAG prompt block is generated for static findings."""
    dummy_findings = [
        FindingResult(
            file_path="services/data.py",
            line_number=15,
            rule_id="SEC001",
            severity="critical",
            category="security",
            message="Dynamic eval execution",
        ),
        FindingResult(
            file_path="services/db.py",
            line_number=40,
            rule_id="SEC003",
            severity="critical",
            category="security",
            message="SQL string concatenation",
        ),
    ]

    context = rag_retriever.retrieve_context_for_findings(dummy_findings)
    assert "Retrieved Knowledge & Project Conventions" in context
    assert "SEC001" in context
    assert "SEC003" in context


def test_rag_api_endpoints():
    """Verify HTTP endpoints for RAG."""
    # Status endpoint
    res_status = client.get("/api/v1/rag/status")
    assert res_status.status_code == 200
    data = res_status.json()["data"]
    assert "rule_knowledge_count" in data
    assert data["rule_knowledge_count"] >= 10

    # Rules listing
    res_rules = client.get("/api/v1/rag/rules")
    assert res_rules.status_code == 200
    rules = res_rules.json()
    assert len(rules) >= 10

    # Single rule detail
    res_detail = client.get("/api/v1/rag/rules/SEC002")
    assert res_detail.status_code == 200
    assert res_detail.json()["rule_id"] == "SEC002"

    # Query endpoint
    res_query = client.post("/api/v1/rag/query", json={
        "query": "How to fix hardcoded secrets in source code?",
        "collection_type": "all",
        "limit": 3
    })
    assert res_query.status_code == 200
    q_data = res_query.json()
    assert "results" in q_data
    assert "rules" in q_data["results"]
