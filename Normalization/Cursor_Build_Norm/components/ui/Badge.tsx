import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'poor' | 'danger' | 'info';
  children: React.ReactNode;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-[#e2e2e2] dark:bg-gray-700 text-[#414344] dark:text-gray-200',
      success: 'bg-[rgba(116,191,75,0.28)] dark:bg-green-900/40 text-[#080D44] dark:text-green-200',
      warning: 'bg-[rgba(245,158,11,0.22)] dark:bg-amber-900/35 text-[#92400e] dark:text-amber-200',
      poor: 'bg-[rgba(249,115,22,0.22)] dark:bg-orange-900/35 text-[#c2410c] dark:text-orange-200',
      danger: 'bg-[rgba(227,36,27,0.14)] dark:bg-red-900/30 text-[#e3241b] dark:text-red-200',
      info: 'bg-[rgba(8,13,68,0.08)] dark:bg-blue-900/40 text-[#080D44] dark:text-blue-200',
    };
    
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

