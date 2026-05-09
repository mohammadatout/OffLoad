import React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled = false, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-app-text dark:focus:ring-gray-300',
          checked
            ? 'bg-app-text dark:bg-gray-200'
            : 'bg-gray-300 dark:bg-gray-600',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full shadow-sm ring-1 ring-black/10 transition-transform',
            checked
              ? 'translate-x-6 bg-white dark:bg-[#0A0A0A]'
              : 'translate-x-1 bg-white dark:bg-gray-100',
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

