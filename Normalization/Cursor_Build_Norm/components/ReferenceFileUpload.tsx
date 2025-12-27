'use client';

import React, { useRef, useState } from 'react';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { ReferenceColumnMapping } from '@/lib/types';
import { detectReferenceColumns } from '@/lib/utils';

interface ReferenceFileUploadProps {
  onReferenceFileUploaded: (
    data: Record<string, any>[],
    mapping: ReferenceColumnMapping,
    fileInfo: { name: string; size: number }
  ) => void;
  onReferenceFileCleared: () => void;
  existingFileInfo: { name: string; size: number } | null;
  existingMapping: ReferenceColumnMapping | null;
  isRequired: boolean;
}

export const ReferenceFileUpload: React.FC<ReferenceFileUploadProps> = ({
  onReferenceFileUploaded,
  onReferenceFileCleared,
  existingFileInfo,
  existingMapping,
  isRequired,
}) => {
  const [error, setError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = (file: File) => {
    setError('');
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file for reference data.');
      return;
    }
    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as Record<string, any>[];
          if (data.length === 0) {
            setError('Reference file is empty.');
            setIsParsing(false);
            return;
          }
          const headers = Object.keys(data[0]);
          const detected = detectReferenceColumns(headers);
          if (!detected.city || !detected.state) {
            setError('Reference file must contain city and state columns. Detected: ' + headers.join(', '));
            setIsParsing(false);
            return;
          }
          const mapping: ReferenceColumnMapping = {
            city: detected.city,
            state: detected.state,
            cityState: detected.cityState || '',
          };
          onReferenceFileUploaded(data, mapping, { name: file.name, size: file.size });
          setIsParsing(false);
        } catch (err) {
          setError('Failed to process reference CSV file.');
          setIsParsing(false);
        }
      },
      error: (err) => {
        setError(`Error parsing reference CSV: ${err.message}`);
        setIsParsing(false);
      },
    });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFileSelection(event.target.files[0]);
      event.target.value = '';
    }
  };

  const handleClear = () => {
    onReferenceFileCleared();
    setError('');
  };

  const fileMeta = existingFileInfo;

  return (
    <div className="rounded-lg border border-light-border dark:border-dark-border bg-light-card dark:bg-dark-card shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Upload Reference File
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Provide a city/state CSV to power validation
          </p>
        </div>
        {isRequired && (
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
            Required
          </span>
        )}
      </div>

      {error && (
        <Alert variant="danger">
          {error}
        </Alert>
      )}

      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Expected columns: <strong>city</strong>, <strong>state</strong>, <strong>City_State</strong>
      </p>

      {!fileMeta ? (
        <Button
          variant="outline"
          size="md"
          className="w-full justify-center"
          onClick={() => inputRef.current?.click()}
          disabled={isParsing}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isParsing ? 'Parsing...' : 'Select Reference File'}
        </Button>
      ) : (
        <div className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {fileMeta.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(fileMeta.size / 1024).toFixed(2)} KB
                </p>
              </div>
              <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-2" />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Re-upload
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {existingMapping && (
            <div className="mt-3 p-3 bg-white dark:bg-dark-bg rounded border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Detected Column Mapping:
                </p>
              </div>
              <div className="text-sm space-y-1">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">City:</span> {existingMapping.city}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">State:</span> {existingMapping.state}
                </p>
                {existingMapping.cityState && (
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">City_State:</span> {existingMapping.cityState}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
};


