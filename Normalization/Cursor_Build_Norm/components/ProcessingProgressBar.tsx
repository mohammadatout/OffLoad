'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingProgress } from '@/lib/types';
import { Loader2, Sparkles, CheckCircle, Search, Filter, FileCheck } from 'lucide-react';

interface ProcessingProgressBarProps {
  progress: ProcessingProgress | null;
  isProcessing: boolean;
}

const PHASE_INFO: Record<ProcessingProgress['phase'], { label: string; icon: React.ReactNode; color: string }> = {
  parsing: { label: 'Parsing Data', icon: <Search className="w-4 h-4" />, color: '#3b82f6' },
  cleaning: { label: 'Cleaning & Normalizing', icon: <Sparkles className="w-4 h-4" />, color: '#8b5cf6' },
  validating: { label: 'Validating Data', icon: <FileCheck className="w-4 h-4" />, color: '#06b6d4' },
  deduplicating: { label: 'Removing Duplicates', icon: <Filter className="w-4 h-4" />, color: '#f59e0b' },
  complete: { label: 'Complete!', icon: <CheckCircle className="w-4 h-4" />, color: '#10b981' },
};

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export const ProcessingProgressBar: React.FC<ProcessingProgressBarProps> = ({
  progress,
  isProcessing,
}) => {
  if (!isProcessing && !progress) return null;

  const phase = progress?.phase || 'cleaning';
  const phaseInfo = PHASE_INFO[phase];
  const percentage = progress?.percentage || 0;
  const eta = progress?.estimatedTimeRemaining || 0;

  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-light-border dark:border-dark-border bg-white dark:bg-dark-card shadow-lg p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: phase !== 'complete' ? 360 : 0 }}
                  transition={{ duration: 2, repeat: phase !== 'complete' ? Infinity : 0, ease: 'linear' }}
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${phaseInfo.color}20` }}
                >
                  <span style={{ color: phaseInfo.color }}>
                    {phase !== 'complete' ? <Loader2 className="w-5 h-5" /> : phaseInfo.icon}
                  </span>
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {phaseInfo.label}
                    </h3>
                    {phase !== 'complete' && (
                      <motion.span
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-sm text-gray-500"
                      >
                        Processing...
                      </motion.span>
                    )}
                  </div>
                  {progress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Row {progress.currentRow.toLocaleString()} of {progress.totalRows.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <motion.p
                  key={percentage}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-bold"
                  style={{ color: phaseInfo.color }}
                >
                  {percentage}%
                </motion.p>
                {eta > 0 && phase !== 'complete' && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    ~{formatTime(eta)} remaining
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              {/* Background shimmer effect */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                style={{ display: phase === 'complete' ? 'none' : 'block' }}
              />
              
              {/* Progress fill */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-full relative overflow-hidden"
                style={{ backgroundColor: phaseInfo.color }}
              >
                {/* Animated stripes */}
                <motion.div
                  animate={{ backgroundPositionX: ['0%', '100%'] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 opacity-30"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 10px,
                      rgba(255,255,255,0.3) 10px,
                      rgba(255,255,255,0.3) 20px
                    )`,
                    backgroundSize: '200% 100%',
                    display: phase === 'complete' ? 'none' : 'block',
                  }}
                />
              </motion.div>
            </div>

            {/* Phase indicators */}
            <div className="flex justify-between mt-4">
              {Object.entries(PHASE_INFO).filter(([key]) => key !== 'complete').map(([key, info], index) => {
                const phases = ['parsing', 'cleaning', 'validating', 'deduplicating'];
                const currentPhaseIndex = phases.indexOf(phase);
                const thisPhaseIndex = phases.indexOf(key);
                const isComplete = thisPhaseIndex < currentPhaseIndex || phase === 'complete';
                const isCurrent = key === phase && phase !== 'complete';
                
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-1.5 text-xs transition-all ${
                      isComplete
                        ? 'text-green-600 dark:text-green-400'
                        : isCurrent
                        ? 'text-gray-900 dark:text-gray-100 font-medium'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                      transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        info.icon
                      )}
                    </motion.div>
                    <span className="hidden sm:inline">{info.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

