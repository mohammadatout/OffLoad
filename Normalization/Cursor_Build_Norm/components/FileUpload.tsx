'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { CSVRow, FileData, ReferenceColumnMapping } from '@/lib/types';
import { analyzeCSVData, detectReferenceColumns } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded: (fileData: FileData) => void;
  onReferenceFileUploaded?: (data: any[], mapping: ReferenceColumnMapping) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUploaded, 
  onReferenceFileUploaded 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceMapping, setReferenceMapping] = useState<ReferenceColumnMapping | null>(null);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);
  
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
  
  const handleReferenceFileSelection = (file: File) => {
    setError('');
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file for reference data.');
      return;
    }
    
    setReferenceFile(file);
    
    // Parse reference CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data;
          
          if (data.length === 0) {
            setError('Reference file is empty.');
            setReferenceFile(null);
            setReferenceMapping(null);
            return;
          }
          
          // Enhancement 10: Flexible column detection
          const headers = Object.keys(data[0]);
          const detected = detectReferenceColumns(headers);
          
          if (!detected.city || !detected.state) {
            // Don't reset immediately, try to be lenient or just warn
            // The user might have different headers we didn't detect.
            // But requirement says: "Auto-detect columns... even if headers vary".
            // For now, if detection fails, we can show error but KEEP existing uploads.
            setError('Could not automatically detect City and State columns. Please check headers.');
            // We will accept the file anyway but mapping might be incomplete.
            // User can't manually map yet in UI (future enhancement), so we fail safely.
             setError('Reference file must contain city and state columns. Detected columns: ' + headers.join(', '));
             setReferenceFile(null);
             setReferenceMapping(null);
             return;
          }
          
          const mapping: ReferenceColumnMapping = {
            city: detected.city,
            state: detected.state,
            cityState: detected.cityState || '',
          };
          
          setReferenceMapping(mapping);
          
          if (onReferenceFileUploaded) {
            onReferenceFileUploaded(data, mapping);
          }
        } catch (err) {
          setError('Failed to process reference CSV file.');
          setReferenceFile(null);
          setReferenceMapping(null);
        }
      },
      error: (err) => {
        setError(`Error parsing reference CSV: ${err.message}`);
        setReferenceFile(null);
        setReferenceMapping(null);
      },
    });
  };
  
  const handleMainFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };
  
  const handleReferenceFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleReferenceFileSelection(e.target.files[0]);
    }
  };
  
  const clearMainFile = () => {
    setUploadedFile(null);
    setError('');
    if (mainFileInputRef.current) {
      mainFileInputRef.current.value = '';
    }
  };
  
  const clearReferenceFile = () => {
    setReferenceFile(null);
    setReferenceMapping(null);
    if (referenceFileInputRef.current) {
      referenceFileInputRef.current.value = '';
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
              <Button variant="primary" size="sm" onClick={(e) => e.stopPropagation()}>
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
      
      {/* Reference File Upload (US Cities) */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Upload Reference File (Optional)
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Upload a CSV with city, state, and City_State columns for validation
          </p>
          
          {!referenceFile ? (
            <div>
              <Button
                variant="outline"
                size="md"
                onClick={() => referenceFileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                Select Reference File
              </Button>
              
              <input
                ref={referenceFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleReferenceFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {referenceFile.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Reference data loaded
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-2" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearReferenceFile}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              {referenceMapping && (
                <div className="mt-3 p-3 bg-white dark:bg-dark-bg rounded border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Detected Column Mapping:
                    </p>
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">City:</span> {referenceMapping.city}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">State:</span> {referenceMapping.state}
                    </p>
                    {referenceMapping.cityState && (
                      <p className="text-gray-700 dark:text-gray-300">
                        <span className="font-medium">City_State:</span> {referenceMapping.cityState}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

