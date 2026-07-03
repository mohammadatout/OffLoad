'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { cn } from '@/lib/utils';
import { BRAND_PALETTE, getSpotlightBarFills } from '@/lib/brandPalette';
import { CSVRow } from '@/lib/types';
import { BarChart3, HelpCircle } from 'lucide-react';

interface TopValuesSpotlightProps {
  data: CSVRow[];
  headers: string[];
}

export const TopValuesSpotlight: React.FC<TopValuesSpotlightProps> = ({ data, headers }) => {
  // Find a sensible default column: company name, name, or the first header
  const defaultColumn = useMemo(() => {
    if (headers.length === 0) return '';
    const companyCol = headers.find(h => {
      const lower = h.toLowerCase();
      return lower.includes('company') || lower.includes('name') || lower.includes('entity');
    });
    return companyCol || headers[0];
  }, [headers]);

  const [selectedColumn, setSelectedColumn] = useState<string>('');

  const activeColumn = selectedColumn || defaultColumn;

  // Calculate the top values for the selected column
  const topValues = useMemo(() => {
    if (!activeColumn || data.length === 0) return [];

    const counts = new Map<string, number>();
    let totalCount = 0;

    for (const row of data) {
      const val = String(row[activeColumn] || '').trim();
      const displayVal = val === '' ? '(Empty)' : val;
      counts.set(displayVal, (counts.get(displayVal) || 0) + 1);
      totalCount++;
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({
        value,
        count,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      }));
  }, [data, activeColumn]);

  const fills = getSpotlightBarFills();

  if (headers.length === 0 || data.length === 0) {
    return null;
  }

  return (
    <Card variant="obsidian" className="min-h-0 h-full flex flex-col">
      <CardHeader className="py-phi-1 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="rounded-lg shrink-0 p-1.5"
              style={{ backgroundColor: `${BRAND_PALETTE.darkBlue}15` }}
            >
              <BarChart3 className="w-4 h-4" style={{ color: BRAND_PALETTE.darkBlue }} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-xs">Top Values Spotlight</CardTitle>
              <p className="text-[10px] leading-tight mt-0.5 text-app-muted">
                Distribution of values in the selected field
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <select
              value={activeColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="px-2 py-1 rounded border border-landing-border bg-white dark:bg-dark-bg text-[10px] font-medium text-app-text outline-none focus:border-app-text transition-colors max-w-[120px] truncate"
            >
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="py-phi-1.5 flex-1 flex flex-col min-h-0 space-y-2">
        {topValues.length > 0 ? (
          <div className="space-y-1.5">
            {topValues.map((item, index) => {
              const fillColor = fills[index % fills.length];
              return (
                <div key={item.value} className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-medium">
                    <span className="truncate text-app-text max-w-[70%]" title={item.value}>
                      {item.value}
                    </span>
                    <span className="font-mono text-app-muted">
                      {item.count.toLocaleString()} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full w-full bg-landing-bg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ duration: 0.8, delay: index * 0.1 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: fillColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-2 text-[11px] text-app-muted flex flex-col items-center justify-center gap-1">
            <HelpCircle className="w-5 h-5 opacity-45" />
            <span>No data available for this column</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
