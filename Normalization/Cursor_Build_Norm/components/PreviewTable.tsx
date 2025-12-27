'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { CSVRow } from '@/lib/types';
import { Table } from 'lucide-react';
import { Select } from './ui/Select';
import { Button } from './ui/Button';

interface PreviewTableProps {
  data: CSVRow[];
  headers: string[];
  title?: string;
  companyNameColumn?: string;
  onCompanyNameColumnChange?: (value: string) => void;
  suggestedCompanyColumn?: string;
  onSuggestedCompanyColumnApply?: () => void;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  data,
  headers,
  title = 'Data Preview',
  companyNameColumn,
  onCompanyNameColumnChange,
  suggestedCompanyColumn,
  onSuggestedCompanyColumnApply,
}) => {
  const previewRows = data.slice(0, 5);
  const companyOptions = [
    { value: '', label: '-- Select Column --' },
    ...headers.map((header) => ({ value: header, label: header })),
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Table className="w-5 h-5 text-accent-blue" />
            <CardTitle>{title}</CardTitle>
            <span className="text-xs text-gray-500 font-normal">
              Showing {previewRows.length} of {data.length} rows
            </span>
          </div>
          {onCompanyNameColumnChange && (
            <div className="flex flex-col gap-2 w-full lg:w-auto">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                  Entity/Company Name Field
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Please select the main field of the Entity Name.
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
                    className="whitespace-nowrap"
                  >
                    Use suggested ({suggestedCompanyColumn})
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border border-light-border dark:border-dark-border rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-2 font-medium text-gray-600 dark:text-gray-300 border-b border-light-border dark:border-dark-border whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-light-border dark:divide-dark-border bg-white dark:bg-dark-card">
              {previewRows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  {headers.map((header) => (
                    <td
                      key={`${index}-${header}`}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap max-w-xs truncate"
                      title={String(row[header] || '')}
                    >
                      {String(row[header] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

