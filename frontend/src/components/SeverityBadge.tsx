import React from 'react';
import { AlertOctagon, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export interface SeverityBadgeProps {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'clean' | string;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  size = 'md',
  className = '',
  showIcon = true,
}) => {
  const norm = (severity || 'low').toLowerCase();

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (norm) {
    case 'critical':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <AlertOctagon className={`${iconSize} text-rose-400`} />}
          Critical
        </span>
      );
    case 'high':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <AlertTriangle className={`${iconSize} text-amber-400`} />}
          High
        </span>
      );
    case 'medium':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <AlertCircle className={`${iconSize} text-yellow-300`} />}
          Medium
        </span>
      );
    case 'clean':
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <CheckCircle2 className={`${iconSize} text-emerald-400`} />}
          Clean
        </span>
      );
    case 'low':
    default:
      return (
        <span
          className={`inline-flex items-center font-semibold rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30 ${sizeClasses[size]} ${className}`}
        >
          {showIcon && <Info className={`${iconSize} text-sky-400`} />}
          Low
        </span>
      );
  }
};
