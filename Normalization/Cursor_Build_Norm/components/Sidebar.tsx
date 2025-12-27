'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Switch } from './ui/Switch';
import { FileSpreadsheet, FileText, Mail, Globe, MapPin, Sparkles, XCircle } from 'lucide-react';
import { ColumnInfo, CumulativeStats } from '@/lib/types';

interface SidebarProps {
  totalRecords: number;
  totalColumns: number;
  columnInfo: ColumnInfo[];
  cumulativeStats: CumulativeStats;
  isDarkMode: boolean;
  onThemeToggle: () => void;
  onNavigate: (section: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  totalRecords,
  totalColumns,
  columnInfo,
  cumulativeStats,
  isDarkMode,
  onThemeToggle,
  onNavigate,
}) => {
  const textColumns = columnInfo.filter(col => col.type === 'text').length;
  const emailColumns = columnInfo.filter(col => col.type === 'email').length;
  const websiteColumns = columnInfo.filter(col => col.type === 'website').length;
  const addressColumns = columnInfo.filter(col => col.type === 'address').length;
  
  return (
    <div className="w-80 min-h-screen bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-light-border dark:border-dark-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent-blue/10 dark:bg-accent-cyan/10">
            <Sparkles className="w-6 h-6 text-accent-blue dark:text-accent-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              EntityMatch Pro
            </h1>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Data Normalization Suite
            </p>
          </div>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="p-4 border-b border-light-border dark:border-dark-border">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          Dashboard
        </button>
        <button
          onClick={() => onNavigate('configuration')}
          className="w-full px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors mt-1"
        >
          Configuration
        </button>
      </nav>
      
      {/* Stats Cards */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Quick Info
        </h2>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Records</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {totalRecords.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Total Columns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {totalColumns}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Text Columns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {textColumns}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Email Columns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {emailColumns}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <Mail className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Website Columns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {websiteColumns}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Globe className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Address Columns</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {addressColumns}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <MapPin className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-4">
          Cumulative Totals
        </h2>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Rows Processed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {cumulativeStats.rowsProcessed.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                <FileSpreadsheet className="w-6 h-6 text-slate-600 dark:text-slate-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Duplicates Removed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {cumulativeStats.duplicatesRemoved.toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Theme Toggle & Footer */}
      <div className="p-4 border-t border-light-border dark:border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isDarkMode ? 'Dark Mode' : 'Light Mode'}
          </span>
          <Switch
            checked={isDarkMode}
            onCheckedChange={onThemeToggle}
          />
        </div>
        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
          Developed by (Mohammad Atout)
        </div>
      </div>
    </div>
  );
};

