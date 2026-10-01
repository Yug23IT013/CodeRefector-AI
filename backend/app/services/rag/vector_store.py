import logging
import math
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.services.rag.knowledge_base import get_all_rules_knowledge

logger = logging.getLogger(__name__)


class LightweightVectorIndex:
    """
    In-memory fallback vector index using TF-IDF cosine similarity.
    Ensures zero-downtime retrieval even if native C++ wheels or large models
    are loading or unavailable in constrained environments.
    """

    def __init__(self, name: str):
        self.name = name
        self.docs: Dict[str, Dict[str, Any]] = {}  # id -> {text, metadata, vec}
        self.idf: Dict[str, float] = {}

    def _tokenize(self, text: str) -> List[str]:
        return re.findall(r"\b[A-Za-z0-9_\-\.]{2,}\b", text.lower())

    def _compute_tf(self, tokens: List[str]) -> Dict[str, float]:
        counts: Dict[str, int] = {}
        for t in tokens:
            counts[t] = counts.get(t, 0) + 1
        total = max(1, len(tokens))
        return {t: c / total for t, c in counts.items()}

    def _update_idf(self):
        total_docs = len(self.docs)
        if total_docs == 0:
            return
        doc_freq: Dict[str, int] = {}
        for item in self.docs.values():
            tokens = set(self._tokenize(item["text"]))
            for t in tokens:
                doc_freq[t] = doc_freq.get(t, 0) + 1
        self.idf = {t: math.log(1.0 + total_docs / (1.0 + df)) for t, df in doc_freq.items()}

    def _embed(self, text: str) -> Dict[str, float]:
        tokens = self._tokenize(text)
        tf = self._compute_tf(tokens)
        vec = {t: weight * self.idf.get(t, 1.0) for t, weight in tf.items()}
        # Normalize
        norm = math.sqrt(sum(v * v for v in vec.values()))
        if norm > 0:
            vec = {k: v / norm for k, v in vec.items()}
        return vec

    def _cosine(self, vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
        intersection = set(vec1.keys()) & set(vec2.keys())
        return sum(vec1[k] * vec2[k] for k in intersection)

    def add(self, ids: List[str], documents: List[str], metadatas: Optional[List[Dict[str, Any]]] = None):
        metadatas = metadatas or [{} for _ in ids]
        for doc_id, doc_text, meta in zip(ids, documents, metadatas):
            self.docs[doc_id] = {
                "id": doc_id,
                "text": doc_text,
                "metadata": meta or {},
            }
        self._update_idf()
        for doc_id in self.docs:
            self.docs[doc_id]["vec"] = self._embed(self.docs[doc_id]["text"])

    def query(
        self,
        query_text: str,
        n_results: int = 3,
        where: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not self.docs:
            return {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]}

        q_vec = self._embed(query_text)
        scored: List[tuple[float, str, str, Dict[str, Any]]] = []

        for doc_id, entry in self.docs.items():
            meta = entry["metadata"]
            if where:
                matches = True
                for k, v in where.items():
                    if meta.get(k) != v:
                        matches = False
                        break
                if not matches:
                    continue

            score = self._cosine(q_vec, entry.get("vec", {}))
            scored.append((score, doc_id, entry["text"], meta))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:n_results]

        ids = [x[1] for x in top]
        documents = [x[2] for x in top]
        metadatas = [x[3] for x in top]
        distances = [round(1.0 - x[0], 4) for x in top]  # distance = 1 - similarity

        return {
            "ids": [ids],
            "documents": [documents],
            "metadatas": [metadatas],
            "distances": [distances],
        }

    def count(self) -> int:
        return len(self.docs)

    def delete(self, where: Optional[Dict[str, Any]] = None):
        if not where:
            self.docs.clear()
            self.idf.clear()
            return
        to_del = []
        for doc_id, entry in self.docs.items():
            match = True
            for k, v in where.items():
                if entry["metadata"].get(k) != v:
                    match = False
                    break
            if match:
                to_del.append(doc_id)
        for doc_id in to_del:
            self.docs.pop(doc_id, None)
        self._update_idf()


