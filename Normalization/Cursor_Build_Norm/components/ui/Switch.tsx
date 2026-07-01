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
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-app-text/40 dark:focus:ring-gray-300',
          checked
            ? 'bg-[#74bf4b] dark:bg-[#74bf4b]'
            : 'bg-[#D5D3CC] dark:bg-gray-600',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full shadow-sm ring-1 ring-black/10 transition-transform',
            checked
              ? 'translate-x-[18px] bg-white dark:bg-[#0A0A0A]'
              : 'translate-x-1 bg-white dark:bg-gray-100',
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

