'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { ProcessingStats } from '@/lib/types';

interface PerformanceChartsProps {
  stats: ProcessingStats;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ stats }) => {
  const before = Math.max(stats.initialRows, 0);
  const after = Math.max(stats.totalRows, 0);
  const barData = [
    {
      name: 'Rows',
      Before: before,
      After: after,
    },
  ];
  const reductionPercentage = before ? ((before - after) / before) * 100 : 0;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Cleaning vs Deduplication</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value: number) => value.toLocaleString()} />
              <Legend />
              <Bar dataKey="Before" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="After" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Reduction {reductionPercentage.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
};


