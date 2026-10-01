import logging
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.services.analyzer.base import FindingResult
from app.services.rag.vector_store import vector_store

logger = logging.getLogger(__name__)


class RAGRetriever:
    """
    Retrieves grounded context from vector collections:
    1. Static rule definitions & authoritative fix guidelines.
    2. Historical findings & accepted fixes from previous PR reviews.
    """

    def __init__(self, top_k: int = 3, min_similarity: float = 0.35):
        self.top_k = top_k
        self.min_similarity = min_similarity

    def retrieve_context_for_findings(
        self,
        findings: List[FindingResult],
        repo_id: Optional[int] = None,
        max_tokens_approx: int = 1500,
    ) -> str:
        """
        Builds grounded RAG prompt context for a list of static findings.
        Returns a formatted Markdown block ready to inject into the LLM system prompt.
        """
        if not settings.RAG_ENABLED or not findings:
            return ""

        unique_rule_ids = list(dict.fromkeys(f.rule_id for f in findings if f.rule_id))
        if not unique_rule_ids:
            return ""

        context_sections: List[str] = [
            "### 🧠 Retrieved Knowledge & Project Conventions (RAG Context):",
            "Use the following authoritative internal rule specifications and past accepted fixes to formulate precise inline code suggestions:\n"
        ]

        # 1. Retrieve official rule documentation
        for rule_id in unique_rule_ids[:5]:  # Limit to top 5 distinct rules to conserve token window
            rule_matches = vector_store.query_rule_knowledge(
                query_text=f"Rule {rule_id} security bug remediation",
                n_results=1,
                filter_rule_id=rule_id,
            )

            if rule_matches:
                match = rule_matches[0]
                doc_text = match["document"]
                meta = match.get("metadata", {})
                context_sections.append(
                    f"#### [Rule Standard: {rule_id}] - {meta.get('title', rule_id)}\n"
                    f"{doc_text}\n"
                )

            # 2. Retrieve past historical fixes for this rule in the codebase
            history_matches = vector_store.query_historical_findings(
                query_text=f"{rule_id} fix",
                n_results=2,
                filter_rule_id=rule_id,
                filter_repo_id=repo_id,
            )

            if history_matches:
                context_sections.append(f"##### Past Resolutions for {rule_id} in this Codebase:")
                for h in history_matches:
                    meta = h.get("metadata", {})
                    file_path = meta.get("file_path", "unknown")
                    context_sections.append(f"- **{file_path}**: {h['document']}")
                context_sections.append("")

        context_sections.append(
            "CRITICAL INSTRUCTION: Align your inline suggestions with the exact remediation patterns retrieved above.\n"
        )

        full_context = "\n".join(context_sections)
        # Approximate token truncation guard (1 char ~= 0.3 tokens)
        if len(full_context) > max_tokens_approx * 4:
            full_context = full_context[: max_tokens_approx * 4] + "\n...[RAG Context Truncated]"

        return full_context

    def semantic_search(
        self,
        query: str,
        n_results: int = 5,
        collection_type: str = "all",  # "rules", "history", or "all"
        repo_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        General semantic search across rules and historical review findings.
        Used by the RAG Query UI and API endpoints.
        """
        results: Dict[str, Any] = {
            "query": query,
            "rules": [],
            "historical_findings": [],
        }

        if collection_type in ("rules", "all"):
            results["rules"] = vector_store.query_rule_knowledge(query, n_results=n_results)

        if collection_type in ("history", "all"):
            results["historical_findings"] = vector_store.query_historical_findings(
                query, n_results=n_results, filter_repo_id=repo_id
            )

        return results


# Global singleton retriever instance
rag_retriever = RAGRetriever(
    top_k=settings.RAG_TOP_K,
    min_similarity=settings.RAG_MIN_SIMILARITY
)
