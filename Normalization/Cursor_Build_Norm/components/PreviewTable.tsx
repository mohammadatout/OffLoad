'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { CSVRow } from '@/lib/types';
import { Table, Check, X, Pencil, Eye, EyeOff } from 'lucide-react';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

interface PreviewTableProps {
  data: CSVRow[];
  headers: string[];
  title?: string;
  companyNameColumn?: string;
  onCompanyNameColumnChange?: (value: string) => void;
  suggestedCompanyColumn?: string;
  onSuggestedCompanyColumnApply?: () => void;
  columnRenames?: { [originalName: string]: string };
  onColumnRename?: (originalName: string, newName: string) => void;
  excludedColumns?: string[];
  onColumnExcludeToggle?: (column: string) => void;
  /** Opens full column profiler (e.g. from workspace) */
  onOpenColumnProfiler?: () => void;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  data,
  headers,
  title = 'Data Preview',
  companyNameColumn,
  onCompanyNameColumnChange,
  suggestedCompanyColumn,
  onSuggestedCompanyColumnApply,
  columnRenames = {},
  onColumnRename,
  excludedColumns = [],
  onColumnExcludeToggle,
  onOpenColumnProfiler,
}) => {
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const previewRows = data.slice(0, 5);
  const companyOptions = [
    { value: '', label: '-- Select Column --' },
    ...headers.map((header) => ({ value: header, label: header })),
  ];

  const handleStartEdit = (column: string) => {
    setEditingColumn(column);
    setEditValue(columnRenames[column] || column);
  };

  const handleSaveEdit = () => {
    if (editingColumn && onColumnRename) {
      const cleanedValue = editValue.trim().replace(/\s+/g, ' ');
      if (cleanedValue && cleanedValue !== editingColumn) {
        onColumnRename(editingColumn, cleanedValue);
      }
    }
    setEditingColumn(null);
    setEditValue('');
  };

  const handleCancelEdit = () => {
    setEditingColumn(null);
    setEditValue('');
  };

  const getDisplayName = (column: string): string => {
    return columnRenames[column] || column;
  };

  return (
    <Card variant="obsidian">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Table className="w-5 h-5 text-app-text" strokeWidth={1.5} />
            <CardTitle>{title}</CardTitle>
            {onOpenColumnProfiler && (
              <button
                type="button"
                onClick={onOpenColumnProfiler}
                className="text-[11px] font-mono text-app-accent hover:underline ml-1"
              >
                Column profiler
              </button>
            )}
            <span className="text-xs text-app-muted font-normal font-mono">
              Showing {previewRows.length} of {data.length.toLocaleString()} rows
            </span>
          </div>
          {onCompanyNameColumnChange && (
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              <div>
                <p className="text-xs font-medium text-[#74bf4b] tracking-wide">
                  Select the master field for entity/company name
                </p>
              </div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="min-w-[220px]">
                  <Select
                    value={companyNameColumn || suggestedCompanyColumn || ''}
                    onChange={(event) => onCompanyNameColumnChange(event.target.value)}
                    options={companyOptions}
                  />
                </div>
                {suggestedCompanyColumn && onSuggestedCompanyColumnApply && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSuggestedCompanyColumnApply}
                    className="whitespace-nowrap pulse-highlight hover:!border-[#080D44] hover:!text-[#060a33]"
                  >
                    Use suggested ({suggestedCompanyColumn})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-obsidian-layer1 border-y border-obsidian-border">
              <tr>
                {headers.map((header) => {
                  const isExcluded = excludedColumns.includes(header);
                  const isEditing = editingColumn === header;
                  
                  return (
                    <th
                      key={header}
                      className={`px-4 py-3 font-medium text-xs uppercase tracking-wide border-r border-obsidian-border last:border-r-0 transition-colors ${
                        isExcluded ? 'bg-obsidian-hover text-app-muted' : 'text-app-muted'
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {isEditing ? (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-1"
                          >
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="h-6 text-xs py-0 px-1"
                              autoFocus
                            />
                            <button
                              onClick={handleSaveEdit}
                              className="p-0.5 text-neon-green hover:bg-neon-green/10 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-0.5 text-neon-red hover:bg-neon-red/10 rounded"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                          >
                            {onColumnExcludeToggle && (
                              <button
                                onClick={() => onColumnExcludeToggle(header)}
                                className={`p-0.5 rounded transition-colors ${
                                  isExcluded 
                                    ? 'text-app-muted hover:text-app-text' 
                                    : 'text-app-text hover:text-app-accent-hover'
                                }`}
                                title={isExcluded ? 'Include in output' : 'Exclude from output'}
                              >
                                {isExcluded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            )}
                            <span 
                              className={`truncate cursor-pointer hover:text-app-text transition-colors ${
                                columnRenames[header] ? 'text-app-text underline decoration-app-border underline-offset-2' : 'text-app-text'
                              }`}
                              onClick={() => onColumnRename && handleStartEdit(header)}
                              title={onColumnRename ? 'Click to rename' : undefined}
                            >
                              {getDisplayName(header)}
                            </span>
                            {onColumnRename && (
                              <button
                                onClick={() => handleStartEdit(header)}
                                className="p-0.5 text-gray-600 hover:text-gray-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-obsidian-border">
              {previewRows.map((row, index) => (
                <tr key={index} className="hover:bg-obsidian-hover/50 transition-colors">
                  {headers.map((header) => {
                    const isExcluded = excludedColumns.includes(header);
                    return (
                      <td
                        key={`${index}-${header}`}
                        className={`px-4 py-2 text-xs whitespace-nowrap max-w-[200px] truncate border-r border-obsidian-border last:border-r-0 font-mono ${
                          isExcluded ? 'text-app-muted' : 'text-app-text'
                        }`}
                        title={String(row[header] || '')}
                      >
                        {String(row[header] || '')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        {(onColumnRename || onColumnExcludeToggle) && (
          <div className="px-4 py-2 border-t border-obsidian-border bg-obsidian-layer1 flex items-center gap-4 text-[10px] text-app-muted">
            {onColumnRename && (
              <span className="flex items-center gap-1">
                <Pencil className="w-2.5 h-2.5" />
                Click header name to rename
              </span>
            )}
            {onColumnExcludeToggle && (
              <span className="flex items-center gap-1">
                <Eye className="w-2.5 h-2.5" />
                Toggle column visibility in output
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
