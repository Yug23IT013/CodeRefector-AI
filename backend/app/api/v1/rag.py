from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.security import verify_api_token
from app.db.session import get_db
from app.services.rag.vector_store import vector_store
from app.services.rag.retriever import rag_retriever
from app.services.rag.indexer import rag_indexer
from app.services.rag.knowledge_base import get_all_rules_knowledge, get_rule_knowledge

router = APIRouter(prefix="/rag", tags=["RAG (Retrieval-Augmented Generation)"])


class RAGQueryPayload(BaseModel):
    query: str = Field(..., min_length=2, description="Semantic search query or question")
    collection_type: str = Field("all", description="Target collection: 'rules', 'history', or 'all'")
    limit: int = Field(5, ge=1, le=20, description="Max number of results to retrieve")
    repo_id: Optional[int] = Field(None, description="Optional filter by repository ID")


@router.get("/status", dependencies=[Depends(verify_api_token)])
def get_rag_status() -> Dict[str, Any]:
    """Retrieve vector store health, engine backend, and collection statistics."""
    stats = vector_store.get_stats()
    return {
        "status": "healthy",
        "data": stats,
    }


@router.post("/query", dependencies=[Depends(verify_api_token)])
def query_rag_knowledge(payload: RAGQueryPayload) -> Dict[str, Any]:
    """
    Perform semantic search across rule documentation and historical findings.
    Used by developer assistants and the knowledge base explorer.
    """
    results = rag_retriever.semantic_search(
        query=payload.query,
        n_results=payload.limit,
        collection_type=payload.collection_type,
        repo_id=payload.repo_id,
    )
    return {
        "query": payload.query,
        "collection_type": payload.collection_type,
        "results": results,
    }


@router.post("/reindex", dependencies=[Depends(verify_api_token)])
def reindex_rag_data(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Re-seed rule knowledge base and re-index all historical database findings
    into the vector store.
    """
    rules_count = rag_indexer.refresh_rule_knowledge()
    history_count = rag_indexer.reindex_all_findings(db)

    return {
        "message": "Successfully synchronized RAG vector knowledge base",
        "rules_indexed": rules_count,
        "findings_indexed": history_count,
        "stats": vector_store.get_stats(),
    }


@router.get("/rules", dependencies=[Depends(verify_api_token)])
def list_rule_knowledge() -> List[Dict[str, Any]]:
    """List all structured rule knowledge base specifications."""
    return get_all_rules_knowledge()


@router.get("/rules/{rule_id}", dependencies=[Depends(verify_api_token)])
def get_rule_detail(rule_id: str) -> Dict[str, Any]:
    """Get authoritative rule definition, rationale, and recommended fix."""
    rule = get_rule_knowledge(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found in knowledge base")
    return rule


@router.get("/findings/similar", dependencies=[Depends(verify_api_token)])
def get_similar_findings(
    rule_id: str = Query(..., description="Rule ID to search (e.g. SEC001)"),
    file_path: Optional[str] = Query(None, description="Optional file path context"),
    limit: int = Query(3, ge=1, le=10),
    repo_id: Optional[int] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Find similar historical findings and remediation suggestions for a specific rule.
    Used by PR review detail cards to show contextual precedent.
    """
    query_text = f"{rule_id} in {file_path}" if file_path else f"{rule_id} fix"
    matches = vector_store.query_historical_findings(
        query_text=query_text,
        n_results=limit,
        filter_rule_id=rule_id,
        filter_repo_id=repo_id,
    )
    return matches
