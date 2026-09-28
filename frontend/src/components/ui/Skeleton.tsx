import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle' | 'card';
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 rounded-md',
    rect: 'rounded-xl',
    circle: 'rounded-full',
    card: 'rounded-2xl h-48',
  };

  return (
    <div
      className={`animate-pulse bg-surface-2/60 border border-border-subtle ${variantStyles[variant]} ${className}`}
      style={{ width, height, ...style }}
      {...props}
    />
  );
};
