'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Upload, FileSpreadsheet, X, CheckCircle } from 'lucide-react';
import Papa from 'papaparse';
import { CSVRow, FileData } from '@/lib/types';
import { analyzeCSVData } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded: (fileData: FileData) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUploaded
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  
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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };
  
  const handleFileSelection = (file: File) => {
    setError('');
    
    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }
    
    setUploadedFile(file);
    setIsProcessing(true);
    
    // Parse CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as CSVRow[];
          
          if (data.length === 0) {
            setError('The CSV file is empty.');
            setIsProcessing(false);
            return;
          }
          
          const headers = Object.keys(data[0]);
          const columnInfo = analyzeCSVData(data);
          
          const fileData: FileData = {
            fileName: file.name,
            headers,
            data,
            columnInfo,
          };
          
          onFileUploaded(fileData);
          setIsProcessing(false);
        } catch (err) {
          setError('Failed to process CSV file. Please check the file format.');
          setIsProcessing(false);
        }
      },
      error: (err) => {
        setError(`Error parsing CSV: ${err.message}`);
        setIsProcessing(false);
      },
    });
  };
  
  const handleMainFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };
  
  const clearMainFile = () => {
    setUploadedFile(null);
    setError('');
    if (mainFileInputRef.current) {
      mainFileInputRef.current.value = '';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Main CSV Upload */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Upload CSV File
          </h3>
          
          {error && (
            <Alert variant="danger" className="mb-4">
              {error}
            </Alert>
          )}
          
          {!uploadedFile ? (
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => mainFileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
                ${isDragging 
                  ? 'border-accent-blue dark:border-accent-cyan bg-accent-blue/5 dark:bg-accent-cyan/5' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-accent-blue dark:hover:border-accent-cyan'
                }
              `}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                {isDragging ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                or click to browse
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  mainFileInputRef.current?.click();
                }}
              >
                Select File
              </Button>
              
              <input
                ref={mainFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleMainFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <FileSpreadsheet className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {uploadedFile.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  {!isProcessing && (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 ml-2" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearMainFile}
                  disabled={isProcessing}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {isProcessing && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Processing file...
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

