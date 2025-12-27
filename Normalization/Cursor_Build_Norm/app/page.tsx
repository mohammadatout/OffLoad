'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import clsx from 'clsx';
import { Sidebar } from '@/components/Sidebar';
import { FileUpload } from '@/components/FileUpload';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { AbbreviationManager } from '@/components/AbbreviationManager';
import { LegalEntitiesManager } from '@/components/LegalEntitiesManager';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { StatsPanel } from '@/components/StatsPanel';
import { PreviewTable } from '@/components/PreviewTable';
import { ExportPanel } from '@/components/ExportPanel';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { AccordionItem } from '@/components/ui/Accordion';
import { RefreshCw, Sparkles, Download, Loader2, XCircle, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { 
  FileData, 
  ProcessingConfig, 
  ProcessingStats, 
  CSVRow, 
  CityStateReference,
  ReferenceColumnMapping,
  CumulativeStats,
} from '@/lib/types';
import { processCSVData, exportToCSV, buildOriginalVsCleanedRows } from '@/lib/dataProcessing';
import { 
  loadAbbreviations, 
  loadLegalEntities, 
  addLegalEntitiesBulk, 
  LEGAL_ENTITIES_EVENT,
  loadTheme,
  saveTheme,
  loadCumulativeStats,
  updateCumulativeStats,
  CUMULATIVE_STATS_EVENT,
} from '@/lib/storage';
import { autoDetectColumns, formatTimestamp, validateFilename } from '@/lib/utils';

type ViewMode = 'upload' | 'setup' | 'results';

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [showSplash, setShowSplash] = useState(true);
  
  // Data state
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [referenceData, setReferenceData] = useState<CityStateReference[]>([]);
  const [referenceMapping, setReferenceMapping] = useState<ReferenceColumnMapping | null>(null);
  const [processedData, setProcessedData] = useState<CSVRow[]>([]);
  const [cleanedData, setCleanedData] = useState<CSVRow[]>([]);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Custom filename state
  const [customFilename, setCustomFilename] = useState('cleaned_data');
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>({
    rowsProcessed: 0,
    companiesCleaned: 0,
    duplicatesRemoved: 0,
  });
  const [exclusionList, setExclusionList] = useState<string[]>([]);

  // Configuration state
  const [config, setConfig] = useState<ProcessingConfig>({
    uppercaseConversion: false,
    normalizationCleanup: true,
    addressParsingEnabled: false,
    address1Column: '',
    address2Column: '',
    cityStateValidationEnabled: false,
    cityColumn: '',
    stateColumn: '',
    companyNameCleaningEnabled: false,
    companyNameColumn: '',
    removeLegalEntities: true,
    replaceAbbreviations: true,
    selectedColumns: [],
    outputColumns: [],
    duplicateDetectionColumns: [],
    columnRenames: {},
    wordFrequencyEnabled: false,
    wordFrequencyColumns: [],
    excludeStopwords: false,
  });

  // Dictionaries Accordion State
  const [dictionariesOpen, setDictionariesOpen] = useState(false);
  const [isConfigVisibleOnResults, setIsConfigVisibleOnResults] = useState(true);

  const derivedColumns = useMemo(() => {
    const base = fileData?.headers ? [...fileData.headers] : [];
    if (config.addressParsingEnabled && !base.includes('Full_Address')) {
      base.push('Full_Address');
    }
    if (config.cityStateValidationEnabled) {
        if (config.cityColumn && !base.includes(`${config.cityColumn}_Verification`)) base.push(`${config.cityColumn}_Verification`);
        if (config.stateColumn && !base.includes(`${config.stateColumn}_Verification`)) base.push(`${config.stateColumn}_Verification`);
        if (!base.includes('City_State_Verification')) base.push('City_State_Verification');
    }
    return base;
  }, [fileData?.headers, config.addressParsingEnabled, config.cityStateValidationEnabled, config.cityColumn, config.stateColumn]);
  
  // Apply theme changes
  useEffect(() => {
    if (!config.companyNameColumn) return;
    setConfig(prev => {
      if (prev.wordFrequencyColumns.includes(config.companyNameColumn)) {
        return prev;
      }
      return {
        ...prev,
        wordFrequencyColumns: [config.companyNameColumn],
      };
    });
  }, [config.companyNameColumn]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    if (typeof window !== 'undefined') {
      saveTheme(isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedTheme = loadTheme();
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
    
    setExclusionList(loadLegalEntities());
    setCumulativeStats(loadCumulativeStats());
    
    const exclusionHandler = () => setExclusionList(loadLegalEntities());
    const cumulativeHandler = () => setCumulativeStats(loadCumulativeStats());
    
    window.addEventListener(LEGAL_ENTITIES_EVENT, exclusionHandler);
    window.addEventListener(CUMULATIVE_STATS_EVENT, cumulativeHandler);
    
    return () => {
      window.removeEventListener(LEGAL_ENTITIES_EVENT, exclusionHandler);
      window.removeEventListener(CUMULATIVE_STATS_EVENT, cumulativeHandler);
    };
  }, []);
  
  const handleFileUploaded = (data: FileData) => {
    setFileData(data);
    setProcessedData([]);
    setCleanedData([]);
    setProcessingStats(null);
    setProcessingError('');
    setViewMode('setup');
    
    const detected = autoDetectColumns(data.headers);
    
    const defaultWordColumns = detected.companyName
      ? [detected.companyName]
      : data.headers.length > 0
        ? [data.headers[0]]
        : [];
    
    const newConfig: Partial<ProcessingConfig> = {
      selectedColumns: data.headers,
      outputColumns: data.headers,
      address1Column: detected.address1 || '',
      address2Column: detected.address2 || '',
      cityColumn: detected.city || '',
      stateColumn: detected.state || '',
      companyNameColumn: detected.companyName || '',
      wordFrequencyColumns: defaultWordColumns,
    };
    
    setConfig(prev => ({ ...prev, ...newConfig }));
  };
  
  const handleReferenceFileUploaded = (data: Record<string, any>[], mapping: ReferenceColumnMapping) => {
    const transformedData: CityStateReference[] = data.map((row) => ({
      city: String(row[mapping.city] || ''),
      state: String(row[mapping.state] || ''),
      City_State: mapping.cityState ? String(row[mapping.cityState]) : `${row[mapping.city] || ''}, ${row[mapping.state] || ''}`,
    }));
    
    setReferenceData(transformedData);
    setReferenceMapping(mapping);
  };
  
  const handleAddWordToExclusion = (word: string) => {
    if (!word) return;
    const updated = addLegalEntitiesBulk([word]);
    setExclusionList(updated);
  };
  
  const handleConfigChange = (newConfig: Partial<ProcessingConfig>) => {
    setConfig(prev => {
      let updated: ProcessingConfig = { ...prev, ...newConfig };
      
      if (newConfig.addressParsingEnabled !== undefined) {
        const hasFull = updated.outputColumns.includes('Full_Address');
        if (newConfig.addressParsingEnabled && !hasFull) {
          updated = { ...updated, outputColumns: [...updated.outputColumns, 'Full_Address'] };
        } else if (!newConfig.addressParsingEnabled && hasFull) {
          updated = { ...updated, outputColumns: updated.outputColumns.filter(col => col !== 'Full_Address') };
        }
      }

      if (newConfig.cityStateValidationEnabled !== undefined || newConfig.cityColumn !== undefined || newConfig.stateColumn !== undefined) {
        if (updated.cityStateValidationEnabled) {
            const colsToAdd = [];
            if (updated.cityColumn && !updated.outputColumns.includes(`${updated.cityColumn}_Verification`)) {
                colsToAdd.push(`${updated.cityColumn}_Verification`);
            }
            if (updated.stateColumn && !updated.outputColumns.includes(`${updated.stateColumn}_Verification`)) {
                colsToAdd.push(`${updated.stateColumn}_Verification`);
            }
            if (!updated.outputColumns.includes('City_State_Verification')) {
                colsToAdd.push('City_State_Verification');
            }
            
            if (colsToAdd.length > 0) {
                updated = { ...updated, outputColumns: [...updated.outputColumns, ...colsToAdd] };
            }
        } else {
            updated = {
                ...updated,
                outputColumns: updated.outputColumns.filter(col => 
                    !col.endsWith('_Verification') && col !== 'City_State_Verification'
                )
            };
        }
      }

      return updated;
    });
  };
  
  const handleStartProcessing = async () => {
    if (!fileData || config.selectedColumns.length === 0) return;
    
    setIsProcessing(true);
    setProcessingError('');
    abortControllerRef.current = new AbortController();
    
    setTimeout(() => {
      try {
        const abbreviations = loadAbbreviations();
        const legalEntities = loadLegalEntities();
        
        const { processedData: processed, cleanedData: cleaned, stats } = processCSVData(
          fileData.data,
          config,
          legalEntities,
          abbreviations,
          referenceData,
          abortControllerRef.current?.signal
        );
        
        setProcessedData(processed);
        setCleanedData(cleaned);
        setProcessingStats(stats);
        const updatedTotals = updateCumulativeStats({
          rowsProcessed: stats.initialRows,
          companiesCleaned: stats.companiesProcessed,
          duplicatesRemoved: stats.duplicatesRemoved,
        });
        setCumulativeStats(updatedTotals);
        setViewMode('results');
        setIsProcessing(false);
        abortControllerRef.current = null;
      } catch (error: any) {
        if (error.message === 'Processing cancelled') {
          setProcessingError('Processing was cancelled');
        } else {
          console.error('Processing error:', error);
          setProcessingError(`An error occurred during processing: ${error.message || 'Unknown error'}. Please check your configuration.`);
        }
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
    }, 500);
  };
  
  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setProcessingError('Processing cancelled by user');
    }
  };
  
  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings? This will clear all data.')) {
      setFileData(null);
      setReferenceData([]);
      setReferenceMapping(null);
      setProcessedData([]);
      setCleanedData([]);
      setProcessingStats(null);
      setProcessingError('');
      setCustomFilename('cleaned_data');
      setConfig({
        uppercaseConversion: false,
        normalizationCleanup: true,
        addressParsingEnabled: false,
        address1Column: '',
        address2Column: '',
        cityStateValidationEnabled: false,
        cityColumn: '',
        stateColumn: '',
        companyNameCleaningEnabled: false,
        companyNameColumn: '',
        removeLegalEntities: true,
        replaceAbbreviations: true,
        selectedColumns: [],
        outputColumns: [],
        duplicateDetectionColumns: [],
        columnRenames: {},
        wordFrequencyEnabled: false,
        wordFrequencyColumns: [],
        excludeStopwords: false,
      });
      setViewMode('upload');
    }
  };
  
  const handleStartNewTask = () => {
    setProcessedData([]);
    setCleanedData([]);
    setProcessingStats(null);
    setProcessingError('');
    setCustomFilename('cleaned_data');
    setViewMode('upload');
    setFileData(null); // Also clear file data to force new upload
  };
  
  const handleExport = ({ enhanced, comparison }: { enhanced: boolean; comparison: boolean }) => {
    if (!fileData || processedData.length === 0) return;
    if (!enhanced && !comparison) return;
    
    let filename = customFilename.trim();
    if (!filename || !validateFilename(filename)) {
      filename = 'cleaned_data';
    }
    
    const timestamp = formatTimestamp();
    const cleanedFilename = `${filename}_Cleaned_${timestamp}.csv`;
    const comparisonFilename = `${filename}_Original_vs_Cleaned_${timestamp}.csv`;
    
    const cleanColumnsToExport = config.outputColumns.length > 0 
      ? config.outputColumns 
      : (fileData?.headers || []);
    
    const triggerDownload = (csvContent: string, downloadName: string) => {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', downloadName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    
    if (enhanced) {
      const csvContent = exportToCSV(
        processedData,
        cleanedFilename,
        cleanColumnsToExport,
        config.columnRenames,
        true // Exclude verification columns for Cleaned file
      );
      triggerDownload(csvContent, cleanedFilename);
    }
    
    if (comparison) {
      const comparisonRows = buildOriginalVsCleanedRows(
        fileData.data,
        cleanedData, // Use cleanedData (Normalized but NOT Deduped/Merged)
        undefined // Include ALL columns (original + cleaned)
      );
      
      if (comparisonRows.length > 0) {
        const comparisonCsv = exportToCSV(
            comparisonRows, 
            comparisonFilename, 
            undefined, // export all comparison columns
            undefined, 
            false // Include verification columns
        );
        triggerDownload(comparisonCsv, comparisonFilename);
      }
    }
  };
  
  const handleNavigate = (section: string) => {
    if (section === 'dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'configuration') {
      const configElement = document.getElementById('configuration');
      if (configElement) {
        configElement.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };
  
  const isCompanyColumnMissing = !config.companyNameColumn;
  
  useEffect(() => {
    if (viewMode === 'results') {
      setIsConfigVisibleOnResults(false);
    } else {
      setIsConfigVisibleOnResults(true);
    }
  }, [viewMode]);

  if (showSplash) {
    return (
      <div className="flex min-h-screen bg-dark-bg">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark-bg/90"
        >
          <div className="relative w-full h-full">
            <Image
              src="/images/Animated GIF.gif"
              alt="Cisco Data Network"
              fill
              priority
              className="object-cover opacity-50"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7 }}
              className="relative z-10 flex flex-col items-center justify-center h-full text-center"
            >
              <p className="text-5xl md:text-6xl font-bold text-white tracking-wide drop-shadow-lg mb-4">
                Welcom!
              </p>
              <p className="text-lg md:text-2xl text-white/80 max-w-2xl">
                EntityMatch Pro is initializing your data wrangling workspace.
              </p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-light-bg dark:bg-dark-bg">
      <Sidebar
        totalRecords={fileData?.data.length || 0}
        totalColumns={fileData?.headers.length || 0}
        columnInfo={fileData?.columnInfo || []}
        cumulativeStats={cumulativeStats}
        isDarkMode={isDarkMode}
        onThemeToggle={() => setIsDarkMode(!isDarkMode)}
        onNavigate={handleNavigate}
      />
      
      <main className="flex-1 p-4 flex flex-col overflow-hidden min-h-screen">
          {/* Header */}
          <div className="mb-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative h-48 md:h-56 rounded-2xl overflow-hidden shadow-lg"
            >
              <Image
                src="/images/Animated GIF.gif"
                alt="Cisco Data Linking Banner"
                fill
                priority
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-dark-bg/90 via-dark-bg/40 to-transparent"></div>
              <div className="relative z-10 h-full px-6 py-6 flex items-center justify-between">
                <div className="text-white">
                  <p className="uppercase text-xs tracking-[0.35em] text-cisco-green mb-2">EntityMatch Pro</p>
                  <h1 className="text-3xl md:text-4xl font-bold">Data Wrangling Studio</h1>
                  <p className="text-sm md:text-base text-white/80">
                    Linking scattered records into a single source of truth.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
          
           <div className="mb-3 flex items-center justify-end gap-3 flex-shrink-0">
             {viewMode === 'results' && (
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => setIsConfigVisibleOnResults(prev => !prev)}
               >
                 {isConfigVisibleOnResults ? 'Hide Configuration' : 'Show Configuration'}
               </Button>
             )}
             <div className="flex gap-3">
               {(viewMode === 'setup' || viewMode === 'results') && (
                   <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReset}
                      disabled={isProcessing}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                    
                    {viewMode === 'setup' && (
                        isProcessing ? (
                            <Button variant="danger" size="sm" onClick={handleCancelProcessing}>
                                <XCircle className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                        ) : (
                            <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={handleStartProcessing}
                                disabled={!fileData || config.selectedColumns.length === 0 || isCompanyColumnMissing}
                            >
                                <Sparkles className="w-4 h-4 mr-2" /> Start Processing
                            </Button>
                        )
                    )}

                    {viewMode === 'results' && (
                        <Button variant="outline" size="sm" onClick={handleStartNewTask}>
                            <RefreshCw className="w-4 h-4 mr-2" /> New Task
                        </Button>
                    )}
                   </>
               )}
            </div>
          </div>
          
          {/* Main Grid */}
           <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden">
             {/* Left: Configuration */}
              <div
                className={clsx(
                  'col-span-12 overflow-y-auto pr-2 space-y-4 transition-all duration-200',
                  {
                    'lg:col-span-4': isConfigVisibleOnResults || viewMode !== 'results',
                    'hidden lg:hidden': viewMode === 'results' && !isConfigVisibleOnResults,
                  }
                )}
              >
                <ConfigurationPanel
                  config={config}
                  onConfigChange={handleConfigChange}
                  availableColumns={derivedColumns}
                  hasReferenceFile={referenceData.length > 0}
                  renames={config.columnRenames}
                  onRenamesChange={(renames) => handleConfigChange({ columnRenames: renames })}
                />
                
                {/* Dictionaries Accordion */}
                <AccordionItem 
                    title="Dictionaries & Lists" 
                    icon={<BookOpen className="w-5 h-5 text-indigo-500" />}
                    isOpen={dictionariesOpen}
                    onToggle={() => setDictionariesOpen(!dictionariesOpen)}
                >
                    <div className="space-y-6 pt-2">
                        <AbbreviationManager />
                        <LegalEntitiesManager />
                    </div>
                </AccordionItem>
             </div>
             
             {/* Right: Content */}
              <div
                className={clsx(
                  'col-span-12 overflow-y-auto space-y-6',
                  isConfigVisibleOnResults || viewMode !== 'results'
                    ? 'lg:col-span-8'
                    : 'lg:col-span-12'
                )}
              >
                 {/* Processing Error */}
                 {processingError && (
                    <Alert variant="danger">
                        {processingError}
                    </Alert>
                 )}
                 
                 {/* Processing State */}
                 {isProcessing && (
                     <Alert variant="info">
                        <div className="flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-accent-blue" />
                            <span className="font-medium">Processing data...</span>
                            <span className="text-sm opacity-80">Standardizing addresses, validating locations, and deduplicating records.</span>
                        </div>
                    </Alert>
                 )}
                 
                 {/* View Mode: Upload (Empty State) */}
                 {viewMode === 'upload' && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        <FileUpload
                            onFileUploaded={handleFileUploaded}
                            onReferenceFileUploaded={handleReferenceFileUploaded}
                        />
                     </motion.div>
                 )}
                 
                 {/* Export Panel */}
                 {processedData.length > 0 && (
                    <ExportPanel
                      customFilename={customFilename}
                      onFilenameChange={setCustomFilename}
                      onExportClean={() => handleExport({ enhanced: true, comparison: false })}
                      onExportAudit={() => handleExport({ enhanced: false, comparison: true })}
                      isProcessing={isProcessing}
                      hasResults={processedData.length > 0}
                    />
                 )}
                 
                 {/* View Mode: Setup (Live Preview + Stats) */}
                 {viewMode === 'setup' && fileData && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        {isCompanyColumnMissing && (
                            <Alert variant="warning">
                                Please select a <strong>Company Name Column</strong> in the Configuration panel to enable full processing features.
                            </Alert>
                        )}
                        
                        <PreviewTable 
                            data={fileData.data} 
                            headers={fileData.headers} 
                            title="Input Data Preview"
                        />
                        
                        <StatsPanel
                            fileData={fileData}
                            processedData={processedData}
                            stats={processingStats}
                            wordFrequencyConfig={{
                                columns: derivedColumns,
                                selectedColumns: config.wordFrequencyColumns,
                                excludeStopwords: config.excludeStopwords,
                                existingExclusions: exclusionList
                            }}
                            onWordFrequencyChange={{
                                onColumnSelectionChange: (cols) => handleConfigChange({ wordFrequencyColumns: cols }),
                                onExcludeStopwordsChange: (exclude) => handleConfigChange({ excludeStopwords: exclude }),
                                onAddToExclusion: handleAddWordToExclusion
                            }}
                        />
                     </motion.div>
                 )}
                 
                 {/* View Mode: Results */}
                 {viewMode === 'results' && processingStats && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                         <ResultsDisplay
                            stats={processingStats}
                            originalData={fileData?.data || []}
                            processedData={processedData}
                            cumulativeStats={cumulativeStats}
                         />
                     </motion.div>
                 )}
             </div>
          </div>
      </main>
    </div>
  );
}
