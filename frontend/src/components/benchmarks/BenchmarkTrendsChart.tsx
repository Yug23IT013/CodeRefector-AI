import React, { useState } from 'react';
import { BenchmarkTrendPoint } from '../../types';
import { Zap, Gauge } from 'lucide-react';


interface BenchmarkTrendsChartProps {
  trends: BenchmarkTrendPoint[];
  repoName?: string;
}

export const BenchmarkTrendsChart: React.FC<BenchmarkTrendsChartProps> = ({ trends, repoName }) => {
  const [hoveredPoint, setHoveredPoint] = useState<BenchmarkTrendPoint | null>(null);
  const [metric, setMetric] = useState<'latency' | 'memory'>('latency');

  if (!trends || trends.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center">
        <Gauge className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400 font-medium">No benchmark history yet</p>
        <p className="text-xs text-slate-500 mt-1">Run benchmarks on PRs to view repository latency and memory trends.</p>
      </div>
    );
  }

  const height = 200;
  const paddingX = 40;
  const paddingY = 25;
  const width = 600;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const maxVal = metric === 'latency'
    ? Math.max(10, ...trends.map(t => Math.max(t.base_latency_ms, t.pr_latency_ms))) * 1.15
    : Math.max(10, ...trends.map(t => Math.max(t.base_memory_mb, t.pr_memory_mb))) * 1.15;

  const count = trends.length;
  const stepX = count > 1 ? innerWidth / (count - 1) : innerWidth / 2;

  const getX = (index: number) => (count === 1 ? width / 2 : paddingX + index * stepX);
  const getY = (val: number) => paddingY + innerHeight - (val / maxVal) * innerHeight;

  const basePoints = trends.map((t, i) => `${getX(i)},${getY(metric === 'latency' ? t.base_latency_ms : t.base_memory_mb)}`).join(' ');
  const prPoints = trends.map((t, i) => `${getX(i)},${getY(metric === 'latency' ? t.pr_latency_ms : t.pr_memory_mb)}`).join(' ');

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">Runtime Performance Telemetry</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {repoName ? `Base vs PR benchmark trajectory across pull requests in ${repoName}` : 'Historical benchmark trends'}
          </p>
        </div>

        <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 self-start sm:self-auto">
          <button
            onClick={() => setMetric('latency')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              metric === 'latency'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Latency (ms)
          </button>
          <button
            onClick={() => setMetric('memory')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              metric === 'memory'
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Memory (MB RSS)
          </button>
        </div>
      </div>

      {/* SVG Multi-Line Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
            const y = paddingY + innerHeight * (1 - ratio);
            const labelVal = Math.round(ratio * maxVal);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#334155"
                  strokeDasharray="4 4"
                  strokeWidth="0.75"
                  opacity="0.6"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {labelVal} {metric === 'latency' ? 'ms' : 'MB'}
                </text>
              </g>
            );
          })}

          {/* Base branch line (dashed grey) */}
          <polyline
            points={basePoints}
            fill="none"
            stroke="#64748b"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />

          {/* PR branch line (colored) */}
          <polyline
            points={prPoints}
            fill="none"
            stroke={metric === 'latency' ? '#38bdf8' : '#818cf8'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {trends.map((t, idx) => {
            const cx = getX(idx);
            const val = metric === 'latency' ? t.pr_latency_ms : t.pr_memory_mb;
            const cy = getY(val);
            const isHovered = hoveredPoint?.pr_id === t.pr_id;

            return (
              <g key={t.pr_id} className="cursor-pointer">
                <text
                  x={cx}
                  y={height - 5}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  #{t.pr_number}
                </text>

                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 5 : 3.5}
                  fill={metric === 'latency' ? '#38bdf8' : '#818cf8'}
                  stroke="#0f172a"
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredPoint(t)}
                />
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-end gap-5 text-[11px] text-slate-400 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-b border-dashed border-slate-400 inline-block" />
            <span>Base Baseline</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${metric === 'latency' ? 'bg-sky-400' : 'bg-indigo-400'}`} />
            <span className="font-medium text-slate-200">PR Branch</span>
          </div>
        </div>

        {/* Tooltip */}
        {hoveredPoint && (
          <div className="mt-2 bg-slate-950/90 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sky-400">PR #{hoveredPoint.pr_number}</span>
              <span className="text-slate-300 font-medium">{hoveredPoint.title}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400">
                Base: <strong className="text-slate-200">{metric === 'latency' ? `${hoveredPoint.base_latency_ms} ms` : `${hoveredPoint.base_memory_mb} MB`}</strong>
              </span>
              <span className="text-slate-400">
                PR: <strong className="text-sky-300">{metric === 'latency' ? `${hoveredPoint.pr_latency_ms} ms` : `${hoveredPoint.pr_memory_mb} MB`}</strong>
              </span>
              <span className={hoveredPoint.latency_change_pct <= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                {metric === 'latency'
                  ? `${hoveredPoint.latency_change_pct > 0 ? '+' : ''}${hoveredPoint.latency_change_pct}%`
                  : `${hoveredPoint.memory_change_pct > 0 ? '+' : ''}${hoveredPoint.memory_change_pct}%`}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
