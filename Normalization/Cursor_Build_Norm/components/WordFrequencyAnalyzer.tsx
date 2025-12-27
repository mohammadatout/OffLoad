'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';
import { Badge } from './ui/Badge';
import { Filter, Download, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { WordFrequency } from '@/lib/types';
import { calculateWordFrequency, exportWordFrequencyToCSV } from '@/lib/dataProcessing';
import { CSVRow } from '@/lib/types';

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
  const normalizedExclusions = existingExclusions.map(entry => entry.toUpperCase());
  
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
  
  const handleColumnToggle = (column: string) => {
    const newSelected = selectedColumns.includes(column)
      ? selectedColumns.filter(c => c !== column)
      : [...selectedColumns, column];
    onColumnSelectionChange(newSelected);
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
            
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Select Columns for Analysis
              </p>
              <div className="flex flex-wrap gap-2">
                {columns.map((column) => (
                  <button
                    key={column}
                    onClick={() => handleColumnToggle(column)}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${selectedColumns.includes(column)
                        ? 'bg-accent-blue dark:bg-accent-cyan text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }
                    `}
                  >
                    {column}
                  </button>
                ))}
              </div>
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
                    {frequencies.slice(0, showTopN).map((freq, index) => (
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
                            disabled={
                              !onAddToExclusion ||
                              normalizedExclusions.includes(freq.word.toUpperCase())
                            }
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add
                          </Button>
                        </td>
                      </tr>
                    ))}
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

