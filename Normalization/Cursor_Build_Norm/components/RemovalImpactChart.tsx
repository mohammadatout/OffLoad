'use client';

import React from 'react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ProcessingStats } from '@/lib/types';

interface RemovalImpactChartProps {
  stats: ProcessingStats;
}

export const RemovalImpactChart: React.FC<RemovalImpactChartProps> = ({ stats }) => {
  const removed = stats.duplicatesRemoved;
  const total = stats.initialRows || 1;
  const percent = Math.min(100, Math.max(0, (removed / total) * 100));

  const chartData = [
    { name: 'Removed', value: percent, fill: '#049FD9' },
    { name: 'Remaining', value: 100 - percent, fill: '#0d1b2a' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Removal Impact</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row items-center gap-6">
        <div className="w-full md:w-1/2 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={chartData}
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="100%"
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                tick={false}
              />
              <RadialBar
                dataKey="value"
                cornerRadius={10}
                background={{ fill: '#0d1b2a', opacity: 0.2 }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Percentage of rows removed out of total processed records.
          </p>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Removed Rows
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {percent.toFixed(1)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {removed.toLocaleString()} removed / {stats.initialRows.toLocaleString()} total
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <p className="text-gray-600 dark:text-gray-300">Unique Entities</p>
              <p className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                {stats.totalRows.toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/30">
              <p className="text-gray-600 dark:text-gray-300">Removed Duplicates</p>
              <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                {removed.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

