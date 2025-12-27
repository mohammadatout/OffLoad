import React from 'react';
import { cn } from '@/lib/utils';

export interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, className }) => {
  const activeTabData = tabs.find(tab => tab.id === activeTab);
  
  return (
    <div className={cn('w-full', className)}>
      <div className="border-b border-light-border dark:border-dark-border">
        <div className="flex space-x-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium rounded-t-lg transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-accent-blue dark:focus:ring-accent-cyan',
                activeTab === tab.id
                  ? 'bg-light-card dark:bg-dark-card text-accent-blue dark:text-accent-cyan border-b-2 border-accent-blue dark:border-accent-cyan'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {activeTabData?.content}
      </div>
    </div>
  );
};

Tabs.displayName = 'Tabs';

