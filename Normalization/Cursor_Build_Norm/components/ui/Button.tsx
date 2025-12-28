import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'electric';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-electric-cyan text-obsidian-base hover:bg-electric-cyan-dark rounded',
      secondary: 'bg-obsidian-hover text-gray-300 hover:bg-obsidian-border hover:text-white rounded',
      outline: 'border border-obsidian-border text-gray-400 hover:border-electric-cyan hover:text-electric-cyan rounded',
      ghost: 'text-gray-400 hover:bg-obsidian-hover hover:text-gray-200 rounded',
      danger: 'bg-neon-red text-white hover:bg-red-600 rounded',
      electric: 'bg-electric-cyan text-obsidian-base hover:bg-electric-cyan-dark rounded shadow-electric hover:shadow-electric-lg',
    };
    
    const sizes = {
      xs: 'px-2 py-1 text-xs rounded',
      sm: 'px-3 py-1.5 text-sm rounded',
      md: 'px-4 py-2 text-sm rounded',
      lg: 'px-6 py-3 text-base rounded',
    };
    
    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
