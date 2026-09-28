import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { PullRequestSummary, RepoStats } from '../types';
import { PRStatusBadge } from '../components/PRStatusBadge';
import {
  ArrowLeft,
  GitPullRequest,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  GitCommit,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export const PRListPage: React.FC = () => {
  const { repoId } = useParams<{ repoId: string }>();
  const id = Number(repoId);

  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [stats, setStats] = useState<RepoStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [prsData, statsData] = await Promise.all([
        api.getPullRequests(id),
        api.getRepositoryStats(id).catch(() => null),
      ]);
      setPrs(prsData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load pull requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const repoName = prs[0]?.repo_name || stats?.repo_name || `Repo #${id}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back Link */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Repositories</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {repoName}
            </h1>
            <Badge variant="brand" size="sm">
              {prs.length} Pull Requests
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Pull requests reviewed with automated AST rule checking and Groq AI code suggestions.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          disabled={loading}
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          className="self-start sm:self-auto"
        >
          Refresh
        </Button>
      </div>

      {/* Aggregate Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
          <Card elevation="default" className="p-4">
            <span className="text-xs text-slate-400 font-medium block">Total Findings</span>
            <span className="text-2xl font-bold text-white mt-1 block font-mono">
              {stats.total_findings}
            </span>
          </Card>

          <Card elevation="default" className="p-4 border-rose-500/20">
            <span className="text-xs text-rose-400 font-medium block">Critical Issues</span>
            <span className="text-2xl font-bold text-rose-400 mt-1 block font-mono">
              {stats.by_severity.critical}
            </span>
          </Card>

          <Card elevation="default" className="p-4 border-amber-500/20">
            <span className="text-xs text-amber-400 font-medium block">High Severity</span>
            <span className="text-2xl font-bold text-amber-400 mt-1 block font-mono">
              {stats.by_severity.high}
            </span>
          </Card>

          <Card elevation="default" className="p-4">
            <span className="text-xs text-yellow-300 font-medium block">Medium & Low</span>
            <span className="text-2xl font-bold text-yellow-300 mt-1 block font-mono">
              {stats.by_severity.medium + stats.by_severity.low}
            </span>
          </Card>
        </div>
      )}

      {/* Pull Requests List */}
      {loading ? (
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-5 rounded-2xl bg-surface-1/60 border border-border-subtle flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Skeleton variant="circle" className="w-9 h-9" />
                <div className="space-y-2">
                  <Skeleton variant="text" width="220px" />
                  <Skeleton variant="text" width="140px" />
                </div>
              </div>
              <Skeleton variant="text" width="80px" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="my-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      ) : prs.length === 0 ? (
        <Card elevation="default" className="my-12 p-8 text-center max-w-xl mx-auto border-dashed">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center mx-auto mb-3 text-brand-400">
            <GitPullRequest className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No pull requests analyzed yet</h3>
          <p className="text-xs text-slate-400 mt-1">
            Open a pull request on GitHub or trigger a webhook event to start automated review.
          </p>
        </Card>
      ) : (
        <Card elevation="default" className="overflow-hidden mt-6 divide-y divide-border-subtle">
          {prs.map((pr) => (
            <Link
              key={pr.id}
              to={`/pulls/${pr.id}`}
              className="p-5 flex items-center justify-between hover:bg-surface-2/60 transition-colors group block"
            >
              <div className="flex items-start gap-4 min-w-0 pr-4">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-400 flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <GitPullRequest className="w-5 h-5" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-xs font-bold text-brand-400">#{pr.pr_number}</span>
                    <h2 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors truncate">
                      {pr.title || 'Untitled Pull Request'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3 h-3 text-slate-500" />
                      <span className="text-slate-300 font-medium">@{pr.author || 'unknown'}</span>
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-surface-2 px-1.5 py-0.5 rounded border border-border-subtle text-slate-300">
                      <GitCommit className="w-3 h-3 text-slate-500" />
                      {pr.head_sha.substring(0, 7)}
                    </span>
                    {pr.updated_at && (
                      <>
                        <span>•</span>
                        <span>{new Date(pr.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="hidden sm:flex flex-col items-end gap-1.5">
                  <PRStatusBadge status={pr.latest_review_status} />
                  {pr.findings_count > 0 ? (
                    <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                      {pr.findings_count} {pr.findings_count === 1 ? 'finding' : 'findings'}
                      {pr.critical_count > 0 && ` (${pr.critical_count} crit)`}
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Clean
                    </span>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all" />
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
};
