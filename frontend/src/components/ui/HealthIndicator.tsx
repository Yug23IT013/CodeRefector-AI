import React from 'react';

export interface HealthIndicatorProps {
  criticalCount?: number;
  highCount?: number;
  showLabel?: boolean;
}

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  criticalCount = 0,
  highCount = 0,
  showLabel = true,
}) => {
  let status: 'clean' | 'warning' | 'critical' = 'clean';
  let label = 'Clean';
  let dotColor = 'bg-emerald-400 shadow-emerald-500/50';
  let textColor = 'text-emerald-400';

  if (criticalCount > 0) {
    status = 'critical';
    label = `${criticalCount} Critical`;
    dotColor = 'bg-rose-400 shadow-rose-500/50';
    textColor = 'text-rose-400';
  } else if (highCount > 0) {
    status = 'warning';
    label = `${highCount} High`;
    dotColor = 'bg-amber-400 shadow-amber-500/50';
    textColor = 'text-amber-400';
  }

  return (
    <div className="inline-flex items-center gap-1.5" title={`Health status: ${status}`}>
      <span className="relative flex h-2 w-2">
        <span
          className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
        />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
      </span>
      {showLabel && <span className={`text-xs font-semibold ${textColor}`}>{label}</span>}
    </div>
  );
};
