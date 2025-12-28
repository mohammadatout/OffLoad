'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Upload, FileSpreadsheet, X, CheckCircle, Loader2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <Card variant="obsidian" className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded flex items-center justify-center bg-electric-cyan/10">
            <Upload className="w-5 h-5 text-electric-cyan" />
          </div>
          <div>
            <h3 className="text-base font-medium text-white">
              Upload CSV File
            </h3>
            <p className="text-xs text-gray-500">
              Drag & drop or click to browse
            </p>
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
                <FileSpreadsheet className="w-8 h-8 text-gray-500" />
              </motion.div>
              
              <p className="text-sm font-medium text-gray-300 mb-1">
                {isDragging ? 'Drop your CSV file here' : 'Drop CSV file here or click to browse'}
              </p>
              <p className="text-xs text-gray-600 mb-5">
                Supports files up to 100MB
              </p>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  mainFileInputRef.current?.click();
                }}
                className="px-5 py-2 text-sm font-medium text-obsidian-base bg-electric-cyan rounded hover:bg-electric-cyan-dark transition-all inline-flex items-center gap-2 electric-hover"
              >
                <Zap className="w-4 h-4" />
                Select File
              </button>
            </div>
            
            <input
              ref={mainFileInputRef}
              type="file"
              accept=".csv"
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
                  <FileSpreadsheet className="w-5 h-5 text-neon-green" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono">
                    {(uploadedFile.size / 1024).toFixed(2)} KB
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
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
