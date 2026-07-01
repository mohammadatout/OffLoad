'use client';

import React, { useCallback, useMemo, useState } from 'react';
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

const PINNED_COLUMN_WIDTH = 220;

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
  const [quickSearch, setQuickSearch] = useState('');
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const pinnedColumns = 1;

  const previewRows = useMemo(() => data.slice(0, 5), [data]);
  const normalizedSearch = quickSearch.trim().toLowerCase();

  const getDisplayName = useCallback(
    (column: string): string => columnRenames[column] || column,
    [columnRenames]
  );

  const hasColumnNameMatch = useMemo(() => {
    if (!normalizedSearch) return false;
    return headers.some((header) =>
      getDisplayName(header).toLowerCase().includes(normalizedSearch)
    );
  }, [headers, normalizedSearch, getDisplayName]);

  const visibleHeaders = useMemo(() => {
    if (!normalizedSearch) return headers;
    return headers.filter((header) => {
      if (getDisplayName(header).toLowerCase().includes(normalizedSearch)) return true;
      return previewRows.some((row) =>
        String(row[header] ?? '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [headers, previewRows, normalizedSearch, getDisplayName]);

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) return previewRows;
    if (hasColumnNameMatch) return previewRows;
    return previewRows.filter((row) =>
      visibleHeaders.some((header) =>
        String(row[header] ?? '').toLowerCase().includes(normalizedSearch)
      )
    );
  }, [previewRows, visibleHeaders, normalizedSearch, hasColumnNameMatch]);

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

  return (
    <Card variant="obsidian">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1 min-w-0">
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
            </div>
            {onCompanyNameColumnChange && (
              <p className="text-xs font-medium text-[#74bf4b] tracking-wide">
                Select the master field for entity/company name
              </p>
            )}
          </div>
          {onCompanyNameColumnChange && (
            <div className="flex flex-col gap-2 w-full lg:w-auto">
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
        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-[320px]">
            <Input
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Search columns or preview values..."
              className="h-8 text-[12px] font-mono"
            />
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-app-muted uppercase tracking-wide">Density</span>
              <button
                type="button"
                onClick={() => setDensity('comfortable')}
                className="h-7 px-2.5 rounded border transition-colors"
                style={{
                  borderColor: '#E5E3DC',
                  background: density === 'comfortable' ? 'rgba(10,10,10,0.07)' : 'transparent',
                  color: '#080D44',
                }}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => setDensity('compact')}
                className="h-7 px-2.5 rounded border transition-colors"
                style={{
                  borderColor: '#E5E3DC',
                  background: density === 'compact' ? 'rgba(10,10,10,0.07)' : 'transparent',
                  color: '#080D44',
                }}
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-max min-w-full text-sm text-left table-auto border-collapse">
            <thead className="bg-obsidian-layer1 border-y border-obsidian-border">
              <tr>
                {visibleHeaders.map((header, columnIndex) => {
                  const isExcluded = excludedColumns.includes(header);
                  const isEditing = editingColumn === header;
                  const isPinned = columnIndex < pinnedColumns;
                  const pinnedLeft = columnIndex === 0 ? 0 : PINNED_COLUMN_WIDTH;
                  
                  return (
                    <th
                      key={header}
                      className={`font-medium uppercase tracking-wide border-r border-obsidian-border last:border-r-0 transition-colors ${
                        density === 'compact' ? 'px-3 py-2 text-[10px]' : 'px-4 py-3 text-xs'
                      } ${
                        isPinned ? 'w-[220px] min-w-[220px] max-w-[220px] sticky z-20' : 'min-w-[200px]'
                      } ${
                        isExcluded ? 'bg-obsidian-hover text-app-muted' : 'text-app-muted'
                      }`}
                      style={
                        isPinned
                          ? {
                              left: pinnedLeft,
                              background: isExcluded ? '#F0EFEA' : '#FFFFFF',
                              boxShadow: columnIndex === pinnedColumns - 1 ? '2px 0 0 0 #E5E3DC' : undefined,
                            }
                          : undefined
                      }
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
                              className={`cursor-pointer hover:text-app-text transition-colors leading-snug ${
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
              {filteredRows.map((row, index) => (
                <tr key={index} className="hover:bg-obsidian-hover/50 transition-colors">
                  {visibleHeaders.map((header, columnIndex) => {
                    const isExcluded = excludedColumns.includes(header);
                    const isPinned = columnIndex < pinnedColumns;
                    const pinnedLeft = columnIndex === 0 ? 0 : PINNED_COLUMN_WIDTH;
                    return (
                      <td
                        key={`${index}-${header}`}
                        className={`whitespace-nowrap border-r border-obsidian-border last:border-r-0 font-mono ${
                          density === 'compact' ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs'
                        } ${
                          isPinned ? 'w-[220px] min-w-[220px] max-w-[220px] sticky z-10' : 'min-w-[200px]'
                        } ${
                          isExcluded ? 'text-app-muted' : 'text-app-text'
                        }`}
                        title={String(row[header] || '')}
                        style={
                          isPinned
                            ? {
                                left: pinnedLeft,
                                background: isExcluded ? '#F7F6F2' : '#FFFFFF',
                                boxShadow: columnIndex === pinnedColumns - 1 ? '2px 0 0 0 #E5E3DC' : undefined,
                              }
                            : undefined
                        }
                      >
                        {String(row[header] || '')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {normalizedSearch && visibleHeaders.length === 0 && (
            <div className="px-4 py-6 text-[12px] font-mono" style={{ color: '#6B6B66' }}>
              No columns or values matched your search.
            </div>
          )}
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
