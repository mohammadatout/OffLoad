'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from './ui/Switch';
import { 
  FileSpreadsheet, 
  Mail, 
  Globe, 
  MapPin, 
  Zap, 
  Clock, 
  Activity, 
  Phone,
  Home,
  Settings,
  BookOpen,
  Save,
  Sun,
  Moon,
  ChevronRight,
  Layers,
  Target,
  TrendingUp
} from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeNav, setActiveNav] = useState('dashboard');
  
  const textColumns = columnInfo.filter(col => col.type === 'text').length;
  const emailColumns = columnInfo.filter(col => col.type === 'email').length;
  const websiteColumns = columnInfo.filter(col => col.type === 'website').length;
  const addressColumns = columnInfo.filter(col => col.type === 'address').length;
  const phoneColumns = columnInfo.filter(col => col.type === 'phone').length;

  const navItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard' },
    { id: 'configuration', icon: Settings, label: 'Configuration' },
    { id: 'dictionaries', icon: BookOpen, label: 'Dictionaries' },
    { id: 'saved', icon: Save, label: 'Saved Configs' },
  ];

  const stats = [
    { value: totalRecords, label: 'Rows', icon: Layers, color: '#00E5FF' },
    { value: Math.round((cumulativeStats.rowsProcessed > 0 ? 89 : 0)), label: 'Quality', icon: Target, color: '#00E676', suffix: '%' },
  ];

  const wowHighlights = [
    {
      id: 'automation',
      headline: 'Automation that replaces entire playbooks.',
      stat: '12+',
      statLabel: 'Hours saved/week',
      icon: Zap,
      color: '#00E5FF',
    },
    {
      id: 'dedupe',
      headline: 'Entity resolution with audit trails.',
      stat: cumulativeStats.duplicatesRemoved.toLocaleString(),
      statLabel: 'Duplicates removed',
      icon: Activity,
      color: '#7C4DFF',
    },
    {
      id: 'velocity',
      headline: 'Normalize six figures of rows in minutes.',
      stat: cumulativeStats.rowsProcessed.toLocaleString(),
      statLabel: 'Rows processed',
      icon: TrendingUp,
      color: '#00E676',
    },
  ];

  const [activeHighlight, setActiveHighlight] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveHighlight(prev => (prev + 1) % wowHighlights.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [wowHighlights.length]);

  const handleNavClick = (id: string) => {
    setActiveNav(id);
    onNavigate(id);
  };

  return (
    <div 
      className="relative flex h-screen"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Icon Rail - Always Visible */}
      <div className="w-14 bg-obsidian-layer1 border-r border-obsidian-border flex flex-col items-center py-3 z-20">
        {/* Logo */}
        <motion.div 
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-5 cursor-pointer"
          style={{ 
            background: 'linear-gradient(135deg, #00E5FF, #7C4DFF)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-white font-bold text-sm">E</span>
        </motion.div>

        {/* Divider */}
        <div className="w-6 h-px bg-obsidian-border mb-3" />

        {/* Nav Icons */}
        <nav className="flex flex-col items-center gap-1">
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative w-10 h-10 rounded flex items-center justify-center transition-all ${
                activeNav === item.id 
                  ? 'bg-obsidian-hover text-electric-cyan' 
                  : 'text-gray-500 hover:bg-obsidian-hover hover:text-gray-300'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {activeNav === item.id && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-electric-cyan rounded-r"
                />
              )}
              <item.icon className="w-[18px] h-[18px]" />
            </motion.button>
          ))}
        </nav>

        {/* Divider */}
        <div className="w-6 h-px bg-obsidian-border my-3" />

        {/* Quick Stats */}
        <div className="flex flex-col items-center gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div 
                className="text-sm font-bold font-mono"
                style={{ color: stat.color }}
              >
                {stat.value.toLocaleString()}{stat.suffix || ''}
              </div>
              <div className="text-[9px] text-gray-600 uppercase tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Divider */}
        <div className="w-6 h-px bg-obsidian-border mb-3" />

        {/* Theme Toggle */}
        <motion.button
          onClick={onThemeToggle}
          className="w-10 h-10 rounded flex items-center justify-center text-gray-500 hover:bg-obsidian-hover hover:text-electric-cyan transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isDarkMode ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </motion.button>
      </div>

      {/* Expandable Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-obsidian-layer2 border-r border-obsidian-border overflow-hidden z-10"
          >
            <div className="w-[260px] h-full flex flex-col py-3 px-4">
              {/* Logo Section */}
              <div className="mb-5">
                <h1 className="text-base font-semibold text-white">EntityMatch Pro</h1>
                <p className="text-[11px] text-gray-500">Data Wrangling Studio</p>
              </div>

              {/* Navigation */}
              <div className="mb-5">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Navigation</p>
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-all ${
                      activeNav === item.id
                        ? 'bg-obsidian-hover text-electric-cyan'
                        : 'text-gray-400 hover:bg-obsidian-hover hover:text-gray-200'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {activeNav === item.id && (
                      <ChevronRight className="w-3 h-3 ml-auto" />
                    )}
                  </button>
                ))}
              </div>

              {/* Impact Highlight Card */}
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Impact</p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={wowHighlights[activeHighlight].id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-3 rounded bg-obsidian-card border border-obsidian-border"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(wowHighlights[activeHighlight].icon, {
                        className: 'w-4 h-4',
                        style: { color: wowHighlights[activeHighlight].color }
                      })}
                      <span className="text-xs text-gray-400">Highlight</span>
                    </div>
                    <p className="text-xs text-gray-300 mb-3 leading-relaxed">
                      {wowHighlights[activeHighlight].headline}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span 
                        className="text-2xl font-bold font-mono"
                        style={{ color: wowHighlights[activeHighlight].color }}
                      >
                        {wowHighlights[activeHighlight].stat}
                      </span>
                      <span className="text-[10px] text-gray-500 uppercase">
                        {wowHighlights[activeHighlight].statLabel}
                      </span>
                    </div>
                    {/* Progress dots */}
                    <div className="flex gap-1 mt-3">
                      {wowHighlights.map((_, idx) => (
                        <div 
                          key={idx}
                          className={`h-1 flex-1 rounded-full transition-all ${
                            idx === activeHighlight ? 'bg-electric-cyan' : 'bg-obsidian-border'
                          }`}
                        />
                      ))}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Column Stats */}
              <div className="flex-1 overflow-y-auto">
                <p className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">Column Types</p>
                <div className="space-y-2">
                  {[
                    { label: 'Total', value: totalColumns, icon: Layers, color: '#00E5FF' },
                    { label: 'Email', value: emailColumns, icon: Mail, color: '#7C4DFF' },
                    { label: 'Website', value: websiteColumns, icon: Globe, color: '#FFD740' },
                    { label: 'Address', value: addressColumns, icon: MapPin, color: '#FF5252' },
                    { label: 'Phone', value: phoneColumns, icon: Phone, color: '#00E676' },
                  ].map((item) => (
                    <div 
                      key={item.label}
                      className="flex items-center justify-between px-3 py-2 rounded bg-obsidian-card border border-obsidian-border"
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ backgroundColor: `${item.color}15` }}
                        >
                          <item.icon className="w-3 h-3" style={{ color: item.color }} />
                        </div>
                        <span className="text-xs text-gray-400">{item.label}</span>
                      </div>
                      <span 
                        className="text-sm font-bold font-mono"
                        style={{ color: item.color }}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-obsidian-border mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                  </span>
                  <Switch
                    checked={isDarkMode}
                    onCheckedChange={onThemeToggle}
                  />
                </div>
                <p className="text-[10px] text-center text-gray-600 mt-3">
                  Developed by Americas Sales Digitization
                  <br />
                  <span className="text-gray-500">(Mohammad Atout)</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
