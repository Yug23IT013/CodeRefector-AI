import React from 'react';
import { Clock, RefreshCw, CheckCircle2, AlertOctagon, GitPullRequest, GitMerge } from 'lucide-react';

export interface PRStatusBadgeProps {
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'open' | 'closed' | 'merged' | string;
  className?: string;
  size?: 'sm' | 'md';
}

export const PRStatusBadge: React.FC<PRStatusBadgeProps> = ({
  status,
  className = '',
  size = 'sm',
}) => {
  const norm = (status || 'pending').toLowerCase();

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 rounded-md',
    md: 'text-xs px-2.5 py-1 gap-1.5 rounded-lg',
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  switch (norm) {
    case 'merged':
      return (
        <span
          className={`inline-flex items-center font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 ${sizeClasses[size]} ${className}`}
        >
          <GitMerge className={`${iconSize} text-purple-400`} />
          Merged
        </span>
      );
    case 'in_progress':
      return (
        <span
          className={`inline-flex items-center font-medium bg-brand-500/10 text-brand-300 border border-brand-500/30 animate-pulse ${sizeClasses[size]} ${className}`}
        >
          <RefreshCw className={`${iconSize} animate-spin text-brand-400`} />
          Reviewing
        </span>
      );
    case 'completed':
      return (
        <span
          className={`inline-flex items-center font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses[size]} ${className}`}
        >
          <CheckCircle2 className={`${iconSize} text-emerald-400`} />
          Reviewed
        </span>
      );
    case 'failed':
      return (
        <span
          className={`inline-flex items-center font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 ${sizeClasses[size]} ${className}`}
        >
          <AlertOctagon className={`${iconSize} text-rose-400`} />
          Failed
        </span>
      );
    case 'closed':
      return (
        <span
          className={`inline-flex items-center font-medium bg-slate-500/15 text-slate-400 border border-border-subtle ${sizeClasses[size]} ${className}`}
        >
          <AlertOctagon className={`${iconSize} text-slate-400`} />
          Closed
        </span>
      );
    case 'open':
      return (
        <span
          className={`inline-flex items-center font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses[size]} ${className}`}
        >
          <GitPullRequest className={`${iconSize} text-emerald-400`} />
          Open
        </span>
      );
    case 'pending':
    default:
      return (
        <span
          className={`inline-flex items-center font-medium bg-surface-2 text-slate-400 border border-border-subtle ${sizeClasses[size]} ${className}`}
        >
          <Clock className={`${iconSize} text-slate-400`} />
          Pending
        </span>
      );
  }
};
