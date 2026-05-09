'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Badge } from './ui/Badge';
import { Filter, Download, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { WordFrequency } from '@/lib/types';
import { calculateWordFrequency, exportWordFrequencyToCSV } from '@/lib/dataProcessing';
import { CSVRow } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WordFrequencyAnalyzerProps {
  data: CSVRow[];
  columns: string[];
  selectedColumns: string[];
  onColumnSelectionChange: (columns: string[]) => void;
  excludeStopwords: boolean;
  onExcludeStopwordsChange: (exclude: boolean) => void;
  onAddToExclusion?: (word: string) => void;
  existingExclusions?: string[];
}

export const WordFrequencyAnalyzer: React.FC<WordFrequencyAnalyzerProps> = ({
  data,
  columns,
  selectedColumns,
  onColumnSelectionChange,
  excludeStopwords,
  onExcludeStopwordsChange,
  onAddToExclusion,
  existingExclusions = [],
}) => {
  const [frequencies, setFrequencies] = useState<WordFrequency[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showTopN, setShowTopN] = useState(50);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const normalizedExclusions = existingExclusions.map(entry => entry.toUpperCase());

  useEffect(() => {
    if (!columnMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [columnMenuOpen]);

  const toggleAnalysisColumn = (column: string) => {
    if (selectedColumns.includes(column)) {
      onColumnSelectionChange(selectedColumns.filter((c) => c !== column));
    } else {
      onColumnSelectionChange([...selectedColumns, column]);
    }
  };

  const columnSummary =
    selectedColumns.length === 0
      ? 'Select columns…'
      : selectedColumns.length === 1
        ? selectedColumns[0]
        : `${selectedColumns.length} columns selected`;
  
  useEffect(() => {
    if (data.length > 0 && selectedColumns.length > 0) {
      const freqs = calculateWordFrequency(data, selectedColumns, excludeStopwords);
      setFrequencies(freqs);
    } else {
      setFrequencies([]);
    }
  }, [data, selectedColumns, excludeStopwords]);
  
  const handleExport = () => {
    if (frequencies.length === 0) return;
    
    const csvContent = exportWordFrequencyToCSV(frequencies);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.setAttribute('href', url);
    link.setAttribute('download', `word_frequency_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  return (
    <Card>
      <CardHeader>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <Filter className="w-6 h-6 text-accent-blue dark:text-accent-cyan" />
            <CardTitle>Word Frequency Analysis</CardTitle>
            {frequencies.length > 0 && (
              <Badge variant="info">{frequencies.length} unique words</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {frequencies.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900 dark:text-gray-100">
                Exclude Common Stopwords
              </p>
              <Switch
                checked={excludeStopwords}
                onCheckedChange={onExcludeStopwordsChange}
              />
            </div>
            
            <div ref={columnMenuRef} className="relative">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select Columns for Analysis
              </p>
              <button
                type="button"
                id="wf-analysis-columns-trigger"
                aria-expanded={columnMenuOpen}
                aria-haspopup="listbox"
                onClick={() => setColumnMenuOpen((o) => !o)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg px-3 py-2 text-sm text-left text-gray-900 dark:text-gray-100',
                  'hover:border-app-border-hover dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-app-text/20 dark:focus:ring-gray-500'
                )}
              >
                <span className="truncate min-w-0">{columnSummary}</span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 shrink-0 text-gray-500 transition-transform',
                    columnMenuOpen && 'rotate-180'
                  )}
                />
              </button>
              {columnMenuOpen && (
                <ul
                  role="listbox"
                  aria-multiselectable="true"
                  className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg py-1 shadow-md"
                >
                  {columns.map((column) => {
                    const selected = selectedColumns.includes(column);
                    return (
                      <li key={column} role="option" aria-selected={selected}>
                        <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80">
                          <input
                            type="checkbox"
                            className="rounded border-light-border dark:border-dark-border text-app-text focus:ring-app-text"
                            checked={selected}
                            onChange={() => toggleAnalysisColumn(column)}
                          />
                          <span className="truncate text-gray-900 dark:text-gray-100">{column}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                Open the list and check one or more columns.
              </p>
            </div>
          </div>
          
          {/* Frequency Table */}
          {frequencies.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Top Words by Frequency
                </p>
                <select
                  value={showTopN}
                  onChange={(e) => setShowTopN(Number(e.target.value))}
                  className="px-3 py-1 rounded-lg border border-light-border dark:border-dark-border bg-white dark:bg-dark-bg text-sm"
                >
                  <option value={25}>Top 25</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                  <option value={frequencies.length}>All</option>
                </select>
              </div>
              
              <div className="max-h-96 overflow-y-auto border border-light-border dark:border-dark-border rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Rank
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Word
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Count
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-light-border dark:divide-dark-border">
                    {frequencies.slice(0, showTopN).map((freq, index) => {
                      const canAdd =
                        !!onAddToExclusion &&
                        !normalizedExclusions.includes(freq.word.toUpperCase());
                      return (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {freq.word}
                        </td>
                        <td className="px-4 py-2 text-sm text-right text-gray-900 dark:text-gray-100">
                          {freq.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAddToExclusion?.(freq.word)}
                            disabled={!canAdd}
                            className={cn(
                              canAdd &&
                                'border-[#414344] text-gray-800 dark:text-gray-100 hover:border-electric-cyan hover:text-electric-cyan'
                            )}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
              {selectedColumns.length === 0
                ? 'Select columns to analyze word frequency'
                : 'No data available for analysis'
              }
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

