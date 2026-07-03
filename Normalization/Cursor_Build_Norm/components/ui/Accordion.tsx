'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  icon?: React.ReactNode;
  /** Tighter padding and typography for narrow config rails */
  dense?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  title,
  children,
  isOpen = false,
  onToggle,
  icon,
  dense = false,
}) => {
  return (
    <div
      className={cn(
        'border border-light-border dark:border-dark-border rounded-lg overflow-hidden bg-white dark:bg-dark-card',
        dense ? 'mb-2' : 'mb-3'
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left',
          dense ? 'px-3 py-2' : 'px-4 py-3'
        )}
      >
        <div className={cn('flex items-center', dense ? 'gap-2' : 'gap-3')}>
          {icon && (
            <span className="flex shrink-0 text-app-text [&_svg]:text-app-text">{icon}</span>
          )}
          <span
            className={cn(
              'font-medium text-app-text dark:text-gray-100',
              dense && 'text-[12px] tracking-[0.01em]'
            )}
          >
            {title}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown
            className={cn(
              'text-app-muted dark:text-gray-400',
              dense ? 'w-4 h-4' : 'w-5 h-5'
            )}
            strokeWidth={1.5}
          />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div
              className={cn(
                'border-t border-light-border dark:border-dark-border',
                dense ? 'p-3' : 'p-4'
              )}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

