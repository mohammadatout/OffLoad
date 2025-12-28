'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Upload, FileSpreadsheet, X, CheckCircle, Loader2, Zap, Files, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { CSVRow, FileData } from '@/lib/types';
import { analyzeCSVData } from '@/lib/utils';

interface FileUploadProps {
  onFileUploaded: (fileData: FileData) => void;
  showBatchMode?: boolean;
  onBatchModeChange?: (isBatch: boolean) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ 
  onFileUploaded,
  showBatchMode = false,
  onBatchModeChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(showBatchMode);
  
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  
  const handleBatchToggle = (batch: boolean) => {
    setIsBatchMode(batch);
    onBatchModeChange?.(batch);
    // Clear files when switching modes
    setUploadedFile(null);
    setUploadedFiles([]);
    setError('');
  };
  
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
    
    const files = Array.from(e.dataTransfer.files);
    if (isBatchMode) {
      handleBatchFileSelection(files);
    } else if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };
  
  const handleFileSelection = (file: File) => {
    setError('');
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }
    
    setUploadedFile(file);
    setIsProcessing(true);
    
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
  
  const handleBatchFileSelection = (files: File[]) => {
    setError('');
    const csvFiles = files.filter(f => f.name.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      setError('Please upload CSV files only.');
      return;
    }
    
    setUploadedFiles(csvFiles);
    
    // Process first file to load into the app
    if (csvFiles.length > 0) {
      handleFileSelection(csvFiles[0]);
    }
  };
  
  const handleMainFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (isBatchMode) {
        handleBatchFileSelection(Array.from(e.target.files));
      } else {
        handleFileSelection(e.target.files[0]);
      }
    }
  };
  
  const clearMainFile = () => {
    setUploadedFile(null);
    setUploadedFiles([]);
    setError('');
    if (mainFileInputRef.current) {
      mainFileInputRef.current.value = '';
    }
    if (batchFileInputRef.current) {
      batchFileInputRef.current.value = '';
    }
  };
  
  return (
    <Card variant="obsidian" className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded flex items-center justify-center bg-electric-cyan/10">
              <Upload className="w-5 h-5 text-electric-cyan" />
            </div>
            <div>
              <h3 className="text-base font-medium text-white">
                Upload CSV {isBatchMode ? 'Files' : 'File'}
              </h3>
              <p className="text-xs text-gray-500">
                Drag & drop or click to browse
              </p>
            </div>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-obsidian-layer1 border border-obsidian-border rounded">
            <button
              onClick={() => handleBatchToggle(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
                !isBatchMode
                  ? 'bg-electric-cyan text-obsidian-base'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <File className="w-3 h-3" />
              Single
            </button>
            <button
              onClick={() => handleBatchToggle(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1.5 ${
                isBatchMode
                  ? 'bg-electric-purple text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Files className="w-3 h-3" />
              Batch
            </button>
          </div>
        </div>
        
        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <div className="p-3 bg-neon-red/10 border border-neon-red/30 rounded text-neon-red text-sm">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {!uploadedFile ? (
          <motion.div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => mainFileInputRef.current?.click()}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={`
              relative border border-dashed rounded p-10 text-center cursor-pointer transition-all overflow-hidden
              ${isDragging 
                ? 'border-electric-cyan bg-electric-cyan/5 upload-zone-drag' 
                : 'border-obsidian-border hover:border-electric-cyan/50 hover:bg-obsidian-hover/30'
              }
            `}
          >
            {/* Animated Background Gradient on Drag */}
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-gradient-to-br from-electric-cyan/10 to-electric-purple/10"
              />
            )}
            
            <div className="relative z-10">
              <motion.div
                animate={isDragging ? { y: [0, -8, 0] } : {}}
                transition={{ duration: 1, repeat: isDragging ? Infinity : 0 }}
                className="w-16 h-16 mx-auto mb-4 rounded-lg bg-obsidian-hover border border-obsidian-border flex items-center justify-center"
              >
                {isBatchMode ? (
                  <Files className="w-8 h-8 text-electric-purple" />
                ) : (
                  <FileSpreadsheet className="w-8 h-8 text-gray-500" />
                )}
              </motion.div>
              
              <p className="text-sm font-medium text-gray-300 mb-1">
                {isDragging 
                  ? `Drop your CSV file${isBatchMode ? 's' : ''} here` 
                  : `Drop CSV file${isBatchMode ? 's' : ''} here or click to browse`
                }
              </p>
              <p className="text-xs text-gray-600 mb-5">
                {isBatchMode 
                  ? 'Select multiple files for batch processing'
                  : 'Supports files up to 100MB'
                }
              </p>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  mainFileInputRef.current?.click();
                }}
                className={`px-5 py-2 text-sm font-medium rounded transition-all inline-flex items-center gap-2 electric-hover ${
                  isBatchMode
                    ? 'text-white bg-electric-purple hover:bg-electric-purple/80'
                    : 'text-obsidian-base bg-electric-cyan hover:bg-electric-cyan-dark'
                }`}
              >
                <Zap className="w-4 h-4" />
                Select File{isBatchMode ? 's' : ''}
              </button>
            </div>
            
            <input
              ref={mainFileInputRef}
              type="file"
              accept=".csv"
              multiple={isBatchMode}
              onChange={handleMainFileInputChange}
              className="hidden"
            />
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="border border-neon-green/30 rounded p-4 bg-neon-green/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded flex items-center justify-center bg-neon-green/10">
                  {isBatchMode && uploadedFiles.length > 1 ? (
                    <Files className="w-5 h-5 text-neon-green" />
                  ) : (
                    <FileSpreadsheet className="w-5 h-5 text-neon-green" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {isBatchMode && uploadedFiles.length > 1 
                      ? `${uploadedFiles.length} files selected`
                      : uploadedFile.name
                    }
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {isBatchMode && uploadedFiles.length > 1
                      ? `Total: ${(uploadedFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(2)} KB`
                      : `${(uploadedFile.size / 1024).toFixed(2)} KB`
                    }
                  </p>
                </div>
                {!isProcessing && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    <CheckCircle className="w-5 h-5 text-neon-green" />
                  </motion.div>
                )}
              </div>
              <button
                onClick={clearMainFile}
                disabled={isProcessing}
                className="p-2 text-gray-500 hover:text-gray-300 hover:bg-obsidian-hover rounded transition-all disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {isProcessing && (
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Processing file...
              </div>
            )}
            
            {/* Batch file list */}
            {isBatchMode && uploadedFiles.length > 1 && (
              <div className="mt-3 pt-3 border-t border-obsidian-border">
                <p className="text-xs text-gray-500 mb-2">Files in batch:</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-400">
                      <File className="w-3 h-3" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-gray-600 font-mono">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
