import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Repository, GlobalAnalyticsOverview, RepoTrendData, BenchmarkTrendsData } from '../types';
import {
  FolderGit2,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  Plus,
  GitBranch,
  Clock,
  Activity,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { TrackRepoModal } from '../components/TrackRepoModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatChip } from '../components/ui/StatChip';
import { Skeleton } from '../components/ui/Skeleton';
import { HealthScoreGauge } from '../components/analytics/HealthScoreGauge';
import { TrendLineChart } from '../components/analytics/TrendLineChart';
import { CategoryDistribution } from '../components/analytics/CategoryDistribution';
import { BenchmarkTrendsChart } from '../components/benchmarks/BenchmarkTrendsChart';

export const RepoListPage: React.FC = () => {
  const { user, loginWithGitHub } = useAuth();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [activeTab, setActiveTab] = useState<'repositories' | 'analytics'>('repositories');
  const [overview, setOverview] = useState<GlobalAnalyticsOverview | null>(null);
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [repoTrend, setRepoTrend] = useState<RepoTrendData | null>(null);
  const [benchTrends, setBenchTrends] = useState<BenchmarkTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackModalOpen, setTrackModalOpen] = useState(false);

  const loadRepos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getRepositories();
      setRepos(data);
      if (data.length > 0 && selectedRepoId === null) {
        setSelectedRepoId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repositories.');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const globalData = await api.getGlobalAnalytics();
      setOverview(globalData);

      if (selectedRepoId) {
        const [trendData, benchData] = await Promise.all([
          api.getRepoTrends(selectedRepoId).catch(() => null),
          api.getRepoBenchmarkTrends(selectedRepoId).catch(() => null),
        ]);
        setRepoTrend(trendData);
        setBenchTrends(benchData);
      }
    } catch (e) {
      // no-op
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();

    const handleReload = () => loadRepos();
    window.addEventListener('reload-repos', handleReload);
    return () => window.removeEventListener('reload-repos', handleReload);
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab, selectedRepoId]);

  const handleOpenTrackModal = () => {
    if (!user) {
      loginWithGitHub();
      return;
    }
    setTrackModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border-subtle">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              CodeRefactor Dashboard
            </h1>
            <Badge variant="brand" size="sm">
              {repos.length} Connected
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Automated AST static analysis, sandboxed performance profiling, and AI reviews.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenTrackModal}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Track Repository
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              loadRepos();
              if (activeTab === 'analytics') loadAnalytics();
            }}
            disabled={loading || analyticsLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${loading || analyticsLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 mt-6 pb-2 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('repositories')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'repositories'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'bg-surface-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Tracked Repositories ({repos.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'analytics'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'bg-surface-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Quality Trends & Benchmark Analytics</span>
        </button>
      </div>

      {activeTab === 'analytics' ? (
        /* Analytics & Quality Trends View */
        <div className="mt-8 space-y-8">
          {analyticsLoading && !overview ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton variant="card" className="h-64" />
              <Skeleton variant="card" className="h-64" />
            </div>
          ) : (
            <>
              {/* Repository Selector Dropdown for Detailed Trend Inspection */}
              {repos.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
                    <FolderGit2 className="w-4 h-4 text-sky-400" />
                    <span>Select Repository for Deep Dive Trends:</span>
                  </div>
                  <select
                    value={selectedRepoId || ''}
                    onChange={(e) => setSelectedRepoId(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-sky-500 outline-none"
                  >
                    {repos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.full_name} ({r.total_prs} PRs)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Health Score & Category Distribution Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {repoTrend ? (
                  <HealthScoreGauge
                    health={repoTrend.health_score}
                    title={`${repoTrend.repo_name} Health Score`}
                    subtitle={`Calculated across ${repoTrend.total_prs} analyzed pull requests`}
                  />
                ) : overview ? (
                  <HealthScoreGauge
                    health={overview.health_score}
                    title="Platform Health Score"
                    subtitle={`Aggregate score across all ${overview.total_repositories} connected repositories`}
                  />
                ) : null}

                {repoTrend ? (
                  <CategoryDistribution
                    categories={repoTrend.category_totals}
                    totalFindings={repoTrend.total_findings}
                  />
                ) : overview ? (
                  <CategoryDistribution
                    categories={overview.category_breakdown}
                    totalFindings={overview.total_findings}
                  />
                ) : null}
              </div>

              {/* Historical Quality Trends Chart */}
              {repoTrend && repoTrend.trends.length > 0 && (
                <TrendLineChart
                  trends={repoTrend.trends}
                  repoName={repoTrend.repo_name}
                />
              )}

              {/* Runtime Benchmark Telemetry Chart */}
              {benchTrends && benchTrends.benchmark_trends.length > 0 && (
                <BenchmarkTrendsChart
                  trends={benchTrends.benchmark_trends}
                  repoName={benchTrends.repo_name}
                />
              )}
            </>
          )}
        </div>
      ) : (
        /* Repository Cards Grid */
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-6 rounded-2xl bg-surface-1/60 border border-border-subtle space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton variant="circle" className="w-10 h-10" />
                    <Skeleton variant="text" width="60px" />
                  </div>
                  <Skeleton variant="text" width="70%" />
                  <Skeleton variant="text" width="40%" />
                  <div className="pt-4 border-t border-border-subtle flex justify-between">
                    <Skeleton variant="text" width="80px" />
                    <Skeleton variant="text" width="40px" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="my-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          ) : repos.length === 0 ? (
            /* Empty State */
            <Card elevation="default" className="my-12 p-8 sm:p-12 text-center max-w-2xl mx-auto border-dashed">
              <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center mx-auto mb-4 text-brand-400 shadow-glow-sky">
                <FolderGit2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">No repositories connected yet</h3>
              <p className="text-sm text-slate-400 mt-2 mb-6 max-w-md mx-auto leading-relaxed">
                Connect your GitHub repositories to start receiving automated AST vulnerability detection, sandboxed performance benchmarks, and instant AI review comments.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenTrackModal}
                icon={<Plus className="w-4 h-4" />}
              >
                Track Your First Repository
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
              {repos.map((repo) => (
                <Link
                  key={repo.id}
                  to={`/repos/${repo.id}/pulls`}
                  className="group block"
                >
                  <Card
                    elevation="default"
                    interactive
                    glow="sky"
                    className="p-6 h-full flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar: Icon, Branch Badge */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400 group-hover:scale-105 transition-transform">
                          <FolderGit2 className="w-5 h-5" />
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md bg-surface-2 text-slate-300 border border-border-subtle">
                            <GitBranch className="w-3 h-3 text-slate-400" />
                            {repo.default_branch || 'main'}
                          </span>
                        </div>
                      </div>

                      {/* Repo Title & Details */}
                      <h2 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors truncate">
                        {repo.full_name}
                      </h2>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                        <span className="font-mono text-[11px] text-slate-500">#{repo.id}</span>
                        {repo.latest_activity && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {new Date(repo.latest_activity).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Footer: PR Stats & Arrow */}
                    <div className="pt-5 mt-6 border-t border-border-subtle flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatChip
                          label="Open"
                          value={repo.open_prs}
                          variant={repo.open_prs > 0 ? 'success' : 'neutral'}
                        />
                        <StatChip
                          label="Total"
                          value={repo.total_prs}
                          variant="neutral"
                        />
                      </div>

                      <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-slate-400 group-hover:text-brand-300 group-hover:bg-brand-500/10 group-hover:translate-x-0.5 transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Track Repo Modal */}
      <TrackRepoModal
        isOpen={trackModalOpen}
        onClose={() => setTrackModalOpen(false)}
        onSuccess={loadRepos}
      />
    </div>
  );
};

