import React from 'react';

export interface StatChipProps {
  label: string;
  value: number | string;
  variant?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}

export const StatChip: React.FC<StatChipProps> = ({
  label,
  value,
  variant = 'neutral',
  icon,
}) => {
  const variantStyles = {
    neutral: 'bg-surface-2/80 text-slate-300 border-border-subtle',
    brand: 'bg-brand-500/10 text-brand-300 border-brand-500/25',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  };

  const valueStyles = {
    neutral: 'text-white',
    brand: 'text-brand-300 font-bold',
    success: 'text-emerald-400 font-bold',
    warning: 'text-amber-300 font-bold',
    danger: 'text-rose-400 font-bold',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono select-none ${variantStyles[variant]}`}
    >
      {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
      <span className="text-slate-400 text-[11px] uppercase tracking-wider font-sans">
        {label}
      </span>
      <span className={valueStyles[variant]}>{value}</span>
    </div>
  );
};
