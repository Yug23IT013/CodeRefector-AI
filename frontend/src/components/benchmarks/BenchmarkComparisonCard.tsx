import React, { useState } from 'react';
import { BenchmarkRun } from '../../types';
import { api } from '../../services/api';
import {
  Zap,
  Cpu,
  HardDrive,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Play,
  RefreshCw,
  Gauge,
  Layers,
} from 'lucide-react';

interface BenchmarkComparisonCardProps {
  prId: number;
  initialBenchmark?: BenchmarkRun | null;
  onBenchmarkUpdated?: (newBenchmark: BenchmarkRun) => void;
}

export const BenchmarkComparisonCard: React.FC<BenchmarkComparisonCardProps> = ({
  prId,
  initialBenchmark,
  onBenchmarkUpdated,
}) => {
  const [benchmark, setBenchmark] = useState<BenchmarkRun | null>(initialBenchmark || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunBenchmark = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.runPRBenchmark(prId);
      setBenchmark(res);
      if (onBenchmarkUpdated) {
        onBenchmarkUpdated(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to execute benchmark run.');
    } finally {
      setLoading(false);
    }
  };

  if (!benchmark) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center backdrop-blur-sm shadow-xl">
        <Gauge className="w-12 h-12 text-sky-400 mx-auto mb-3 animate-pulse" />
        <h3 className="text-base font-semibold text-slate-200">No Benchmark Telemetry Yet</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
          Execute isolated sandboxed runtime profiling to measure execution latency, memory footprint, and detect regressions before merging.
        </p>
        <button
          onClick={handleRunBenchmark}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {loading ? 'Running Isolated Profiler...' : 'Run Performance Benchmark'}
        </button>
      </div>
    );
  }

  const {
    base_latency_ms,
    pr_latency_ms,
    latency_change_pct,
    base_memory_mb,
    pr_memory_mb,
    memory_change_pct,
    cpu_usage_pct,
    regression_detected,
    suites,
  } = benchmark;


  // Visual bar widths
  const maxLatency = Math.max(base_latency_ms, pr_latency_ms, 1);
  const baseLatWidth = Math.round((base_latency_ms / maxLatency) * 100);
  const prLatWidth = Math.round((pr_latency_ms / maxLatency) * 100);

  const maxMemory = Math.max(base_memory_mb, pr_memory_mb, 1);
  const baseMemWidth = Math.round((base_memory_mb / maxMemory) * 100);
  const prMemWidth = Math.round((pr_memory_mb / maxMemory) * 100);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-slate-100">Sandboxed Performance & Memory Profiler</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Isolated execution comparison between base branch and PR commit (<code className="text-sky-300 font-mono">{benchmark.commit_sha.substring(0, 8)}</code>)
            </p>
          </div>

          <div className="flex items-center gap-3">
            {regression_detected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Regression Detected
              </span>
            ) : latency_change_pct < -5.0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
                Performance Improved ({Math.abs(latency_change_pct)}% faster)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-300">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                Performance Stable
              </span>
            )}

            <button
              onClick={handleRunBenchmark}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
              {loading ? 'Benchmarking...' : 'Re-run Benchmark'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Visual Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {/* Execution Latency Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Execution Latency</span>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  latency_change_pct <= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                }`}
              >
                {latency_change_pct > 0 ? `+${latency_change_pct}%` : `${latency_change_pct}%`}
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Base Branch</span>
                  <span className="font-mono font-medium text-slate-300">{base_latency_ms} ms</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-slate-600 h-full rounded-full" style={{ width: `${baseLatWidth}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>PR Branch</span>
                  <span className="font-mono font-bold text-sky-400">{pr_latency_ms} ms</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      latency_change_pct > 10 ? 'bg-rose-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${prLatWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Peak Memory RSS Card */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Peak Memory (RSS)</span>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  memory_change_pct <= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                }`}
              >
                {memory_change_pct > 0 ? `+${memory_change_pct}%` : `${memory_change_pct}%`}
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>Base Branch</span>
                  <span className="font-mono font-medium text-slate-300">{base_memory_mb} MB</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-slate-600 h-full rounded-full" style={{ width: `${baseMemWidth}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>PR Branch</span>
                  <span className="font-mono font-bold text-indigo-400">{pr_memory_mb} MB</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      memory_change_pct > 15 ? 'bg-rose-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${prMemWidth}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CPU & Sandbox Stats */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Container Runtime</span>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                Isolated
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Avg CPU</span>
                <span className="text-sm font-bold text-slate-100 font-mono">{cpu_usage_pct}%</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-slate-400 block uppercase font-medium">Test Cases</span>
                <span className="text-sm font-bold text-slate-100 font-mono">{benchmark.test_cases_count} Suites</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Granular Micro-Benchmarks Table */}
      {suites && suites.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-200">Granular Micro-Benchmark Suites</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Benchmark Suite</th>
                  <th className="py-2.5 px-3">Base Latency</th>
                  <th className="py-2.5 px-3">PR Latency</th>
                  <th className="py-2.5 px-3">Variance</th>
                  <th className="py-2.5 px-3">Memory (RSS)</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {suites.map((suite, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-200">{suite.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{suite.base_ms} ms</td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-100">{suite.pr_ms} ms</td>
                    <td className="py-3 px-3 font-mono">
                      <span
                        className={`font-semibold ${
                          suite.delta_pct <= 0 ? 'text-emerald-400' : suite.delta_pct > 10 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      >
                        {suite.delta_pct > 0 ? `+${suite.delta_pct}%` : `${suite.delta_pct}%`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">{suite.memory_mb} MB</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          suite.status === 'passed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {suite.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
