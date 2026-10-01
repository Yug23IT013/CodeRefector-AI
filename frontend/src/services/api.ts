import {
  Repository,
  RepoStats,
  PullRequestSummary,
  PullRequestDetail,
  User,
  UserGitHubRepo,
  GlobalAnalyticsOverview,
  RepoTrendData,
  BenchmarkRun,
  BenchmarkTrendsData,
  AutoMergeGateStatus,
} from '../types';

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

export const api = {
  getRepositories(): Promise<Repository[]> {
    return fetchJSON<Repository[]>('/repos');
  },

  getRepositoryStats(repoId: number): Promise<RepoStats> {
    return fetchJSON<RepoStats>(`/repos/${repoId}/stats`);
  },

  getPullRequests(repoId: number): Promise<PullRequestSummary[]> {
    return fetchJSON<PullRequestSummary[]>(`/repos/${repoId}/pulls`);
  },

  syncRepositoryPRs(repoId: number): Promise<{ message: string; synced: number }> {
    return fetchJSON<{ message: string; synced: number }>(`/repos/${repoId}/sync`, {
      method: 'POST',
    });
  },

  getPullRequest(prId: number): Promise<PullRequestDetail> {
    return fetchJSON<PullRequestDetail>(`/pulls/${prId}`);
  },

  triggerReReview(prId: number): Promise<{ status: string; message: string }> {
    return fetchJSON<{ status: string; message: string }>(`/pulls/${prId}/re-review`, {
      method: 'POST',
    });
  },

  getAutoMergeStatus(prId: number): Promise<AutoMergeGateStatus> {
    return fetchJSON<AutoMergeGateStatus>(`/pulls/${prId}/auto-merge`);
  },

  toggleAutoMerge(prId: number): Promise<{ pr_id: number; auto_merge_enabled: boolean; message: string }> {
    return fetchJSON<{ pr_id: number; auto_merge_enabled: boolean; message: string }>(`/pulls/${prId}/auto-merge/toggle`, {
      method: 'POST',
    });
  },

  forceMergePR(prId: number, reason?: string): Promise<{
    success: boolean;
    action: string;
    pr_id: number;
    pr_number: number;
    merge_commit_sha: string;
    merged_by: string;
  }> {
    return fetchJSON(`/pulls/${prId}/force-merge`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'Manual operator force merge' }),
    });
  },

  // Analytics & Quality Trends
  getGlobalAnalytics(): Promise<GlobalAnalyticsOverview> {
    return fetchJSON<GlobalAnalyticsOverview>('/analytics/overview');
  },

  getRepoTrends(repoId: number): Promise<RepoTrendData> {
    return fetchJSON<RepoTrendData>(`/analytics/repos/${repoId}/trends`);
  },

  // Performance Benchmarking
  getPRBenchmarks(prId: number): Promise<BenchmarkRun> {
    return fetchJSON<BenchmarkRun>(`/pulls/${prId}/benchmarks`);
  },

  runPRBenchmark(prId: number): Promise<BenchmarkRun & { message?: string }> {
    return fetchJSON<BenchmarkRun & { message?: string }>(`/pulls/${prId}/benchmarks/run`, {
      method: 'POST',
    });
  },

  getRepoBenchmarkTrends(repoId: number): Promise<BenchmarkTrendsData> {
    return fetchJSON<BenchmarkTrendsData>(`/repos/${repoId}/benchmarks/trends`);
  },

  // Authentication & GitHub Integration
  getGitHubAuthUrl(): Promise<{ configured: boolean; url: string | null; message?: string }> {
    return fetchJSON<{ configured: boolean; url: string | null; message?: string }>('/auth/github/url');
  },

  demoLogin(): Promise<{ access_token: string; user: User }> {
    return fetchJSON<{ access_token: string; user: User }>('/auth/demo-login', {
      method: 'POST',
    });
  },

  getCurrentUser(): Promise<User> {
    return fetchJSON<User>('/auth/me');
  },

  getUserGitHubRepos(): Promise<UserGitHubRepo[]> {
    return fetchJSON<UserGitHubRepo[]>('/auth/user-repos');
  },

  trackRepository(payload: { full_name: string; auto_install_webhook?: boolean }): Promise<{
    status: string;
    message: string;
    repo_id: number;
    full_name: string;
    webhook_auto_installed: boolean;
  }> {
    return fetchJSON('/auth/track-repo', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

