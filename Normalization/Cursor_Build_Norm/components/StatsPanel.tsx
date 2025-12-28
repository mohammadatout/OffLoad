'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { PerformanceCharts } from './PerformanceCharts';
import { WordFrequencyAnalyzer } from './WordFrequencyAnalyzer';
import { ProcessingStats, CSVRow, ColumnInfo } from '@/lib/types';
import { BarChart, Activity, Columns, Hash, Type, Mail, Phone, Globe, MapPin, FileText, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsPanelProps {
  fileData: { data: CSVRow[]; headers: string[]; columnInfo?: ColumnInfo[] } | null;
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
  // Column Profiler Props
  onColumnProfilerOpen?: () => void;
  onColumnSelect?: (column: string) => void;
}

const getColumnIcon = (type: ColumnInfo['type']) => {
  switch (type) {
    case 'email':
      return <Mail className="w-3 h-3 text-blue-400" />;
    case 'phone':
      return <Phone className="w-3 h-3 text-green-400" />;
    case 'website':
      return <Globe className="w-3 h-3 text-orange-400" />;
    case 'address':
      return <MapPin className="w-3 h-3 text-red-400" />;
    case 'document_link':
      return <FileText className="w-3 h-3 text-pink-400" />;
    case 'text':
      return <Type className="w-3 h-3 text-gray-400" />;
    default:
      return <Hash className="w-3 h-3 text-gray-500" />;
  }
};

export const StatsPanel: React.FC<StatsPanelProps> = ({
  fileData,
  processedData,
  stats,
  wordFrequencyConfig,
  onWordFrequencyChange,
  onColumnProfilerOpen,
  onColumnSelect,
}) => {
  if (!fileData) {
    return (
      <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-obsidian-border rounded-xl bg-obsidian-layer1">
        <div className="text-center text-gray-500">
          <BarChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Waiting for Data</p>
          <p className="text-sm">Upload a CSV to view analysis</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Real-time Row Counts / Performance Stats */}
      {stats ? (
        <PerformanceCharts stats={stats} />
      ) : (
        <Card variant="obsidian">
          <CardHeader>
             <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-electric-cyan" />
                <CardTitle className="text-sm">Live Stats</CardTitle>
             </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded bg-electric-cyan/10 border border-electric-cyan/20">
                <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Total Rows</p>
                <p className="text-xl font-bold text-white font-mono">
                  {fileData.data.length.toLocaleString()}
                </p>
              </div>
              <div 
                className="p-3 rounded bg-electric-purple/10 border border-electric-purple/20 cursor-pointer hover:border-electric-purple/50 transition-colors group"
                onClick={onColumnProfilerOpen}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Columns</p>
                  {onColumnProfilerOpen && (
                    <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-electric-purple transition-colors" />
                  )}
                </div>
                <p className="text-xl font-bold text-white font-mono">
                  {fileData.headers.length}
                </p>
              </div>
            </div>
            
            {/* Column Types Summary */}
            {fileData.columnInfo && fileData.columnInfo.length > 0 && (
              <div className="mt-4 pt-4 border-t border-obsidian-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Column Types</p>
                  {onColumnProfilerOpen && (
                    <button
                      onClick={onColumnProfilerOpen}
                      className="text-[10px] text-electric-cyan hover:text-electric-cyan-dark transition-colors"
                    >
                      View All →
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {fileData.columnInfo.slice(0, 8).map((col, idx) => (
                    <motion.div
                      key={col.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-2 p-1.5 rounded bg-obsidian-hover/50 hover:bg-obsidian-hover transition-colors cursor-pointer group"
                      onClick={() => {
                        onColumnSelect?.(col.name);
                        onColumnProfilerOpen?.();
                      }}
                    >
                      {getColumnIcon(col.type)}
                      <span className="text-xs text-gray-400 truncate flex-1">{col.name}</span>
                      <span className="text-[10px] text-gray-600 group-hover:text-gray-400 transition-colors">
                        {col.type}
                      </span>
                    </motion.div>
                  ))}
                  {fileData.columnInfo.length > 8 && (
                    <button
                      onClick={onColumnProfilerOpen}
                      className="w-full p-1.5 text-[10px] text-center text-gray-500 hover:text-electric-cyan transition-colors"
                    >
                      +{fileData.columnInfo.length - 8} more columns
                    </button>
                  )}
                </div>
              </div>
            )}
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
