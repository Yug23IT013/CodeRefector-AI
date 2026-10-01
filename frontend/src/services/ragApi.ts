import { RAGStatus, RuleKnowledge, RAGSearchResults, RAGSearchDocument } from '../types';

const API_BASE = '/api/v1';

async function fetchJSON<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('AUTH_TOKEN') || localStorage.getItem('DASHBOARD_API_TOKEN');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const err = await response.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch (e) {
      // no-op
    }
    throw new Error(`API Error (${response.status}): ${errorDetail}`);
  }

  return response.json();
}

export const ragApi = {
  getStatus(): Promise<{ status: string; data: RAGStatus }> {
    return fetchJSON<{ status: string; data: RAGStatus }>('/rag/status');
  },

  query(query: string, collection_type: string = 'all', limit: number = 5, repo_id?: number): Promise<RAGSearchResults> {
    return fetchJSON<RAGSearchResults>('/rag/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        collection_type,
        limit,
        repo_id,
      }),
    });
  },

  getRules(): Promise<RuleKnowledge[]> {
    return fetchJSON<RuleKnowledge[]>('/rag/rules');
  },

  getRuleDetail(ruleId: string): Promise<RuleKnowledge> {
    return fetchJSON<RuleKnowledge>(`/rag/rules/${ruleId}`);
  },

  getSimilarFindings(ruleId: string, filePath?: string, limit: number = 3): Promise<RAGSearchDocument[]> {
    const params = new URLSearchParams({ rule_id: ruleId, limit: String(limit) });
    if (filePath) {
      params.append('file_path', filePath);
    }
    return fetchJSON<RAGSearchDocument[]>(`/rag/findings/similar?${params.toString()}`);
  },

  reindex(): Promise<{ message: string; rules_indexed: number; findings_indexed: number; stats: RAGStatus }> {
    return fetchJSON('/rag/reindex', {
      method: 'POST',
    });
  },
};
