'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { CSVRow } from '@/lib/types';
import { Table } from 'lucide-react';

interface PreviewTableProps {
  data: CSVRow[];
  headers: string[];
  title?: string;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({
  data,
  headers,
  title = 'Data Preview',
}) => {
  const previewRows = data.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Table className="w-5 h-5 text-accent-blue" />
          <CardTitle>{title}</CardTitle>
          <span className="ml-auto text-xs text-gray-500 font-normal">
            Showing {previewRows.length} of {data.length} rows
          </span>
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

