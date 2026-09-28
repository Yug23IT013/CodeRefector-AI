import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { PullRequestDetail, BenchmarkRun } from '../types';
import { PRStatusBadge } from '../components/PRStatusBadge';
import { FindingCard } from '../components/FindingCard';
import { BenchmarkComparisonCard } from '../components/benchmarks/BenchmarkComparisonCard';
import {
  ArrowLeft,
  Sparkles,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  AlertOctagon,
  GitCommit,
  User as UserIcon,
  ShieldAlert,
  Gauge,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

export const PRDetailPage: React.FC = () => {
  const { prId } = useParams<{ prId: string }>();
  const id = Number(prId);

  const [pr, setPr] = useState<PullRequestDetail | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [reRunning, setReRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<'findings' | 'benchmarks'>('findings');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [prData, benchData] = await Promise.all([
        api.getPullRequest(id),
        api.getPRBenchmarks(id).catch(() => null),
      ]);
      setPr(prData);
      setBenchmark(benchData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pull request details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Automatically poll every 2 seconds while a review is in progress
  useEffect(() => {
    if (!pr || pr.latest_review?.status !== 'in_progress') {
      if (reRunning) setReRunning(false);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const data = await api.getPullRequest(id);
        setPr(data);
        if (data.latest_review?.status !== 'in_progress') {
          clearInterval(interval);
          setReRunning(false);
        }
      } catch (e) {
        clearInterval(interval);
        setReRunning(false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id, pr?.latest_review?.status, reRunning]);

  const handleReReview = async () => {
    try {
      setReRunning(true);
      await api.triggerReReview(id);
      setTimeout(async () => {
        try {
          const data = await api.getPullRequest(id);
          setPr(data);
        } catch (e) {
          // no-op
        }
      }, 500);
    } catch (err: any) {
      alert(`Error triggering review: ${err.message}`);
      setReRunning(false);
    }
  };

  if (loading && !pr) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <Skeleton variant="text" width="200px" />
        <Card elevation="default" className="p-8 space-y-4">
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="30%" />
        </Card>
        <Card elevation="default" className="p-8 space-y-4">
          <Skeleton variant="text" width="100%" />
          <Skeleton variant="text" width="90%" />
        </Card>
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center mx-auto mb-3 text-rose-400">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Unable to load pull request</h2>
        <p className="text-sm text-slate-400 mt-1">{error || 'PR not found'}</p>
        <Link to="/" className="mt-4 inline-block text-xs text-brand-400 hover:underline">
          Return to Repositories
        </Link>
      </div>
    );
  }

  const findings = pr.findings || [];
  const filteredFindings = findings.filter((f) => {
    if (filterSeverity === 'all') return true;
    return f.severity.toLowerCase() === filterSeverity;
  });

  const criticalCount = findings.filter((f) => f.severity === 'critical').length;
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back Link */}
      <Link
        to={`/repos/${pr.repo_id}/pulls`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to {pr.repo_name} Pull Requests</span>
      </Link>

      {/* PR Header Card */}
      <Card elevation="default" className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <span className="font-mono text-sm font-bold text-brand-400">#{pr.pr_number}</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                {pr.title || 'Untitled Pull Request'}
              </h1>
              <PRStatusBadge status={pr.latest_review?.status || pr.status} />
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap mt-3">
              <span className="flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Author: <span className="text-slate-200 font-semibold">@{pr.author}</span></span>
              </span>
              <span>•</span>
              <span>Repo: <span className="text-slate-200 font-medium">{pr.repo_name}</span></span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-mono bg-surface-2 px-2 py-0.5 rounded-md text-slate-300 border border-border-subtle">
                <GitCommit className="w-3 h-3 text-slate-500" />
                Commit {pr.head_sha.substring(0, 8)}
              </span>
              {pr.html_url && (
                <>
                  <span>•</span>
                  <a
                    href={pr.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-400 hover:text-brand-300 inline-flex items-center gap-1 transition-colors font-medium"
                  >
                    <span>View on GitHub</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-auto">
            <Button
              variant="glow"
              size="md"
              onClick={handleReReview}
              loading={reRunning}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {reRunning ? 'Reviewing...' : 'Re-Run Review'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 mt-8 pb-3 border-b border-border-subtle">
        <button
          onClick={() => setActiveTab('findings')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'findings'
              ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20'
              : 'bg-surface-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Code Review & Findings ({findings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('benchmarks')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'benchmarks'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-surface-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Sandboxed Benchmarks & Memory</span>
          {benchmark && benchmark.regression_detected && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
      </div>

      {activeTab === 'benchmarks' ? (
        <div className="mt-8">
          <BenchmarkComparisonCard
            prId={pr.id}
            initialBenchmark={benchmark}
            onBenchmarkUpdated={(updated) => setBenchmark(updated)}
          />
        </div>
      ) : (
        <>
          {/* AI Executive Summary Card */}
          {pr.latest_review?.ai_summary ? (
            <Card
              elevation="glass"
              className="mt-8 border-indigo-500/30 bg-gradient-to-br from-surface-1 via-surface-1 to-indigo-950/20 p-6 sm:p-8 shadow-card-hover"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-indigo-500/20">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">AI Executive Summary</h2>
                    <span className="text-[11px] text-indigo-300/80 font-mono">
                      Synthesized from static AST findings & Groq AI analysis
                    </span>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-slate-400">
                  Completed {pr.latest_review.completed_at ? new Date(pr.latest_review.completed_at).toLocaleTimeString() : ''}
                </span>
              </div>

              <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed space-y-2 whitespace-pre-line font-sans">
                {pr.latest_review.ai_summary}
              </div>
            </Card>
          ) : pr.latest_review?.status === 'in_progress' ? (
            <div className="mt-8 p-6 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center gap-3 text-brand-300 text-sm animate-pulse">
              <RefreshCw className="w-5 h-5 animate-spin text-brand-400" />
              <span>Static AST analysis and Groq AI review currently in progress for this commit...</span>
            </div>
          ) : pr.latest_review?.status === 'failed' ? (
            <div className="mt-8 p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              <div className="flex items-center gap-2 font-bold mb-1 text-rose-400">
                <AlertOctagon className="w-5 h-5" />
                <span>Review Run Failed</span>
              </div>
              <p className="text-xs font-mono bg-surface-0 p-3 rounded-lg border border-rose-500/25 text-rose-200 mt-2 overflow-x-auto whitespace-pre-wrap">
                {pr.latest_review.error_message || 'Review execution failed.'}
              </p>
            </div>
          ) : null}

          {/* Findings Section */}
          <div className="mt-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-white">Review Findings</h2>
                  <Badge variant="brand" size="sm">
                    {findings.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Static AST rules & security smell detections mapped to source code lines.
                </p>
              </div>

              {/* Severity Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setFilterSeverity('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterSeverity === 'all'
                      ? 'bg-brand-500 text-surface-0 font-bold shadow-sm'
                      : 'bg-surface-2 text-slate-400 hover:text-slate-200 hover:bg-surface-3'
                  }`}
                >
                  All ({findings.length})
                </button>

                <button
                  onClick={() => setFilterSeverity('critical')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterSeverity === 'critical'
                      ? 'bg-rose-500 text-white font-bold shadow-sm'
                      : 'bg-surface-2 text-slate-400 hover:text-rose-300 hover:bg-surface-3'
                  }`}
                >
                  Crit ({criticalCount})
                </button>

                <button
                  onClick={() => setFilterSeverity('high')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterSeverity === 'high'
                      ? 'bg-amber-500 text-surface-0 font-bold shadow-sm'
                      : 'bg-surface-2 text-slate-400 hover:text-amber-300 hover:bg-surface-3'
                  }`}
                >
                  High ({highCount})
                </button>

                <button
                  onClick={() => setFilterSeverity('medium')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterSeverity === 'medium'
                      ? 'bg-yellow-400 text-surface-0 font-bold shadow-sm'
                      : 'bg-surface-2 text-slate-400 hover:text-yellow-200 hover:bg-surface-3'
                  }`}
                >
                  Med ({mediumCount})
                </button>

                <button
                  onClick={() => setFilterSeverity('low')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    filterSeverity === 'low'
                      ? 'bg-sky-400 text-surface-0 font-bold shadow-sm'
                      : 'bg-surface-2 text-slate-400 hover:text-sky-200 hover:bg-surface-3'
                  }`}
                >
                  Low ({lowCount})
                </button>
              </div>
            </div>

            {/* Findings List */}
            <div className="mt-6 space-y-4">
              {filteredFindings.length === 0 ? (
                <Card elevation="default" className="py-12 text-center border-dashed">
                  <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-white">No findings in this category</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {filterSeverity === 'all'
                      ? 'Great job! No code smells or security flaws detected in this PR.'
                      : `No ${filterSeverity} issues identified in this pull request.`}
                  </p>
                </Card>
              ) : (
                filteredFindings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

