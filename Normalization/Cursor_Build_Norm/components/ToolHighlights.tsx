'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Clock, 
  Shield, 
  Sparkles, 
  Database,
  TrendingUp,
  CheckCircle2,
  Layers
} from 'lucide-react';

interface FeatureHighlight {
  icon: React.ReactNode;
  title: string;
  description: string;
  stat: string;
  statLabel: string;
  color: string;
}

const features: FeatureHighlight[] = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Lightning Fast',
    description: 'Process 100K+ rows in seconds',
    stat: '10x',
    statLabel: 'Faster',
    color: '#00E5FF',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: 'Time Saved',
    description: 'Automate manual data cleanup',
    stat: '85%',
    statLabel: 'Less Time',
    color: '#7C4DFF',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: 'Data Quality',
    description: 'Intelligent validation & cleaning',
    stat: '99%',
    statLabel: 'Accuracy',
    color: '#00E676',
  },
  {
    icon: <Database className="w-5 h-5" />,
    title: 'Deduplication',
    description: 'Smart duplicate detection',
    stat: '40%',
    statLabel: 'Avg Reduction',
    color: '#FF5252',
  },
];

const rotatingStats = [
  { value: '1M+', label: 'Rows Processed' },
  { value: '500+', label: 'Hours Saved' },
  { value: '99.9%', label: 'Uptime' },
  { value: '< 1s', label: 'Avg Response' },
];

interface ToolHighlightsProps {
  isVisible?: boolean;
  variant?: 'horizontal' | 'vertical' | 'compact';
}

export function ToolHighlights({ isVisible = true, variant = 'horizontal' }: ToolHighlightsProps) {
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [activeStatIndex, setActiveStatIndex] = useState(0);

  // Auto-rotate features
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isVisible]);

  // Auto-rotate stats
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setActiveStatIndex((prev) => (prev + 1) % rotatingStats.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-6 py-3 px-4 bg-obsidian-layer1 border border-obsidian-border rounded overflow-hidden">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 tool-highlight"
          >
            <div 
              className="w-8 h-8 rounded flex items-center justify-center"
              style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
            >
              {feature.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">{feature.title}</span>
              <span 
                className="text-lg font-bold font-mono"
                style={{ color: feature.color }}
              >
                {feature.stat}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className="space-y-3">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.15 }}
            className={`p-4 bg-obsidian-card border border-obsidian-border rounded transition-all duration-200 tool-highlight ${
              activeFeatureIndex === index ? 'border-l-2' : ''
            }`}
            style={{ 
              borderLeftColor: activeFeatureIndex === index ? feature.color : undefined 
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded flex items-center justify-center"
                  style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
                >
                  {feature.icon}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white">{feature.title}</h4>
                  <p className="text-xs text-gray-500">{feature.description}</p>
                </div>
              </div>
              <div className="text-right">
                <div 
                  className="text-2xl font-bold font-mono"
                  style={{ color: feature.color }}
                >
                  {feature.stat}
                </div>
                <div className="text-tiny text-gray-500 uppercase tracking-wide">
                  {feature.statLabel}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  // Horizontal (default)
  return (
    <div className="bg-obsidian-layer1 border border-obsidian-border rounded overflow-hidden">
      {/* Main Feature Cards */}
      <div className="grid grid-cols-4 gap-px bg-obsidian-border">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            whileHover={{ scale: 1.02 }}
            className={`relative p-5 bg-obsidian-card transition-all duration-200 cursor-default ${
              activeFeatureIndex === index ? 'bg-obsidian-hover' : ''
            }`}
            onMouseEnter={() => setActiveFeatureIndex(index)}
          >
            {/* Active Indicator */}
            {activeFeatureIndex === index && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{ backgroundColor: feature.color }}
              />
            )}

            {/* Icon */}
            <div 
              className="w-12 h-12 rounded flex items-center justify-center mb-4 transition-all duration-200"
              style={{ 
                backgroundColor: `${feature.color}15`, 
                color: feature.color,
                boxShadow: activeFeatureIndex === index ? `0 0 20px ${feature.color}30` : undefined
              }}
            >
              {feature.icon}
            </div>

            {/* Content */}
            <h4 className="text-sm font-medium text-white mb-1">{feature.title}</h4>
            <p className="text-xs text-gray-500 mb-4">{feature.description}</p>

            {/* Stat */}
            <div className="flex items-baseline gap-2">
              <span 
                className="text-3xl font-bold font-mono"
                style={{ color: feature.color }}
              >
                {feature.stat}
              </span>
              <span className="text-tiny text-gray-500 uppercase tracking-wide">
                {feature.statLabel}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rotating Stats Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-obsidian-base border-t border-obsidian-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-electric-cyan" />
          <span className="text-xs text-gray-400">Powered by EntityMatch Pro</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStatIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3"
          >
            <span className="text-lg font-bold font-mono text-electric-cyan">
              {rotatingStats[activeStatIndex].value}
            </span>
            <span className="text-xs text-gray-500">
              {rotatingStats[activeStatIndex].label}
            </span>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-neon-green" />
          <span className="text-xs text-neon-green">Enterprise Ready</span>
        </div>
      </div>
    </div>
  );
}

// Compact inline version for header
export function ToolHighlightsInline() {
  return (
    <div className="flex items-center gap-6">
      {features.slice(0, 3).map((feature) => (
        <div key={feature.title} className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ backgroundColor: `${feature.color}15`, color: feature.color }}
          >
            {React.cloneElement(feature.icon as React.ReactElement, { className: 'w-3 h-3' })}
          </div>
          <span 
            className="text-sm font-bold font-mono"
            style={{ color: feature.color }}
          >
            {feature.stat}
          </span>
          <span className="text-tiny text-gray-500">{feature.statLabel}</span>
        </div>
      ))}
    </div>
  );
}

