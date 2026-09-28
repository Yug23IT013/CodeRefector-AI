import React from 'react';
import { HealthScoreMetrics } from '../../types';
import { ShieldCheck, AlertTriangle, AlertOctagon, TrendingUp } from 'lucide-react';

interface HealthScoreGaugeProps {
  health: HealthScoreMetrics;
  title?: string;
  subtitle?: string;
}

export const HealthScoreGauge: React.FC<HealthScoreGaugeProps> = ({
  health,
  title = "Repository Health Score",
  subtitle = "Computed from finding severity density & PR review outcomes"
}) => {
  const { score, rating, label, critical_penalty, high_penalty, medium_penalty, low_penalty } = health;

  // Determine color scheme based on score
  let strokeColor = "#10b981"; // emerald
  let textColor = "text-emerald-400";
  let bgBadge = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300";
  let Icon = ShieldCheck;

  if (score < 60) {
    strokeColor = "#ef4444"; // red
    textColor = "text-rose-400";
    bgBadge = "bg-rose-500/10 border-rose-500/30 text-rose-300";
    Icon = AlertOctagon;
  } else if (score < 80) {
    strokeColor = "#f59e0b"; // amber
    textColor = "text-amber-400";
    bgBadge = "bg-amber-500/10 border-amber-500/30 text-amber-300";
    Icon = AlertTriangle;
  } else if (score < 90) {
    strokeColor = "#0ea5e9"; // sky
    textColor = "text-sky-400";
    bgBadge = "bg-sky-500/10 border-sky-500/30 text-sky-300";
    Icon = TrendingUp;
  }

  // Circular gauge calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 tracking-wide">{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${bgBadge}`}>
          <Icon className="w-3.5 h-3.5" />
          {label} ({rating})
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 my-2">
        {/* SVG Circular Ring Gauge */}
        <div className="relative w-36 h-36 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-800/80"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={strokeColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className={`text-3xl font-extrabold tracking-tight ${textColor}`}>{score}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">/ 100 pts</span>
          </div>
        </div>

        {/* Penalty / Factor breakdown */}
        <div className="flex-1 w-full space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Score Impact Breakdown
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/60 border border-rose-500/20 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">Critical Impact</span>
              <span className="text-xs font-bold text-rose-400">
                {critical_penalty ? `-${critical_penalty}` : '0'} pts
              </span>
            </div>
            <div className="bg-slate-950/60 border border-amber-500/20 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">High Severity</span>
              <span className="text-xs font-bold text-amber-400">
                {high_penalty ? `-${high_penalty}` : '0'} pts
              </span>
            </div>
            <div className="bg-slate-950/60 border border-yellow-500/20 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">Medium Risk</span>
              <span className="text-xs font-bold text-yellow-400">
                {medium_penalty ? `-${medium_penalty}` : '0'} pts
              </span>
            </div>
            <div className="bg-slate-950/60 border border-blue-500/20 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs text-slate-400">Low / Style</span>
              <span className="text-xs font-bold text-blue-400">
                {low_penalty ? `-${low_penalty}` : '0'} pts
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
