'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProcessingProgress } from '@/lib/types';
import { Loader2, Sparkles, CheckCircle, Search, Filter, FileCheck, Zap } from 'lucide-react';

interface ProcessingProgressBarProps {
  progress: ProcessingProgress | null;
  isProcessing: boolean;
}

const PHASE_INFO: Record<ProcessingProgress['phase'], { label: string; icon: React.ReactNode; color: string }> = {
  parsing: { label: 'Parsing Data', icon: <Search className="w-4 h-4" />, color: '#00E5FF' },
  cleaning: { label: 'Cleaning & Normalizing', icon: <Sparkles className="w-4 h-4" />, color: '#7C4DFF' },
  validating: { label: 'Validating Data', icon: <FileCheck className="w-4 h-4" />, color: '#00E676' },
  deduplicating: { label: 'Removing Duplicates', icon: <Filter className="w-4 h-4" />, color: '#FFD740' },
  complete: { label: 'Complete!', icon: <CheckCircle className="w-4 h-4" />, color: '#00E676' },
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
          {/* Obsidian Card with Aurora Glow */}
          <div 
            className="rounded bg-obsidian-card border border-obsidian-border p-5 relative overflow-hidden"
            style={{
              boxShadow: phase !== 'complete' 
                ? `0 0 30px ${phaseInfo.color}20, inset 0 1px 0 rgba(255,255,255,0.03)` 
                : undefined
            }}
          >
            {/* Animated gradient border on top */}
            <motion.div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{
                background: `linear-gradient(90deg, ${PHASE_INFO.parsing.color}, ${PHASE_INFO.cleaning.color}, ${PHASE_INFO.validating.color}, ${PHASE_INFO.deduplicating.color})`,
                backgroundSize: '200% 100%',
              }}
              animate={{
                backgroundPositionX: ['0%', '100%', '0%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ 
                    rotate: phase !== 'complete' ? 360 : 0,
                    boxShadow: phase !== 'complete' 
                      ? [`0 0 10px ${phaseInfo.color}40`, `0 0 20px ${phaseInfo.color}60`, `0 0 10px ${phaseInfo.color}40`]
                      : undefined
                  }}
                  transition={{ 
                    rotate: { duration: 2, repeat: phase !== 'complete' ? Infinity : 0, ease: 'linear' },
                    boxShadow: { duration: 1.5, repeat: phase !== 'complete' ? Infinity : 0 }
                  }}
                  className="p-2 rounded"
                  style={{ backgroundColor: `${phaseInfo.color}20` }}
                >
                  <span style={{ color: phaseInfo.color }}>
                    {phase !== 'complete' ? <Loader2 className="w-5 h-5" /> : phaseInfo.icon}
                  </span>
                </motion.div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-white text-sm">
                      {phaseInfo.label}
                    </h3>
                    {phase !== 'complete' && (
                      <motion.span
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="text-xs text-gray-500"
                      >
                        Processing...
                      </motion.span>
                    )}
                  </div>
                  {progress && (
                    <p className="text-xs text-gray-500 font-mono">
                      Row {progress.currentRow.toLocaleString()} of {progress.totalRows.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <motion.p
                  key={percentage}
                  initial={{ scale: 1.2, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl font-bold font-mono"
                  style={{ 
                    color: phaseInfo.color,
                    textShadow: `0 0 20px ${phaseInfo.color}60`
                  }}
                >
                  {percentage}%
                </motion.p>
                {eta > 0 && phase !== 'complete' && (
                  <p className="text-xs text-gray-500 font-mono">
                    ~{formatTime(eta)} remaining
                  </p>
                )}
              </div>
            </div>

            {/* Aurora-Style Progress Bar */}
            <div className="relative h-2 bg-obsidian-hover rounded-sm overflow-hidden">
              {/* Background pulse effect */}
              <motion.div
                animate={{ 
                  opacity: phase !== 'complete' ? [0.3, 0.6, 0.3] : 0 
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0"
                style={{ backgroundColor: phaseInfo.color }}
              />
              
              {/* Progress fill with gradient */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-sm relative overflow-hidden aurora-glow"
                style={{ 
                  background: `linear-gradient(90deg, ${PHASE_INFO.parsing.color}, ${phaseInfo.color})`,
                }}
              >
                {/* Shimmer effect */}
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  style={{ display: phase === 'complete' ? 'none' : 'block' }}
                />
                
                {/* Animated stripes */}
                <motion.div
                  animate={{ backgroundPositionX: ['0%', '100%'] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 8px,
                      rgba(255,255,255,0.4) 8px,
                      rgba(255,255,255,0.4) 16px
                    )`,
                    backgroundSize: '200% 100%',
                    display: phase === 'complete' ? 'none' : 'block',
                  }}
                />
              </motion.div>

              {/* Glowing edge */}
              {phase !== 'complete' && (
                <motion.div
                  animate={{ 
                    boxShadow: [`0 0 10px ${phaseInfo.color}`, `0 0 25px ${phaseInfo.color}`, `0 0 10px ${phaseInfo.color}`],
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute top-0 bottom-0 w-1 rounded-full"
                  style={{ 
                    left: `calc(${percentage}% - 2px)`,
                    backgroundColor: phaseInfo.color,
                  }}
                />
              )}
            </div>

            {/* Phase indicators */}
            <div className="flex justify-between mt-4 pt-3 border-t border-obsidian-border">
              {Object.entries(PHASE_INFO).filter(([key]) => key !== 'complete').map(([key, info]) => {
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
                        ? 'text-neon-green'
                        : isCurrent
                        ? 'text-white font-medium'
                        : 'text-gray-600'
                    }`}
                  >
                    <motion.div
                      animate={isCurrent ? { 
                        scale: [1, 1.3, 1],
                        boxShadow: [`0 0 0px ${info.color}`, `0 0 15px ${info.color}`, `0 0 0px ${info.color}`]
                      } : {}}
                      transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
                      className="p-1 rounded"
                      style={isCurrent ? { backgroundColor: `${info.color}20` } : undefined}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-3.5 h-3.5 text-neon-green" />
                      ) : (
                        <span style={{ color: isCurrent ? info.color : undefined }}>
                          {info.icon}
                        </span>
                      )}
                    </motion.div>
                    <span className="hidden sm:inline">{info.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Speed indicator */}
            {phase !== 'complete' && progress && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500"
              >
                <Zap className="w-3 h-3 text-electric-cyan" />
                <span className="font-mono">
                  {Math.round(progress.currentRow / ((Date.now() - (progress as any).startTime) / 1000) || 0)} rows/sec
                </span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