class VectorStoreService:
    """
    Dual-backend Vector Store:
    Uses ChromaDB when available with persistent storage,
    with an automatic LightweightVectorIndex fallback.
    """

    def __init__(self):
        self.chroma_client = None
        self.rule_collection = None
        self.history_collection = None
        self.backend_type = "fallback"

        # Fallback collections
        self.fallback_rules = LightweightVectorIndex("rule_knowledge")
        self.fallback_history = LightweightVectorIndex("historical_findings")

        self._init_vector_store()
        self.seed_rule_knowledge()

    def _get_storage_path(self) -> str:
        base_dir = Path(__file__).resolve().parent.parent.parent.parent
        chroma_path = (base_dir / "chroma_db").resolve()
        os.makedirs(chroma_path, exist_ok=True)
        return str(chroma_path)

    def _init_vector_store(self):
        try:
            import chromadb
            persist_dir = self._get_storage_path()
            logger.info("Initializing ChromaDB at %s", persist_dir)
            self.chroma_client = chromadb.PersistentClient(path=persist_dir)
            self.rule_collection = self.chroma_client.get_or_create_collection(
                name="rule_knowledge",
                metadata={"hnsw:space": "cosine"}
            )
            self.history_collection = self.chroma_client.get_or_create_collection(
                name="historical_findings",
                metadata={"hnsw:space": "cosine"}
            )
            self.backend_type = "chromadb"
            logger.info("ChromaDB vector store initialized successfully.")
        except Exception as e:
            logger.warning("Could not initialize ChromaDB (%s). Using LightweightVectorIndex fallback.", e)
            self.backend_type = "fallback"

    def seed_rule_knowledge(self, force: bool = False):
        """Seed the rule knowledge base into vector storage."""
        rules = get_all_rules_knowledge()
        current_count = self.get_rule_count()

        if current_count >= len(rules) and not force:
            logger.info("Rule knowledge base already seeded (%d entries).", current_count)
            return

        logger.info("Seeding %d rules into vector knowledge base...", len(rules))
        ids = []
        documents = []
        metadatas = []

        for r in rules:
            rule_id = r["rule_id"]
            doc = (
                f"Rule: {rule_id} - {r['title']}\n"
                f"Category: {r['category']} | Severity: {r['severity']}\n"
                f"Description: {r['description']}\n"
                f"Remediation: {r['remediation']}\n"
                f"Bad Pattern Example:\n{r.get('example_bad', '')}\n"
                f"Recommended Fix Pattern:\n{r.get('example_good', '')}"
            )
            ids.append(f"rule_{rule_id}")
            documents.append(doc)
            metadatas.append({
                "rule_id": rule_id,
                "category": r["category"],
                "severity": r["severity"],
                "title": r["title"],
            })

        if self.backend_type == "chromadb" and self.rule_collection:
            try:
                self.rule_collection.upsert(
                    ids=ids,
                    documents=documents,
                    metadatas=metadatas,
                )
            except Exception as e:
                logger.warning("ChromaDB upsert failed (%s). Falling back to LightweightVectorIndex.", e)
                self.fallback_rules.add(ids, documents, metadatas)
        else:
            self.fallback_rules.add(ids, documents, metadatas)

    def query_rule_knowledge(
        self,
        query_text: str,
        n_results: int = 3,
        filter_rule_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant rule documentation based on semantic similarity or rule ID."""
        where_clause = {"rule_id": filter_rule_id.upper()} if filter_rule_id else None

        if self.backend_type == "chromadb" and self.rule_collection:
            try:
                res = self.rule_collection.query(
                    query_texts=[query_text],
                    n_results=n_results,
                    where=where_clause,
                )
                return self._format_results(res)
            except Exception as e:
                logger.warning("ChromaDB query error: %s. Using fallback.", e)

        res = self.fallback_rules.query(query_text, n_results=n_results, where=where_clause)
        return self._format_results(res)

    def index_finding(
        self,
        finding_id: int,
        rule_id: str,
        file_path: str,
        message: str,
        ai_suggestion: Optional[str] = None,
        severity: str = "medium",
        category: str = "general",
        repo_id: Optional[int] = None,
        pr_number: Optional[int] = None,
    ):
        """Index a resolved or reviewed finding into historical vector store."""
        doc_id = f"finding_{finding_id}"
        document = (
            f"Rule Violation: {rule_id} in {file_path}\n"
            f"Category: {category} | Severity: {severity}\n"
            f"Message: {message}\n"
            f"Fix Suggestion: {ai_suggestion or 'No AI fix recorded'}"
        )
        metadata = {
            "finding_id": finding_id,
            "rule_id": rule_id,
            "file_path": file_path,
            "severity": severity,
            "category": category,
            "repo_id": repo_id or 0,
            "pr_number": pr_number or 0,
        }

        if self.backend_type == "chromadb" and self.history_collection:
            try:
                self.history_collection.upsert(
                    ids=[doc_id],
                    documents=[document],
                    metadatas=[metadata],
                )
                return
            except Exception as e:
                logger.warning("ChromaDB index_finding error (%s). Using fallback.", e)

        self.fallback_history.add([doc_id], [document], [metadata])

    def query_historical_findings(
        self,
        query_text: str,
        n_results: int = 3,
        filter_rule_id: Optional[str] = None,
        filter_repo_id: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve similar past code findings and accepted fixes."""
        where: Dict[str, Any] = {}
        if filter_rule_id:
            where["rule_id"] = filter_rule_id.upper()
        if filter_repo_id:
            where["repo_id"] = filter_repo_id

        where_clause = where if where else None

        if self.backend_type == "chromadb" and self.history_collection:
            try:
                res = self.history_collection.query(
                    query_texts=[query_text],
                    n_results=n_results,
                    where=where_clause,
                )
                return self._format_results(res)
            except Exception as e:
                logger.warning("ChromaDB query_historical_findings error: %s", e)

        res = self.fallback_history.query(query_text, n_results=n_results, where=where_clause)
        return self._format_results(res)

    def _format_results(self, raw_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        items = []
        if not raw_results or not raw_results.get("documents"):
            return items

        docs = raw_results["documents"][0] if raw_results["documents"] else []
        metas = raw_results["metadatas"][0] if raw_results.get("metadatas") else []
        distances = raw_results["distances"][0] if raw_results.get("distances") else []
        ids = raw_results["ids"][0] if raw_results.get("ids") else []

        for i in range(len(docs)):
            dist = distances[i] if i < len(distances) else 0.5
            similarity = max(0.0, min(1.0, 1.0 - dist))
            items.append({
                "id": ids[i] if i < len(ids) else f"doc_{i}",
                "document": docs[i],
                "metadata": metas[i] if i < len(metas) else {},
                "similarity": round(similarity, 4),
                "distance": round(dist, 4),
            })
        return items

    def get_rule_count(self) -> int:
        if self.backend_type == "chromadb" and self.rule_collection:
            try:
                return self.rule_collection.count()
            except Exception:
                pass
        return self.fallback_rules.count()

    def get_history_count(self) -> int:
        if self.backend_type == "chromadb" and self.history_collection:
            try:
                return self.history_collection.count()
            except Exception:
                pass
        return self.fallback_history.count()

    def get_stats(self) -> Dict[str, Any]:
        return {
            "backend": self.backend_type,
            "rule_knowledge_count": self.get_rule_count(),
            "historical_findings_count": self.get_history_count(),
            "storage_path": self._get_storage_path(),
            "rag_enabled": settings.RAG_ENABLED,
        }


# Global singleton vector store instance
vector_store = VectorStoreService()
