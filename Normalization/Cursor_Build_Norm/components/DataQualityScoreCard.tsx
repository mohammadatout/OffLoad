'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Percent,
  Layers,
  Fingerprint,
} from 'lucide-react';
import { CSVRow, DataQualityScore } from '@/lib/types';
import { calculateDataQualityScore } from '@/lib/dataProcessing';
import { ProcessingConfig } from '@/lib/types';
import { BRAND_PALETTE, scoreToColor } from '@/lib/brandPalette';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { cn } from '@/lib/utils';

interface DataQualityScoreCardProps {
  data: CSVRow[];
  headers: string[];
  config: ProcessingConfig;
  /** ~50% footprint: smaller gauge, type, and breakdown for side-by-side layout */
  compact?: boolean;
}

const getScoreColor = (score: number): string => scoreToColor(score);

const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
};

const getScoreIcon = (score: number, compact: boolean): React.ReactNode => {
  const cls = compact ? 'w-3.5 h-3.5' : 'w-5 h-5';
  if (score >= 80) return <CheckCircle className={cls} />;
  if (score >= 60) return <AlertTriangle className={cls} />;
  return <XCircle className={cls} />;
};

/** Semicircle gauge — height derived from size so the arc clears the score label */
const ScoreGauge: React.FC<{ score: number; size?: number }> = ({ score, size = 120 }) => {
  const color = getScoreColor(score);
  const data = [{ value: score, fill: color }];
  const chartHeight = Math.round(size * 0.5) + 12;

  return (
    <div className="relative mx-auto overflow-hidden" style={{ width: size, height: chartHeight }}>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <RadialBarChart
          data={data}
          width={size}
          height={chartHeight}
          startAngle={180}
          endAngle={0}
          innerRadius="72%"
          outerRadius="100%"
          cx="50%"
          cy="100%"
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={10}
            background={{ fill: BRAND_PALETTE.lightGray }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  delay?: number;
  compact?: boolean;
}> = ({ label, value, icon, delay = 0, compact = false }) => {
  const color = getScoreColor(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        'rounded-xl border bg-white dark:bg-dark-card',
        compact ? 'p-2' : 'p-4'
      )}
      style={{ borderColor: BRAND_PALETTE.lightGray }}
    >
      <div className={cn('flex items-center gap-1.5', compact ? 'mb-1' : 'mb-2')}>
        <span style={{ color }}>{icon}</span>
        <span
          className={cn(
            'font-medium uppercase dark:text-gray-400',
            compact ? 'text-[9px] tracking-wide' : 'text-xs'
          )}
          style={{ color: BRAND_PALETTE.darkGray }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('font-bold', compact ? 'text-sm' : 'text-2xl')} style={{ color }}>
          {value}%
        </span>
        <div
          className={cn('flex-1 rounded-full overflow-hidden', compact ? 'h-1' : 'h-2')}
          style={{ backgroundColor: `${color}20` }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.8, delay: delay + 0.2 }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export const DataQualityScoreCard: React.FC<DataQualityScoreCardProps> = ({
  data,
  headers,
  config,
  compact = false,
}) => {
  const qualityScore = useMemo(() => {
    if (data.length === 0) return null;
    return calculateDataQualityScore(data, headers, config);
  }, [data, headers, config]);

  if (!qualityScore) {
    return null;
  }

  const overallColor = getScoreColor(qualityScore.overall);
  const scoreLabel = getScoreLabel(qualityScore.overall);
  const columnsWithIssues = qualityScore.columnScores.filter((c) => c.issues.length > 0);

  const gaugeSize = compact ? 88 : 160;
  const iconSm = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <Card variant="obsidian" className={cn(compact && 'min-h-0 h-full flex flex-col')}>
      <CardHeader className={cn(compact && 'py-phi-1 shrink-0')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn('rounded-lg shrink-0', compact ? 'p-1.5' : 'p-2')}
              style={{ backgroundColor: `${overallColor}20` }}
            >
              <Shield
                className={compact ? 'w-4 h-4' : 'w-6 h-6'}
                style={{ color: overallColor }}
              />
            </div>
            <div className="min-w-0">
              <CardTitle className={compact ? 'text-xs' : undefined}>Data Quality Score</CardTitle>
              <p
                className={cn(
                  'text-app-muted',
                  compact ? 'text-[10px] leading-tight mt-0.5' : 'text-sm text-gray-500 dark:text-gray-400'
                )}
              >
                Based on {data.length.toLocaleString()} records across {headers.length} columns
              </p>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 shrink-0"
          >
            <Badge
              variant={
                qualityScore.overall >= 80
                  ? 'success'
                  : qualityScore.overall >= 60
                    ? 'warning'
                    : qualityScore.overall >= 40
                      ? 'poor'
                      : 'danger'
              }
              className={compact ? 'text-[10px] px-1.5 py-0' : undefined}
            >
              <span className="flex items-center gap-0.5">
                {getScoreIcon(qualityScore.overall, compact)}
                {scoreLabel}
              </span>
            </Badge>
          </motion.div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(compact ? 'space-y-3 flex-1 min-h-0' : 'space-y-6', compact && 'py-phi-2')}
      >
        <div
          className={cn(
            'flex flex-col items-center gap-4',
            !compact && 'md:flex-row md:gap-6'
          )}
        >
          <div className="flex flex-col items-center shrink-0">
            <ScoreGauge score={qualityScore.overall} size={gaugeSize} />
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className={cn('font-bold', compact ? 'text-lg mt-0.5' : 'text-2xl mt-2')}
              style={{ color: overallColor }}
            >
              {qualityScore.overall}
            </motion.span>
            <p
              className={cn(
                'text-app-muted',
                compact ? 'text-[10px] mt-0' : 'text-sm text-gray-500 dark:text-gray-400 mt-1'
              )}
            >
              Overall Score
            </p>
          </div>

          <div className={cn('grid grid-cols-2 w-full', compact ? 'gap-1.5' : 'gap-3')}>
            <MetricCard
              label="Completeness"
              value={qualityScore.completeness}
              icon={<Percent className={iconSm} />}
              delay={0.1}
              compact={compact}
            />
            <MetricCard
              label="Validity"
              value={qualityScore.validity}
              icon={<CheckCircle className={iconSm} />}
              delay={0.2}
              compact={compact}
            />
            <MetricCard
              label="Consistency"
              value={qualityScore.consistency}
              icon={<Layers className={iconSm} />}
              delay={0.3}
              compact={compact}
            />
            <MetricCard
              label="Uniqueness"
              value={qualityScore.uniqueness}
              icon={<Fingerprint className={iconSm} />}
              delay={0.4}
              compact={compact}
            />
          </div>
        </div>

        {columnsWithIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={cn(
              'rounded-xl border dark:border-gray-600',
              compact ? 'p-2' : 'p-4'
            )}
            style={{
              backgroundColor: `${BRAND_PALETTE.lightGray}99`,
              borderColor: BRAND_PALETTE.darkGray,
            }}
          >
            <div className={cn('flex items-center gap-2', compact ? 'mb-1.5' : 'mb-3')}>
              <AlertTriangle
                className={cn('shrink-0', compact ? 'w-3.5 h-3.5' : 'w-5 h-5')}
                style={{ color: BRAND_PALETTE.red }}
              />
              <h4
                className={cn('font-semibold', compact ? 'text-xs' : undefined)}
                style={{ color: BRAND_PALETTE.darkBlue }}
              >
                Data Quality Issues Detected
              </h4>
            </div>
            <div className={cn('space-y-1', compact && 'text-[10px]')}>
              {columnsWithIssues.slice(0, compact ? 3 : 5).map((column) => (
                <div key={column.column} className={cn('flex items-start gap-2', !compact && 'text-sm')}>
                  <span
                    className={cn('font-medium shrink-0', compact ? 'min-w-[72px]' : 'min-w-[120px]')}
                    style={{ color: BRAND_PALETTE.darkBlue }}
                  >
                    {column.column}:
                  </span>
                  <span style={{ color: BRAND_PALETTE.darkGray }}>{column.issues.join(', ')}</span>
                </div>
              ))}
              {columnsWithIssues.length > (compact ? 3 : 5) && (
                <p className="text-[10px] mt-1" style={{ color: BRAND_PALETTE.darkGray }}>
                  + {columnsWithIssues.length - (compact ? 3 : 5)} more columns with issues
                </p>
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h4
            className={cn(
              'font-semibold text-app-text dark:text-gray-100 flex items-center gap-1.5',
              compact ? 'text-[10px] mb-1.5' : 'text-sm mb-3'
            )}
          >
            <TrendingUp className={compact ? 'w-3 h-3' : 'w-4 h-4'} style={{ color: BRAND_PALETTE.darkBlue }} />
            Column Quality Breakdown
          </h4>
          <div
            className={cn(
              'grid grid-cols-1 md:grid-cols-2 gap-1.5 overflow-y-auto',
              compact ? 'max-h-24 lg:grid-cols-2' : 'lg:grid-cols-3 gap-2 max-h-48'
            )}
          >
            {qualityScore.columnScores.map((column) => {
              const avgScore = Math.round((column.completeness + column.validity) / 2);
              const color = getScoreColor(avgScore);

              return (
                <div
                  key={column.column}
                  className={cn(
                    'flex items-center gap-2 rounded-lg dark:bg-gray-800/50',
                    compact ? 'p-1.5' : 'p-2'
                  )}
                  style={{ backgroundColor: `${BRAND_PALETTE.lightGray}80` }}
                >
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span
                    className={cn(
                      'text-gray-700 dark:text-gray-300 truncate flex-1',
                      compact ? 'text-[10px]' : 'text-sm'
                    )}
                  >
                    {column.column}
                  </span>
                  <span className={cn('font-medium shrink-0', compact ? 'text-[10px]' : 'text-xs')} style={{ color }}>
                    {avgScore}%
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
};
