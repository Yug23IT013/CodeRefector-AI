import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glow';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1.5 rounded-lg',
    sm: 'px-3 py-1.5 text-xs font-semibold gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-sm font-medium gap-2 rounded-xl',
    lg: 'px-6 py-3 text-sm sm:text-base font-semibold gap-2.5 rounded-xl',
  };

  const variantClasses = {
    primary:
      'bg-brand-500 hover:bg-brand-400 text-surface-0 font-semibold shadow-md shadow-brand-500/20 active:scale-[0.98]',
    glow:
      'bg-gradient-to-r from-sky-400 via-brand-500 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-surface-0 font-bold shadow-glow-sky active:scale-[0.98]',
    secondary:
      'bg-surface-2 hover:bg-surface-3 text-slate-200 hover:text-white border border-border-subtle hover:border-border-prominent active:scale-[0.98]',
    outline:
      'bg-transparent hover:bg-surface-2/60 text-slate-300 hover:text-white border border-border-subtle hover:border-border-prominent active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-surface-2/80 text-slate-400 hover:text-slate-100 active:scale-[0.98]',
    danger:
      'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-[0.98]',
  };

  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-200 select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
    </button>
  );
};
