import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevation?: 'flat' | 'default' | 'elevated' | 'glass';
  interactive?: boolean;
  glow?: 'none' | 'sky' | 'indigo' | 'rose';
}

export const Card: React.FC<CardProps> = ({
  children,
  elevation = 'default',
  interactive = false,
  glow = 'none',
  className = '',
  ...props
}) => {
  const elevationClasses = {
    flat: 'bg-surface-1 border border-border-subtle',
    default: 'bg-surface-1/90 border border-border-subtle shadow-card',
    elevated: 'bg-surface-2 border border-border-prominent shadow-card',
    glass: 'bg-surface-1/70 backdrop-blur-xl border border-border-subtle shadow-card',
  };

  const interactiveClasses = interactive
    ? 'hover:border-border-prominent hover:bg-surface-1 hover:shadow-card-hover transition-all duration-200 cursor-pointer'
    : '';

  const glowClasses = {
    none: '',
    sky: 'hover:border-brand-400/40 hover:shadow-glow-sky',
    indigo: 'hover:border-indigo-500/40 hover:shadow-glow-indigo',
    rose: 'hover:border-rose-500/40 hover:shadow-glow-rose',
  };

  return (
    <div
      className={`rounded-2xl overflow-hidden ${elevationClasses[elevation]} ${interactiveClasses} ${glowClasses[glow]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
