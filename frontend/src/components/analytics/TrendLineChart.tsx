import React, { useState } from 'react';
import { QualityTrendPoint } from '../../types';
import { Activity } from 'lucide-react';


interface TrendLineChartProps {
  trends: QualityTrendPoint[];
  repoName?: string;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({ trends, repoName }) => {
  const [hoveredPoint, setHoveredPoint] = useState<QualityTrendPoint | null>(null);
  const [viewMode, setViewMode] = useState<'findings' | 'health'>('findings');

  if (!trends || trends.length === 0) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center">
        <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400 font-medium">No historical review data yet</p>
        <p className="text-xs text-slate-500 mt-1">Review PRs or run webhook events to populate quality trends.</p>
      </div>
    );
  }

  // Dimensions
  const height = 220;
  const paddingX = 40;
  const paddingY = 30;
  const width = 600;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  // Max calculations
  const maxFindings = Math.max(5, ...trends.map(t => t.findings_count));
  const count = trends.length;
  const stepX = count > 1 ? innerWidth / (count - 1) : innerWidth / 2;

  // Coordinate helpers
  const getX = (index: number) => (count === 1 ? width / 2 : paddingX + index * stepX);
  const getYFindings = (val: number) => paddingY + innerHeight - (val / maxFindings) * innerHeight;
  const getYHealth = (val: number) => paddingY + innerHeight - (val / 100) * innerHeight;

  // Paths
  const findingsPoints = trends.map((t, i) => `${getX(i)},${getYFindings(t.findings_count)}`).join(' ');
  const healthPoints = trends.map((t, i) => `${getX(i)},${getYHealth(t.health_score)}`).join(' ');

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-200">Historical Code Quality Trends</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {repoName ? `Tracking trajectory across ${trends.length} pull requests in ${repoName}` : `Across ${trends.length} PR reviews`}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-slate-950/80 p-1 rounded-lg border border-slate-800/80 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('findings')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === 'findings'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Findings Count
          </button>
          <button
            onClick={() => setViewMode('health')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              viewMode === 'health'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Health Score (0-100)
          </button>
        </div>
      </div>

      {/* SVG Chart Area */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 select-none"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          <defs>
            <linearGradient id="findingsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="healthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingY + innerHeight * (1 - ratio);
            const labelVal = viewMode === 'findings' ? Math.round(ratio * maxFindings) : Math.round(ratio * 100);
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
                  {labelVal}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          {viewMode === 'findings' ? (
            <>
              <polygon
                points={`${getX(0)},${paddingY + innerHeight} ${findingsPoints} ${getX(trends.length - 1)},${paddingY + innerHeight}`}
                fill="url(#findingsGrad)"
              />
              <polyline
                points={findingsPoints}
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <polygon
                points={`${getX(0)},${paddingY + innerHeight} ${healthPoints} ${getX(trends.length - 1)},${paddingY + innerHeight}`}
                fill="url(#healthGrad)"
              />
              <polyline
                points={healthPoints}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Data Points */}
          {trends.map((t, idx) => {
            const cx = getX(idx);
            const cy = viewMode === 'findings' ? getYFindings(t.findings_count) : getYHealth(t.health_score);
            const isHovered = hoveredPoint?.pr_id === t.pr_id;

            return (
              <g key={t.pr_id} className="cursor-pointer">
                {/* PR label on X axis */}
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94a3b8"
                  fontWeight="600"
                >
                  PR #{t.pr_number}
                </text>

                {/* Vertical hover guide line */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={paddingY}
                    x2={cx}
                    y2={paddingY + innerHeight}
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Point circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4}
                  fill={viewMode === 'findings' ? '#0ea5e9' : '#10b981'}
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="transition-all duration-150"
                  onMouseEnter={() => setHoveredPoint(t)}
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div className="mt-2 bg-slate-950/90 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold">
                #{hoveredPoint.pr_number}
              </div>
              <div>
                <p className="font-semibold text-slate-200">{hoveredPoint.title || `PR #${hoveredPoint.pr_number}`}</p>
                <p className="text-[11px] text-slate-400">By @{hoveredPoint.author} on {hoveredPoint.date}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-slate-400">Critical:</span>
                <span className="font-bold text-rose-400">{hoveredPoint.critical}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-400">High:</span>
                <span className="font-bold text-amber-400">{hoveredPoint.high}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-slate-400">Medium:</span>
                <span className="font-bold text-yellow-400">{hoveredPoint.medium}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-400">Health:</span>
                <span className="font-bold text-emerald-400">{hoveredPoint.health_score}/100</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
