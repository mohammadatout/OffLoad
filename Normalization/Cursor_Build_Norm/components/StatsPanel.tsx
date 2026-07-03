'use client';

import React from 'react';
import { PerformanceCharts } from './PerformanceCharts';
import { WordFrequencyAnalyzer } from './WordFrequencyAnalyzer';
import { ProcessingStats, CSVRow, ColumnInfo } from '@/lib/types';
import { BarChart as BarChartIcon } from 'lucide-react';

interface StatsPanelProps {
  fileData: { data: CSVRow[]; headers: string[]; columnInfo?: ColumnInfo[] } | null;
  stats: ProcessingStats | null;
  wordFrequencyConfig: {
    columns: string[];
    selectedColumns: string[];
    excludeStopwords: boolean;
    existingExclusions: string[];
  };
  onWordFrequencyChange: {
    onColumnSelectionChange: (columns: string[]) => void;
    onExcludeStopwordsChange: (exclude: boolean) => void;
    onAddToExclusion: (word: string) => void;
  };
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  fileData,
  stats,
  wordFrequencyConfig,
  onWordFrequencyChange,
}) => {
  if (!fileData) {
    return (
      <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-obsidian-border rounded-xl bg-obsidian-layer1">
        <div className="text-center text-app-muted">
          <BarChartIcon className="w-12 h-12 mx-auto mb-4 opacity-40 text-app-text" strokeWidth={1.25} />
          <p className="text-lg font-medium text-app-text">Waiting for Data</p>
          <p className="text-sm">Upload a CSV to view analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats ? <PerformanceCharts stats={stats} /> : null}

      <WordFrequencyAnalyzer
        data={fileData.data}
        columns={wordFrequencyConfig.columns}
        selectedColumns={wordFrequencyConfig.selectedColumns}
        onColumnSelectionChange={onWordFrequencyChange.onColumnSelectionChange}
        excludeStopwords={wordFrequencyConfig.excludeStopwords}
        onExcludeStopwordsChange={onWordFrequencyChange.onExcludeStopwordsChange}
        onAddToExclusion={onWordFrequencyChange.onAddToExclusion}
        existingExclusions={wordFrequencyConfig.existingExclusions}
      />
    </div>
  );
};
