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

interface DataQualityScoreCardProps {
  data: CSVRow[];
  headers: string[];
  config: ProcessingConfig;
}

const getScoreColor = (score: number): string => scoreToColor(score);

const getScoreLabel = (score: number): string => {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
};

const getScoreIcon = (score: number): React.ReactNode => {
  if (score >= 80) return <CheckCircle className="w-5 h-5" />;
  if (score >= 60) return <AlertTriangle className="w-5 h-5" />;
  return <XCircle className="w-5 h-5" />;
};

/** Semicircle gauge — fixed height so the arc sits above the score without overlapping it. */
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
}> = ({ label, value, icon, delay = 0 }) => {
  const color = getScoreColor(value);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="p-4 rounded-xl border bg-white dark:bg-dark-card"
      style={{ borderColor: BRAND_PALETTE.lightGray }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span
          className="text-xs font-medium uppercase dark:text-gray-400"
          style={{ color: BRAND_PALETTE.darkGray }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {value}%
        </span>
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
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
  
  // Find columns with issues
  const columnsWithIssues = qualityScore.columnScores.filter(c => c.issues.length > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${overallColor}20` }}
            >
              <Shield className="w-6 h-6" style={{ color: overallColor }} />
            </div>
            <div>
              <CardTitle>Data Quality Score</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Based on {data.length.toLocaleString()} records across {headers.length} columns
              </p>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
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
            >
              <span className="flex items-center gap-1">
                {getScoreIcon(qualityScore.overall)}
                {scoreLabel}
              </span>
            </Badge>
          </motion.div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex flex-col items-center">
            <ScoreGauge score={qualityScore.overall} size={160} />
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold mt-2"
              style={{ color: overallColor }}
            >
              {qualityScore.overall}
            </motion.span>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Overall Score</p>
          </div>
          
          <div className="flex-1 grid grid-cols-2 gap-3">
            <MetricCard
              label="Completeness"
              value={qualityScore.completeness}
              icon={<Percent className="w-4 h-4" />}
              delay={0.1}
            />
            <MetricCard
              label="Validity"
              value={qualityScore.validity}
              icon={<CheckCircle className="w-4 h-4" />}
              delay={0.2}
            />
            <MetricCard
              label="Consistency"
              value={qualityScore.consistency}
              icon={<Layers className="w-4 h-4" />}
              delay={0.3}
            />
            <MetricCard
              label="Uniqueness"
              value={qualityScore.uniqueness}
              icon={<Fingerprint className="w-4 h-4" />}
              delay={0.4}
            />
          </div>
        </div>

        {/* Issues Summary */}
        {columnsWithIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-4 rounded-xl border dark:border-gray-600"
            style={{
              backgroundColor: `${BRAND_PALETTE.lightGray}99`,
              borderColor: BRAND_PALETTE.darkGray,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: BRAND_PALETTE.red }} />
              <h4 className="font-semibold" style={{ color: BRAND_PALETTE.darkBlue }}>
                Data Quality Issues Detected
              </h4>
            </div>
            <div className="space-y-2">
              {columnsWithIssues.slice(0, 5).map((column, index) => (
                <div
                  key={column.column}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="font-medium min-w-[120px]" style={{ color: BRAND_PALETTE.darkBlue }}>
                    {column.column}:
                  </span>
                  <span style={{ color: BRAND_PALETTE.darkGray }}>
                    {column.issues.join(', ')}
                  </span>
                </div>
              ))}
              {columnsWithIssues.length > 5 && (
                <p className="text-xs mt-2" style={{ color: BRAND_PALETTE.darkGray }}>
                  + {columnsWithIssues.length - 5} more columns with issues
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Column Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: BRAND_PALETTE.darkBlue }} />
            Column Quality Breakdown
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
            {qualityScore.columnScores.map((column, index) => {
              const avgScore = Math.round((column.completeness + column.validity) / 2);
              const color = getScoreColor(avgScore);
              
              return (
                <div
                  key={column.column}
                  className="flex items-center gap-2 p-2 rounded-lg dark:bg-gray-800/50"
                  style={{ backgroundColor: `${BRAND_PALETTE.lightGray}80` }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                    {column.column}
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{ color }}
                  >
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

