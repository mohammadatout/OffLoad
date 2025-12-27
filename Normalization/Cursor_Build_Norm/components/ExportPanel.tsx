'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { FileSpreadsheet, ClipboardList } from 'lucide-react';

interface ExportPanelProps {
  customFilename: string;
  onFilenameChange: (value: string) => void;
  onExportClean: () => void;
  onExportAudit: () => void;
  isProcessing: boolean;
  hasResults: boolean;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  customFilename,
  onFilenameChange,
  onExportClean,
  onExportAudit,
  isProcessing,
  hasResults,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export & Naming</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Output Filename (optional)
          </label>
          <Input
            type="text"
            value={customFilename}
            onChange={(e) => onFilenameChange(e.target.value)}
            placeholder="cleaned_data"
            disabled={isProcessing}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Final files will be named like{' '}
            <span className="font-semibold">
              {customFilename || 'cleaned_data'}_YYYYMMDD_HHMMSS.csv
            </span>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            size="lg"
            className="flex items-center justify-center gap-2"
            onClick={onExportClean}
            disabled={!hasResults || isProcessing}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Clean Build
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex items-center justify-center gap-2"
            onClick={onExportAudit}
            disabled={!hasResults || isProcessing}
          >
            <ClipboardList className="w-4 h-4" />
            Export Audit Trail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

