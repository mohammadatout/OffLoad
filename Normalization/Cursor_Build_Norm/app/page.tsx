'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { ReferenceFileUpload } from '@/components/ReferenceFileUpload';
import { ColumnProfiler } from '@/components/ColumnProfiler';
import { ProcessingProgressBar } from '@/components/ProcessingProgressBar';
import { DataQualityScoreCard } from '@/components/DataQualityScoreCard';
import { ConfigurationManager } from '@/components/ConfigurationManager';
import { BatchFileUpload } from '@/components/BatchFileUpload';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { AccordionItem } from '@/components/ui/Accordion';
import { RefreshCw, Sparkles, Download, Loader2, XCircle, BookOpen, BarChart3, Files } from 'lucide-react';
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
  ProcessingProgress,
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
  saveLastConfiguration,
  loadLastConfiguration,
} from '@/lib/storage';
import { autoDetectColumns, formatTimestamp, validateFilename, getParsedFieldName } from '@/lib/utils';

type ViewMode = 'upload' | 'setup' | 'results';

const deriveDefaultSelectedColumns = (headers: string[]): string[] => {
  const prioritized = headers.filter((header) => {
    const lower = header.toLowerCase();
    return (
      lower.includes('name') ||
      lower.includes('company') ||
      lower.includes('entity')
    );
  });
  if (prioritized.length > 0) return prioritized;
  return headers.length > 0 ? [headers[0]] : [];
};

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [showSplash, setShowSplash] = useState(true);
  const [suggestedCompanyColumn, setSuggestedCompanyColumn] = useState('');
  const [isCompanySuggestionAcknowledged, setIsCompanySuggestionAcknowledged] = useState(false);
  
  // Data state
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [referenceData, setReferenceData] = useState<CityStateReference[]>([]);
  const [referenceMapping, setReferenceMapping] = useState<ReferenceColumnMapping | null>(null);
  const [processedData, setProcessedData] = useState<CSVRow[]>([]);
  const [cleanedData, setCleanedData] = useState<CSVRow[]>([]);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [referenceFileInfo, setReferenceFileInfo] = useState<{ name: string; size: number } | null>(null);
  
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
  const [dedupeAuditLookup, setDedupeAuditLookup] = useState<Record<number, CSVRow>>({});

  // Configuration state
  const [config, setConfig] = useState<ProcessingConfig>({
    uppercaseConversion: false,
    normalizationCleanup: true,
    addressParsingEnabled: false,
    addressColumns: [],
    addressDelimiter: ', ',
    cityStateValidationEnabled: false,
    cityColumn: '',
    stateColumn: '',
    companyNameCleaningEnabled: true,
    companyNameColumn: '',
    removeLegalEntities: true,
    replaceAbbreviations: true,
    // Phone processing
    phoneNormalizationEnabled: false,
    phoneColumns: [],
    phoneFormat: 'NATIONAL',
    // Website processing
    websiteNormalizationEnabled: false,
    websiteColumns: [],
    extractDomain: true,
    // Document link processing
    documentLinkColumns: [],
    extractDocumentInfo: false,
    // Columns
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
  
  // New feature states
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [showColumnProfiler, setShowColumnProfiler] = useState(false);
  const [selectedProfileColumn, setSelectedProfileColumn] = useState<string>('');
  const [showBatchMode, setShowBatchMode] = useState(false);

  const parsedFieldName = useMemo(
    () => getParsedFieldName(config.addressColumns),
    [config.addressColumns]
  );

  const derivedColumns = useMemo(() => {
    const base = fileData?.headers ? [...fileData.headers] : [];
    if (
      config.addressParsingEnabled &&
      config.addressColumns.length > 0 &&
      !base.includes(parsedFieldName)
    ) {
      base.push(parsedFieldName);
    }
    if (config.cityStateValidationEnabled) {
        if (config.cityColumn && !base.includes(`${config.cityColumn}_Verification`)) base.push(`${config.cityColumn}_Verification`);
        if (config.stateColumn && !base.includes(`${config.stateColumn}_Verification`)) base.push(`${config.stateColumn}_Verification`);
        if (!base.includes('City_State_Verification')) base.push('City_State_Verification');
    }
    return base;
  }, [fileData?.headers, config.addressParsingEnabled, config.addressColumns, parsedFieldName, config.cityStateValidationEnabled, config.cityColumn, config.stateColumn]);
  
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
    setDedupeAuditLookup({});
    
    const detected = autoDetectColumns(data.headers);
    const fallbackEntityColumn =
      detected.companyName ||
      data.headers.find((header) => header.toLowerCase().includes('name')) ||
      data.headers[0] ||
      '';
    setSuggestedCompanyColumn(fallbackEntityColumn);
    setIsCompanySuggestionAcknowledged(false);
    
    const defaultSelectedColumns = deriveDefaultSelectedColumns(data.headers);
    const defaultWordColumns = detected.companyName
      ? [detected.companyName]
      : data.headers.length > 0
        ? [data.headers[0]]
        : [];
    
    const defaultAddressColumns = [
      detected.address1,
      detected.address2,
    ].filter((col): col is string => Boolean(col));
    
    const newConfig: Partial<ProcessingConfig> = {
      selectedColumns: defaultSelectedColumns,
      outputColumns: data.headers,
      addressColumns: defaultAddressColumns,
      addressDelimiter: ', ',
      cityColumn: detected.city || '',
      stateColumn: detected.state || '',
      companyNameColumn: '',
      duplicateDetectionColumns: detected.companyName ? [detected.companyName] : [],
      wordFrequencyColumns: defaultWordColumns,
      removeLegalEntities: true,
      replaceAbbreviations: true,
    };
    
    setConfig(prev => ({ ...prev, ...newConfig }));
  };
  
  const handleReferenceFileUploaded = (
    data: Record<string, any>[],
    mapping: ReferenceColumnMapping,
    fileInfo?: { name: string; size: number }
  ) => {
    const transformedData: CityStateReference[] = data.map((row) => ({
      city: String(row[mapping.city] || ''),
      state: String(row[mapping.state] || ''),
      City_State: mapping.cityState ? String(row[mapping.cityState]) : `${row[mapping.city] || ''}, ${row[mapping.state] || ''}`,
    }));
    
    setReferenceData(transformedData);
    setReferenceMapping(mapping);
    setReferenceFileInfo(fileInfo ?? null);
  };
  
  const handleAddWordToExclusion = (word: string) => {
    if (!word) return;
    const updated = addLegalEntitiesBulk([word]);
    setExclusionList(updated);
  };

  const handleReferenceFileCleared = () => {
    setReferenceData([]);
    setReferenceMapping(null);
    setReferenceFileInfo(null);
  };
  
  const handleConfigChange = (newConfig: Partial<ProcessingConfig>) => {
    setConfig(prev => {
      const previousParsedFieldName = getParsedFieldName(prev.addressColumns);
      let updated: ProcessingConfig = { ...prev, ...newConfig };
      const nextParsedFieldName = getParsedFieldName(updated.addressColumns);

      if (
        newConfig.addressParsingEnabled !== undefined ||
        newConfig.addressColumns !== undefined ||
        newConfig.addressDelimiter !== undefined
      ) {
        const shouldIncludeParsedColumn =
          updated.addressParsingEnabled && updated.addressColumns.length > 0;

        let outputColumns = [...updated.outputColumns];

        if (previousParsedFieldName !== nextParsedFieldName) {
          outputColumns = outputColumns.filter(
            (col) => col !== previousParsedFieldName
          );
        }

        if (shouldIncludeParsedColumn) {
          if (!outputColumns.includes(nextParsedFieldName)) {
            outputColumns = [...outputColumns, nextParsedFieldName];
          }
        } else {
          outputColumns = outputColumns.filter(
            (col) => col !== nextParsedFieldName
          );
        }

        updated = { ...updated, outputColumns };
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
  
  const handleProgressUpdate = useCallback((progress: ProcessingProgress) => {
    setProcessingProgress(progress);
  }, []);

  const handleStartProcessing = async () => {
    if (!fileData || config.selectedColumns.length === 0) return;
    if (config.cityStateValidationEnabled && referenceData.length === 0) {
      setProcessingError('City & State validation requires a reference CSV. Please upload it below the toggle.');
      return;
    }
    
    setIsProcessing(true);
    setProcessingError('');
    setProcessingProgress(null);
    abortControllerRef.current = new AbortController();
    
    // Save configuration for recurring files
    saveLastConfiguration(config);
    
    // Use requestAnimationFrame for smoother UI updates
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          const abbreviations = loadAbbreviations();
          const legalEntities = loadLegalEntities();
          
          const { processedData: processed, cleanedData: cleaned, stats, dedupeAuditLookup: auditLookup } = processCSVData(
            fileData.data,
            config,
            legalEntities,
            abbreviations,
            referenceData,
            abortControllerRef.current?.signal,
            handleProgressUpdate
          );
          
          setProcessedData(processed);
          setCleanedData(cleaned);
          setProcessingStats(stats);
          setDedupeAuditLookup(auditLookup);
          const updatedTotals = updateCumulativeStats({
            rowsProcessed: stats.initialRows,
            companiesCleaned: stats.companiesProcessed,
            duplicatesRemoved: stats.duplicatesRemoved,
          });
          setCumulativeStats(updatedTotals);
          setViewMode('results');
          setIsProcessing(false);
          setProcessingProgress(null);
          abortControllerRef.current = null;
        } catch (error: any) {
          if (error.message === 'Processing cancelled') {
            setProcessingError('Processing was cancelled');
          } else {
            console.error('Processing error:', error);
            setProcessingError(`An error occurred during processing: ${error.message || 'Unknown error'}. Please check your configuration.`);
          }
          setIsProcessing(false);
          setProcessingProgress(null);
          abortControllerRef.current = null;
        }
      }, 100);
    });
  };
  
  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
      setProcessingError('Processing cancelled by user');
    }
  };
  
  const getDefaultConfig = (): ProcessingConfig => ({
    uppercaseConversion: false,
    normalizationCleanup: true,
    addressParsingEnabled: false,
    addressColumns: [],
    addressDelimiter: ', ',
    cityStateValidationEnabled: false,
    cityColumn: '',
    stateColumn: '',
    companyNameCleaningEnabled: true,
    companyNameColumn: '',
    removeLegalEntities: true,
    replaceAbbreviations: true,
    phoneNormalizationEnabled: false,
    phoneColumns: [],
    phoneFormat: 'NATIONAL',
    websiteNormalizationEnabled: false,
    websiteColumns: [],
    extractDomain: true,
    documentLinkColumns: [],
    extractDocumentInfo: false,
    selectedColumns: [],
    outputColumns: [],
    duplicateDetectionColumns: [],
    columnRenames: {},
    wordFrequencyEnabled: false,
    wordFrequencyColumns: [],
    excludeStopwords: false,
  });

  const handleLoadConfiguration = (loadedConfig: ProcessingConfig) => {
    setConfig(prev => ({
      ...loadedConfig,
      // Preserve column-specific settings that depend on current file
      selectedColumns: prev.selectedColumns,
      outputColumns: prev.outputColumns,
      companyNameColumn: prev.companyNameColumn,
    }));
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
      setReferenceFileInfo(null);
      setDedupeAuditLookup({});
      setSuggestedCompanyColumn('');
      setIsCompanySuggestionAcknowledged(false);
      setProcessingProgress(null);
      setShowBatchMode(false);
      handleReferenceFileCleared();
      setConfig(getDefaultConfig());
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
    setSuggestedCompanyColumn('');
    setIsCompanySuggestionAcknowledged(false);
    setDedupeAuditLookup({});
    handleReferenceFileCleared();
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
        undefined, // Include ALL columns (original + cleaned)
        dedupeAuditLookup
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
  const isReferenceFileMissing = config.cityStateValidationEnabled && referenceData.length === 0;

  const handleCompanyFieldSelection = (value: string) => {
    setConfig(prev => {
      const existingDuplicates = prev.duplicateDetectionColumns || [];
      let duplicateDetectionColumns = existingDuplicates;
      if (value) {
        if (existingDuplicates.length === 0) {
          duplicateDetectionColumns = [value];
        } else if (!existingDuplicates.includes(value)) {
          duplicateDetectionColumns = [value, ...existingDuplicates];
        }
      } else {
        duplicateDetectionColumns = existingDuplicates.filter(col => col !== prev.companyNameColumn);
      }
      return {
        ...prev,
        companyNameColumn: value,
        duplicateDetectionColumns,
      };
    });
    setIsCompanySuggestionAcknowledged(Boolean(value));
  };
  
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
                Welcome!
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
                    Cleaning, standardizing, and deduplicating entity data at speed.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
          
           <div className="mb-3 flex items-center justify-between gap-3 flex-shrink-0">
             <div className="flex gap-2">
               {fileData && viewMode === 'setup' && (
                 <>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setShowColumnProfiler(true)}
                   >
                     <BarChart3 className="w-4 h-4 mr-2" />
                     Column Profiler
                   </Button>
                   <Button
                     variant="outline"
                     size="sm"
                     onClick={() => setShowBatchMode(!showBatchMode)}
                   >
                     <Files className="w-4 h-4 mr-2" />
                     {showBatchMode ? 'Single File' : 'Batch Mode'}
                   </Button>
                 </>
               )}
             </div>
             <div className="flex items-center gap-3">
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
                {viewMode === 'setup' && (
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
                    {isProcessing ? (
                      <Button variant="danger" size="sm" onClick={handleCancelProcessing}>
                        <XCircle className="w-4 h-4 mr-2" /> Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleStartProcessing}
                        disabled={
                          !fileData ||
                          config.selectedColumns.length === 0 ||
                          isCompanyColumnMissing ||
                          isReferenceFileMissing
                        }
                      >
                        <Sparkles className="w-4 h-4 mr-2" /> Start Processing
                      </Button>
                    )}
                  </>
                )}
              {viewMode === 'results' && (
                <Button variant="outline" size="sm" onClick={handleStartNewTask}>
                  <RefreshCw className="w-4 h-4 mr-2" /> New Task
                </Button>
              )}
              </div>
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
                  renames={config.columnRenames}
                  onRenamesChange={(renames) => handleConfigChange({ columnRenames: renames })}
                  referenceUploadSlot={
                    config.cityStateValidationEnabled ? (
                      <ReferenceFileUpload
                        onReferenceFileUploaded={handleReferenceFileUploaded}
                        onReferenceFileCleared={handleReferenceFileCleared}
                        existingFileInfo={referenceFileInfo}
                        existingMapping={referenceMapping}
                        isRequired={config.cityStateValidationEnabled}
                      />
                    ) : null
                  }
                  referenceUploadMissing={isReferenceFileMissing}
                  showReferenceUploader={config.cityStateValidationEnabled}
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
                
                {/* Configuration Manager - Save/Load/Share */}
                <ConfigurationManager
                  currentConfig={config}
                  onLoadConfiguration={handleLoadConfiguration}
                />
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
                 
                 {/* Animated Processing Progress Bar */}
                 <ProcessingProgressBar
                   progress={processingProgress}
                   isProcessing={isProcessing}
                 />
                 
                 {/* View Mode: Upload (Empty State) */}
                 {viewMode === 'upload' && (
                     <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                        <FileUpload
                            onFileUploaded={handleFileUploaded}
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
                            <Alert className="bg-[#09304D] border-[#0051af] text-[#fbab2c]">
                                Please select the <strong>main Entity/Company Name field</strong> to enable full processing features.
                            </Alert>
                        )}
                        
                        {/* Data Quality Score Card */}
                        <DataQualityScoreCard
                          data={fileData.data}
                          headers={fileData.headers}
                          config={config}
                        />
                        
                        {/* Batch Mode */}
                        {showBatchMode && (
                          <BatchFileUpload
                            config={config}
                            onBatchComplete={(results) => {
                              console.log('Batch processing complete:', results);
                            }}
                          />
                        )}
                        
                        <PreviewTable 
                            data={fileData.data} 
                            headers={fileData.headers} 
                            title="Input Data Preview"
                            companyNameColumn={config.companyNameColumn}
                            onCompanyNameColumnChange={handleCompanyFieldSelection}
                            suggestedCompanyColumn={
                                !isCompanySuggestionAcknowledged ? suggestedCompanyColumn : ''
                            }
                            onSuggestedCompanyColumnApply={
                                !isCompanySuggestionAcknowledged && suggestedCompanyColumn
                                  ? () => handleCompanyFieldSelection(suggestedCompanyColumn)
                                  : undefined
                            }
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

                        <div className="flex justify-end pt-2">
                          {isProcessing ? (
                            <Button variant="danger" size="sm" onClick={handleCancelProcessing}>
                              <XCircle className="w-4 h-4 mr-2" /> Cancel
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={handleStartProcessing}
                              disabled={
                                !fileData ||
                                config.selectedColumns.length === 0 ||
                                isCompanyColumnMissing ||
                                isReferenceFileMissing
                              }
                            >
                              <Sparkles className="w-4 h-4 mr-2" /> Start Processing
                            </Button>
                          )}
                        </div>
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
      
      {/* Column Profiler Modal */}
      {fileData && (
        <ColumnProfiler
          data={fileData.data}
          headers={fileData.headers}
          isOpen={showColumnProfiler}
          onClose={() => setShowColumnProfiler(false)}
          selectedColumn={selectedProfileColumn}
          onColumnSelect={setSelectedProfileColumn}
        />
      )}
    </div>
  );
}
