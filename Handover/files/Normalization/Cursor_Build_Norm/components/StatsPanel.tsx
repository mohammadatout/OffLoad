'use client';

import React, { useMemo, useState, useEffect } from 'react';
import clsx from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { PerformanceCharts } from './PerformanceCharts';
import { WordFrequencyAnalyzer } from './WordFrequencyAnalyzer';
import { ProcessingStats, CSVRow, ColumnInfo } from '@/lib/types';
import { BarChart as BarChartIcon, Activity, Hash, Type, Mail, Phone, Globe, MapPin, FileText, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Select } from './ui/Select';
import { profileColumn } from '@/lib/dataProcessing';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from 'recharts';

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
  const [spotlightColumn, setSpotlightColumn] = useState<string>(fileData?.headers[0] || '');

  useEffect(() => {
    if (!fileData) {
      setSpotlightColumn('');
      return;
    }
    setSpotlightColumn((prev) => {
      if (prev && fileData.headers.includes(prev)) {
        return prev;
      }
      return fileData.headers[0] || '';
    });
  }, [fileData]);

  const typeColorMap: Record<string, string> = {
    text: 'bg-indigo-500',
    email: 'bg-cyan-400',
    phone: 'bg-purple-400',
    website: 'bg-orange-400',
    address: 'bg-rose-400',
    document_link: 'bg-pink-400',
    other: 'bg-slate-400',
  };

  const columnTypeDistribution = useMemo(() => {
    if (!fileData?.columnInfo || fileData.columnInfo.length === 0) return [];
    const counts: Record<string, number> = {};
    fileData.columnInfo.forEach((col) => {
      const key = col.type || 'other';
      counts[key] = (counts[key] || 0) + 1;
    });
    const labelMap: Record<string, string> = {
      text: 'Text',
      email: 'Email',
      phone: 'Phone',
      website: 'Website',
      address: 'Address',
      document_link: 'Documents',
      other: 'Other',
    };
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        label: labelMap[type] || type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [fileData?.columnInfo]);

  const maxTypeCount = columnTypeDistribution[0]?.count || 0;

  const spotlightProfile = useMemo(() => {
    if (!fileData || !spotlightColumn) return null;
    try {
      return profileColumn(fileData.data, spotlightColumn);
    } catch {
      return null;
    }
  }, [fileData, spotlightColumn]);

  const spotlightChartData = useMemo(() => {
    if (!spotlightProfile) return [];
    return spotlightProfile.topValues.slice(0, 8).map((item, index) => ({
      name: item.value && item.value.length > 18 ? `${item.value.slice(0, 18)}…` : item.value || '(blank)',
      fullValue: item.value || '(blank)',
      count: item.count,
      fill: `hsl(${210 + index * 16}, 70%, 55%)`,
    }));
  }, [spotlightProfile]);

  const spotlightOptions =
    fileData?.headers.map((header) => ({ value: header, label: header })) ?? [];

  if (!fileData) {
    return (
      <div className="h-full flex items-center justify-center p-8 border-2 border-dashed border-obsidian-border rounded-xl bg-obsidian-layer1">
        <div className="text-center text-gray-500">
          <BarChartIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
            {columnTypeDistribution.length > 0 && (
              <div className="mt-4 pt-4 border-t border-obsidian-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">Column Type Distribution</p>
                  {onColumnProfilerOpen && (
                    <button
                      onClick={onColumnProfilerOpen}
                      className="text-[10px] text-electric-cyan hover:text-electric-cyan-dark transition-colors flex items-center gap-1"
                    >
                      View All <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {columnTypeDistribution.map((item, idx) => {
                    const widthPercent = maxTypeCount ? (item.count / maxTypeCount) * 100 : 0;
                    return (
                      <motion.button
                        key={item.type}
                        className="w-full flex items-center gap-3 text-left group"
                        onClick={() => {
                          if (!onColumnProfilerOpen) return;
                          onColumnProfilerOpen();
                        }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        type="button"
                      >
                        <div className="w-28 text-[11px] uppercase tracking-wide text-gray-500">
                          {item.label}
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-obsidian-hover overflow-hidden">
                          <span
                            className={clsx(
                              'block h-full transition-all duration-500 rounded-full',
                              typeColorMap[item.type] || typeColorMap.other
                            )}
                            style={{ width: `${Math.max(widthPercent, 6)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-400 w-8 text-right">
                          {item.count}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Column Value Spotlight */}
      {spotlightProfile && (
        <Card variant="obsidian">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-sm">Top Values Spotlight</CardTitle>
                <p className="text-[11px] text-gray-500">
                  Visualize the most frequent values for any column.
                </p>
              </div>
              {spotlightOptions.length > 0 && (
                <div className="w-full md:w-64">
                  <Select
                    value={spotlightColumn}
                    onChange={(event) => setSpotlightColumn(event.target.value)}
                    options={spotlightOptions}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-64">
            {spotlightChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spotlightChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                  <XAxis type="number" />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={140}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, _name, { payload }) => [
                      value.toLocaleString(),
                      payload?.fullValue || '',
                    ]}
                    contentStyle={{
                      backgroundColor: 'rgba(15,23,42,0.95)',
                      borderRadius: 8,
                      border: '1px solid rgba(148,163,184,0.4)',
                      color: '#f8fafc',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {spotlightChartData.map((entry, index) => (
                      <Cell key={`bar-${entry.name}-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                Not enough data to chart this column yet.
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
