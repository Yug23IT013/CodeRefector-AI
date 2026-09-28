import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'purple' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  icon,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 rounded-md font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 rounded-lg font-medium',
  };

  const variantClasses = {
    brand: 'bg-brand-400/10 text-brand-300 border border-brand-400/25',
    neutral: 'bg-surface-2 text-slate-300 border border-border-subtle',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25',
    warning: 'bg-amber-500/10 text-amber-300 border border-amber-500/25',
    danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/25',
    purple: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25',
    outline: 'bg-transparent text-slate-400 border border-border-subtle',
  };

  const dotColorClasses = {
    brand: 'bg-brand-400',
    neutral: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    purple: 'bg-indigo-400',
    outline: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center select-none ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColorClasses[variant]}`}
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
