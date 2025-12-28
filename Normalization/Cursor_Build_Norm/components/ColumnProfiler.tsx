'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  BarChart3,
  X,
  Mail,
  Phone,
  Globe,
  FileText,
  MapPin,
  Type,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { CSVRow, ColumnProfile } from '@/lib/types';
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

interface ColumnProfilerProps {
  data: CSVRow[];
  headers: string[];
  isOpen: boolean;
  onClose: () => void;
  selectedColumn?: string;
  onColumnSelect?: (column: string) => void;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  phone: <Phone className="w-4 h-4" />,
  website: <Globe className="w-4 h-4" />,
  document_link: <FileText className="w-4 h-4" />,
  address: <MapPin className="w-4 h-4" />,
  text: <Type className="w-4 h-4" />,
  other: <HelpCircle className="w-4 h-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  email: '#06b6d4',
  phone: '#8b5cf6',
  website: '#f97316',
  document_link: '#ec4899',
  address: '#ef4444',
  text: '#3b82f6',
  other: '#6b7280',
};

export const ColumnProfiler: React.FC<ColumnProfilerProps> = ({
  data,
  headers,
  isOpen,
  onClose,
  selectedColumn: initialColumn,
  onColumnSelect,
}) => {
  const [selectedColumn, setSelectedColumn] = useState<string>(initialColumn || headers[0] || '');
  const [expandedSection, setExpandedSection] = useState<string>('overview');

  useEffect(() => {
    if (initialColumn) {
      setSelectedColumn(initialColumn);
    }
  }, [initialColumn]);

  const profile = useMemo(() => {
    if (!selectedColumn || data.length === 0) return null;
    return profileColumn(data, selectedColumn);
  }, [data, selectedColumn]);

  const handleColumnClick = (column: string) => {
    setSelectedColumn(column);
    onColumnSelect?.(column);
  };

  if (!isOpen) return null;

  const completenessColor = profile
    ? profile.completeness >= 80
      ? '#10b981'
      : profile.completeness >= 50
      ? '#f59e0b'
      : '#ef4444'
    : '#6b7280';

  const chartData = profile?.topValues.slice(0, 8).map((item, index) => ({
    name: item.value.length > 15 ? item.value.slice(0, 15) + '...' : item.value,
    count: item.count,
    fill: `hsl(${200 + index * 20}, 70%, 50%)`,
  })) || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border bg-gradient-to-r from-accent-blue/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-blue/20">
                <BarChart3 className="w-6 h-6 text-accent-blue" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Column Data Profiler
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Analyze data distribution, quality, and patterns
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex h-[calc(90vh-80px)]">
            {/* Column List Sidebar */}
            <div className="w-64 border-r border-light-border dark:border-dark-border overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
              <div className="p-3 sticky top-0 bg-gray-50 dark:bg-gray-900/50 border-b border-light-border dark:border-dark-border">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Columns ({headers.length})
                </p>
              </div>
              <div className="p-2 space-y-1">
                {headers.map((header) => {
                  const columnProfile = profileColumn(data, header);
                  const isSelected = selectedColumn === header;
                  
                  return (
                    <motion.button
                      key={header}
                      onClick={() => handleColumnClick(header)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        w-full px-3 py-2 rounded-lg text-left transition-all flex items-center gap-2
                        ${isSelected
                          ? 'bg-accent-blue text-white shadow-md'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      <span style={{ color: isSelected ? 'white' : TYPE_COLORS[columnProfile.type] }}>
                        {TYPE_ICONS[columnProfile.type]}
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">{header}</span>
                      <div className={`
                        w-2 h-2 rounded-full
                        ${columnProfile.completeness >= 80 ? 'bg-green-500' : columnProfile.completeness >= 50 ? 'bg-yellow-500' : 'bg-red-500'}
                      `} />
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {profile ? (
                <>
                  {/* Column Header */}
                  <div className="flex items-center gap-4">
                    <div
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${TYPE_COLORS[profile.type]}20` }}
                    >
                      <span style={{ color: TYPE_COLORS[profile.type] }}>
                        {TYPE_ICONS[profile.type]}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {profile.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="info">{profile.type.replace('_', ' ')}</Badge>
                        <span className="text-sm text-gray-500">
                          {profile.uniqueCount.toLocaleString()} unique values
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800"
                    >
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
                        Total Values
                      </p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                        {profile.totalCount.toLocaleString()}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 border border-purple-200 dark:border-purple-800"
                    >
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase">
                        Unique Values
                      </p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                        {profile.uniqueCount.toLocaleString()}
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="p-4 rounded-xl border"
                      style={{
                        background: `linear-gradient(135deg, ${completenessColor}10, ${completenessColor}20)`,
                        borderColor: `${completenessColor}40`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium uppercase" style={{ color: completenessColor }}>
                          Completeness
                        </p>
                        {profile.completeness >= 80 ? (
                          <CheckCircle className="w-3 h-3" style={{ color: completenessColor }} />
                        ) : (
                          <AlertTriangle className="w-3 h-3" style={{ color: completenessColor }} />
                        )}
                      </div>
                      <p className="text-2xl font-bold mt-1" style={{ color: completenessColor }}>
                        {profile.completeness}%
                      </p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/30 border border-gray-200 dark:border-gray-700"
                    >
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">
                        Empty/Null
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {profile.emptyCount.toLocaleString()}
                      </p>
                    </motion.div>
                  </div>

                  {/* Length Stats */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-light-border dark:border-dark-border"
                  >
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-accent-blue" />
                      Value Length Statistics
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Min Length</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.minLength}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Avg Length</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.avgLength}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Max Length</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{profile.maxLength}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Top Values Chart */}
                  {chartData.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                    >
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Top Values Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                              <XAxis type="number" />
                              <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 11 }}
                              />
                              <Tooltip
                                formatter={(value: number) => [value.toLocaleString(), 'Count']}
                                contentStyle={{
                                  backgroundColor: 'rgba(255,255,255,0.95)',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb',
                                }}
                              />
                              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Top Values Table */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Top 10 Most Frequent Values</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-light-border dark:border-dark-border">
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Rank
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                  Value
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                  Count
                                </th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                  % of Total
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-light-border dark:divide-dark-border">
                              {profile.topValues.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="px-4 py-2 text-gray-500">{index + 1}</td>
                                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100 max-w-xs truncate">
                                    {item.value || <span className="text-gray-400 italic">(empty)</span>}
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-900 dark:text-gray-100">
                                    {item.count.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                                    {((item.count / profile.totalCount) * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Select a column to view its profile</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

