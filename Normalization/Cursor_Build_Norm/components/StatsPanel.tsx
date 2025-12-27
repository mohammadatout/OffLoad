'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { PerformanceCharts } from './PerformanceCharts';
import { WordFrequencyAnalyzer } from './WordFrequencyAnalyzer';
import { ProcessingStats, CSVRow } from '@/lib/types';
import { BarChart, Activity } from 'lucide-react';

interface StatsPanelProps {
  fileData: { data: CSVRow[]; headers: string[] } | null;
  processedData: CSVRow[];
  stats: ProcessingStats | null;
  // Word Frequency Props
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
  processedData,
  stats,
  wordFrequencyConfig,
  onWordFrequencyChange,
}) => {
  if (!fileData) {
    return (
      <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-light-border dark:border-dark-border rounded-xl bg-gray-50 dark:bg-gray-800/30">
        <div className="text-center text-gray-400 dark:text-gray-500">
          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Waiting for Data</p>
          <p className="text-sm">Upload a CSV to view analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Row Counts / Performance Stats */}
      {stats ? (
        <PerformanceCharts stats={stats} />
      ) : (
        <Card>
          <CardHeader>
             <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent-blue" />
                <CardTitle>Live Stats</CardTitle>
             </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Rows</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {fileData.data.length.toLocaleString()}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">Columns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {fileData.headers.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Word Frequency Analysis */}
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

