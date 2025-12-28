'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Alert } from './ui/Alert';
import { 
  CheckCircle, 
  FileSpreadsheet, 
  Columns, 
  Filter,
  Users,
  XCircle,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react';
import { ProcessingStats, CSVRow, CumulativeStats } from '@/lib/types';
import { PerformanceCharts } from './PerformanceCharts';
import { RemovalImpactChart } from './RemovalImpactChart';

interface ResultsDisplayProps {
  stats: ProcessingStats;
  originalData: CSVRow[];
  processedData: CSVRow[];
  cumulativeStats: CumulativeStats;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  stats,
  originalData,
  processedData,
  cumulativeStats,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };
  
  return (
    <div className="space-y-6">
      {/* Processing Summary */}
      <Card>
        <CardHeader>
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection('summary')}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <CardTitle>Processing Summary</CardTitle>
            </div>
            {expandedSections.has('summary') ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </CardHeader>
        
        {expandedSections.has('summary') && (
          <CardContent>
            <Alert variant="success" className="mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Processing completed successfully!</span>
              </div>
            </Alert>
            
            <div className="grid gap-6 lg:grid-cols-[3fr,2fr]">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200">Clean Rows</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {stats.totalRows.toLocaleString()}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800">
                  <div className="flex items-center gap-2 mb-2">
                    <FileSpreadsheet className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <p className="text-xs font-medium text-sky-800 dark:text-sky-200">Rows Processed</p>
                  </div>
                  <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">
                    {stats.initialRows.toLocaleString()}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Columns className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <p className="text-xs font-medium text-purple-800 dark:text-purple-200">Columns Processed</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {stats.columnsProcessed}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-medium text-green-800 dark:text-green-200">Total Changes</p>
                  </div>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {stats.totalChanges.toLocaleString()}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    <p className="text-xs font-medium text-red-800 dark:text-red-200">Duplicates Removed</p>
                  </div>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {stats.duplicatesRemoved.toLocaleString()}
                  </p>
                </div>
                
                {stats.companiesProcessed > 0 && (
                  <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <p className="text-xs font-medium text-cyan-800 dark:text-cyan-200">Companies Cleaned</p>
                    </div>
                    <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                      {stats.companiesProcessed}
                    </p>
                  </div>
                )}
                
                {stats.rowsGrouped > 0 && (
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Filter className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">Rows Grouped</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                      {stats.rowsGrouped}
                    </p>
                  </div>
                )}
                
                {stats.invalidCities > 0 && (
                  <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <p className="text-xs font-medium text-orange-800 dark:text-orange-200">Invalid Cities</p>
                    </div>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      {stats.invalidCities}
                    </p>
                  </div>
                )}
                
                {stats.invalidCityStates > 0 && (
                  <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                      <p className="text-xs font-medium text-pink-800 dark:text-pink-200">Invalid City-States</p>
                    </div>
                    <p className="text-2xl font-bold text-pink-900 dark:text-pink-100">
                      {stats.invalidCityStates}
                    </p>
                  </div>
                )}
                
                {stats.noDataCities > 0 && (
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">No Data (Cities)</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {stats.noDataCities}
                    </p>
                  </div>
                )}
                
                {stats.noDataCityStates > 0 && (
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200">No Data (City-States)</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {stats.noDataCityStates}
                    </p>
                  </div>
                )}
                
                </div>
              
              <div className="space-y-4">
                <RemovalImpactChart stats={stats} />
                <PerformanceCharts stats={stats} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

