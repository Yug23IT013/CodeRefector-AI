import React from 'react';
import { ShieldAlert, Bug, Zap, Palette, Layers } from 'lucide-react';

interface CategoryDistributionProps {
  categories: Record<string, number>;
  totalFindings: number;
}

export const CategoryDistribution: React.FC<CategoryDistributionProps> = ({ categories, totalFindings }) => {
  const categoryConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; barColor: string }> = {
    security: {
      label: "Security Vulnerabilities",
      icon: ShieldAlert,
      color: "text-rose-400",
      barColor: "bg-rose-500",
    },
    bug_risk: {
      label: "Bug Risks & Logic Errors",
      icon: Bug,
      color: "text-amber-400",
      barColor: "bg-amber-500",
    },
    performance: {
      label: "Performance & Complexity",
      icon: Zap,
      color: "text-yellow-400",
      barColor: "bg-yellow-500",
    },
    style: {
      label: "Style & Best Practices",
      icon: Palette,
      color: "text-blue-400",
      barColor: "bg-blue-500",
    },
    general: {
      label: "General Findings",
      icon: Layers,
      color: "text-indigo-400",
      barColor: "bg-indigo-500",
    },
  };

  const keys = Object.keys(categories);
  const total = Math.max(1, totalFindings || keys.reduce((acc, k) => acc + (categories[k] || 0), 0));

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Category Distribution</h3>
          <p className="text-xs text-slate-400 mt-0.5">Classification of detected static & AI findings</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-300 rounded-full border border-slate-700">
          {totalFindings} Total Issues
        </span>
      </div>

      {keys.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          No category findings recorded yet.
        </div>
      ) : (
        <div className="space-y-3.5 my-1">
          {keys.map((catKey) => {
            const count = categories[catKey] || 0;
            const pct = Math.round((count / total) * 100);
            const conf = categoryConfig[catKey.toLowerCase()] || {
              label: catKey.charAt(0).toUpperCase() + catKey.slice(1),
              icon: Layers,
              color: "text-slate-300",
              barColor: "bg-sky-500",
            };
            const Icon = conf.icon;

            return (
              <div key={catKey} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                    <span className="font-medium text-slate-300">{conf.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{count}</span>
                    <span className="text-slate-400 text-[11px]">({pct}%)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full ${conf.barColor} transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
