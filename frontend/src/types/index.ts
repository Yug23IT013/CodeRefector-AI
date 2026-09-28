export interface Repository {
  id: number;
  github_repo_id: number | null;
  full_name: string;
  default_branch: string;
  created_at: string | null;
  total_prs: number;
  open_prs: number;
  latest_pr_number: number | null;
  latest_activity: string | null;
}

export interface RepoStats {
  repo_id: number;
  repo_name: string;
  total_findings: number;
  by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  by_category: Record<string, number>;
}

export interface PullRequestSummary {
  id: number;
  repo_id: number;
  repo_name: string;
  pr_number: number;
  title: string;
  author: string;
  head_sha: string;
  base_sha: string;
  status: string;
  html_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  latest_review_status: string;
  findings_count: number;
  critical_count: number;
}

export interface Finding {
  id: number;
  file_path: string;
  line_number: number;
  rule_id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  ai_suggestion: string | null;
}

export interface ReviewRun {
  id: number;
  commit_sha: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  ai_summary: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface PullRequestDetail {
  id: number;
  repo_id: number;
  repo_name: string;
  pr_number: number;
  title: string;
  author: string;
  head_sha: string;
  base_sha: string;
  status: string;
  html_url: string | null;
  created_at: string | null;
  latest_review: ReviewRun | null;
  findings: Finding[];
  total_reviews: number;
}

export interface User {
  id: number;
  github_id: number;
  username: string;
  name: string | null;
  avatar_url: string | null;
  has_github_token: boolean;
  tracked_repos_count: number;
}

export interface UserGitHubRepo {
  id: number;
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  is_tracked: boolean;
}

export interface HealthScoreMetrics {
  score: number;
  rating: string;
  label: string;
  critical_penalty?: number;
  high_penalty?: number;
  medium_penalty?: number;
  low_penalty?: number;
}

export interface QualityTrendPoint {
  pr_id: number;
  pr_number: number;
  title: string;
  author: string;
  date: string;
  timestamp: string | null;
  status: string;
  findings_count: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  health_score: number;
}

export interface RepoTrendData {
  repo_id: number;
  repo_name: string;
  total_prs: number;
  total_findings: number;
  health_score: HealthScoreMetrics;
  severity_totals: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  category_totals: Record<string, number>;
  trends: QualityTrendPoint[];
}

export interface GlobalAnalyticsOverview {
  total_repositories: number;
  total_prs_analyzed: number;
  total_findings: number;
  severity_breakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  category_breakdown: Record<string, number>;
  health_score: HealthScoreMetrics;
  top_rules: Array<{ rule_id: string; count: number }>;
}

export interface BenchmarkSuiteDetail {
  name: string;
  base_ms: number;
  pr_ms: number;
  delta_pct: number;
  memory_mb: number;
  status: 'passed' | 'slow' | 'failed';
}

export interface BenchmarkRun {
  id: number;
  pr_id: number;
  commit_sha: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  base_latency_ms: number;
  pr_latency_ms: number;
  latency_change_pct: number;
  base_memory_mb: number;
  pr_memory_mb: number;
  memory_change_pct: number;
  cpu_usage_pct: number;
  test_cases_count: number;
  regression_detected: boolean;
  summary_verdict: 'pass' | 'warning' | 'regression' | 'improved' | 'stable';
  suites: BenchmarkSuiteDetail[];
  created_at: string | null;
}

export interface BenchmarkTrendPoint {
  pr_id: number;
  pr_number: number;
  title: string;
  base_latency_ms: number;
  pr_latency_ms: number;
  latency_change_pct: number;
  base_memory_mb: number;
  pr_memory_mb: number;
  memory_change_pct: number;
  verdict: string;
  date: string;
}

export interface BenchmarkTrendsData {
  repo_id: number;
  repo_name: string;
  total_benchmarked_prs: number;
  benchmark_trends: BenchmarkTrendPoint[];
}

