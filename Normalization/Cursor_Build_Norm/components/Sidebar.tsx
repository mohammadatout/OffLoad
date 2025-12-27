'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Switch } from './ui/Switch';
import { FileSpreadsheet, FileText, Mail, Globe, MapPin, Sparkles, XCircle, Zap, Clock, Activity } from 'lucide-react';
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
  const wowHighlights = [
    {
      id: 'automation',
      headline: 'Automation that replaces entire playbooks.',
      subtext: 'Standardize names, emails, websites & addresses with one click.',
      statLabel: 'Manual hours saved per week',
      statValue: '12+',
      callouts: ['Uppercase/on-brand cleanup', 'Address parsing + Full_Address', 'Live CSV preview'],
      accentIcon: <Zap className="w-5 h-5" />,
    },
    {
      id: 'dedupe',
      headline: 'Entity resolution with audit trails.',
      subtext: 'Smart dedupe keeps the richest record & logs every merge.',
      statLabel: 'Duplicates removed so far',
      statValue: cumulativeStats.duplicatesRemoved.toLocaleString(),
      callouts: ['City & state confirmation', 'Abbreviation replacement', 'Legal entity removal'],
      accentIcon: <Activity className="w-5 h-5" />,
    },
    {
      id: 'velocity',
      headline: 'Normalize six figures of rows in minutes.',
      subtext: 'Parallel parsing + client-side CSV exports keep data on your device.',
      statLabel: 'Rows processed all-time',
      statValue: cumulativeStats.rowsProcessed.toLocaleString(),
      callouts: ['Agile column selection', 'Original vs Clean audit file', 'Fast client-only processing'],
      accentIcon: <Clock className="w-5 h-5" />,
    },
  ];
  const [activeHighlight, setActiveHighlight] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveHighlight(prev => (prev + 1) % wowHighlights.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [wowHighlights.length]);
  
  return (
    <div className="w-80 min-h-screen bg-light-card dark:bg-dark-card border-r border-light-border dark:border-dark-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-light-border dark:border-dark-border">
        <div className="flex items-center">
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#09304D] via-[#0E1B6E] to-[#141E8F] text-white shadow-lg p-5">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top,_rgba(251,171,44,0.35),_transparent_55%)]" />
          <AnimatePresence mode="wait">
            <motion.div
              key={wowHighlights[activeHighlight].id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.45 }}
              className="relative space-y-3"
            >
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/80">
                {wowHighlights[activeHighlight].accentIcon}
                Impact Snapshot
              </div>
              <p className="text-lg font-semibold leading-snug">
                {wowHighlights[activeHighlight].headline}
              </p>
              <p className="text-sm text-white/85">
                {wowHighlights[activeHighlight].subtext}
              </p>
              <div className="text-xs uppercase tracking-wide text-[#fbab2c] font-semibold">
                Spotlight Features
              </div>
              <ul className="text-[13px] space-y-1">
                {wowHighlights[activeHighlight].callouts.map((callout) => (
                  <li key={callout} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fbab2c]" />
                    {callout}
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline gap-2 pt-2">
                <span className="text-3xl font-black">{wowHighlights[activeHighlight].statValue}</span>
                <span className="text-xs uppercase tracking-wide text-white/80">
                  {wowHighlights[activeHighlight].statLabel}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex gap-1 mt-4">
            {wowHighlights.map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 flex-1 rounded-full transition-all ${index === activeHighlight ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>

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

