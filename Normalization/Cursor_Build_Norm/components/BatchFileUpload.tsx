'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Alert } from './ui/Alert';
import {
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  Download,
  Trash2,
  Files,
  AlertCircle,
} from 'lucide-react';
import Papa from 'papaparse';
import { BatchFileInfo, CSVRow, ProcessingConfig, ProcessingStats } from '@/lib/types';
import { processCSVData, exportToCSV } from '@/lib/dataProcessing';
import { loadAbbreviations, loadLegalEntities } from '@/lib/storage';
import { analyzeCSVData } from '@/lib/utils';

interface BatchFileUploadProps {
  config: ProcessingConfig;
  onBatchComplete?: (results: BatchFileInfo[]) => void;
}

export const BatchFileUpload: React.FC<BatchFileUploadProps> = ({
  config,
  onBatchComplete,
}) => {
  const [files, setFiles] = useState<BatchFileInfo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.name.endsWith('.csv')
    );

    if (droppedFiles.length === 0) {
      setError('Please drop CSV files only');
      return;
    }

    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(
      (file) => file.name.endsWith('.csv')
    );
    addFiles(selectedFiles);
    e.target.value = '';
  };

  const addFiles = (newFiles: File[]) => {
    const newBatchFiles: BatchFileInfo[] = newFiles.map((file) => ({
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file,
      fileName: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
    }));

    setFiles((prev) => [...prev, ...newBatchFiles]);
    setError('');
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearAll = () => {
    setFiles([]);
    setError('');
  };

  const processFile = async (fileInfo: BatchFileInfo): Promise<BatchFileInfo> => {
    return new Promise((resolve) => {
      Papa.parse(fileInfo.file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const data = results.data as CSVRow[];

            if (data.length === 0) {
              resolve({
                ...fileInfo,
                status: 'error',
                error: 'File is empty',
                progress: 100,
              });
              return;
            }

            const abbreviations = loadAbbreviations();
            const legalEntities = loadLegalEntities();

            const { processedData, stats } = processCSVData(
              data,
              config,
              legalEntities,
              abbreviations,
              [],
              undefined,
              undefined
            );

            resolve({
              ...fileInfo,
              status: 'completed',
              progress: 100,
              rowCount: data.length,
              processedData,
              stats,
            });
          } catch (err: any) {
            resolve({
              ...fileInfo,
              status: 'error',
              error: err.message || 'Processing failed',
              progress: 100,
            });
          }
        },
        error: (err) => {
          resolve({
            ...fileInfo,
            status: 'error',
            error: err.message,
            progress: 100,
          });
        },
      });
    });
  };

  const processAllFiles = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError('');

    const results: BatchFileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Update status to processing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: 'processing', progress: 50 } : f
        )
      );

      const result = await processFile(file);
      results.push(result);

      // Update with result
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? result : f))
      );
    }

    setIsProcessing(false);
    onBatchComplete?.(results);
  };

  const downloadFile = (fileInfo: BatchFileInfo) => {
    if (!fileInfo.processedData || fileInfo.processedData.length === 0) return;

    const csvContent = exportToCSV(
      fileInfo.processedData,
      fileInfo.fileName,
      config.outputColumns.length > 0 ? config.outputColumns : undefined,
      config.columnRenames,
      true
    );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const cleanName = fileInfo.fileName.replace('.csv', '');
    link.setAttribute('href', url);
    link.setAttribute('download', `${cleanName}_cleaned_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllCompleted = () => {
    const completedFiles = files.filter((f) => f.status === 'completed');
    completedFiles.forEach((file) => downloadFile(file));
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const pendingCount = files.filter((f) => f.status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Files className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <CardTitle className="text-base">Batch Processing</CardTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Process multiple CSV files with the same configuration
              </p>
            </div>
          </div>
          {files.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="info">{files.length} files</Badge>
              {completedCount > 0 && (
                <Badge variant="success">{completedCount} completed</Badge>
              )}
              {errorCount > 0 && (
                <Badge variant="danger">{errorCount} failed</Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="danger">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          </Alert>
        )}

        {/* Drop Zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500'
            }
          `}
        >
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isDragging ? 'Drop files here' : 'Drop multiple CSV files or click to browse'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            All files will be processed with the current configuration
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Files ({files.length})
              </h4>
              <div className="flex gap-2">
                {completedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadAllCompleted}
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download All ({completedCount})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  disabled={isProcessing}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              <AnimatePresence>
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className={`
                      p-3 rounded-lg border transition-colors
                      ${file.status === 'completed'
                        ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                        : file.status === 'error'
                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : file.status === 'processing'
                        ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20'
                        : 'border-light-border dark:border-dark-border bg-gray-50 dark:bg-gray-800/50'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                          {file.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : file.status === 'error' ? (
                            <XCircle className="w-5 h-5 text-red-600" />
                          ) : file.status === 'processing' ? (
                            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="w-5 h-5 text-gray-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                            {file.fileName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {(file.size / 1024).toFixed(1)} KB
                            {file.rowCount && ` • ${file.rowCount.toLocaleString()} rows`}
                            {file.stats && ` • ${file.stats.duplicatesRemoved} duplicates removed`}
                          </p>
                          {file.error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              {file.error}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {file.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadFile(file)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          disabled={isProcessing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Progress bar for processing */}
                    {file.status === 'processing' && (
                      <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                          className="h-full bg-indigo-500 rounded-full"
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Process Button */}
            {pendingCount > 0 && (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={processAllFiles}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Process All Files ({pendingCount})
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

