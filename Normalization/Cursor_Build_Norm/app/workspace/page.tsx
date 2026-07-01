'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ConfigurationPanel } from '@/components/ConfigurationPanel';
import { ResultsDisplay } from '@/components/ResultsDisplay';
import { StatsPanel } from '@/components/StatsPanel';
import { PreviewTable } from '@/components/PreviewTable';
import { ExportPanel } from '@/components/ExportPanel';
import { ReferenceFileUpload } from '@/components/ReferenceFileUpload';
import { ColumnProfiler } from '@/components/ColumnProfiler';
import { ProcessingProgressBar } from '@/components/ProcessingProgressBar';
import { DataQualityScoreCard } from '@/components/DataQualityScoreCard';
import { TopValuesSpotlight } from '@/components/TopValuesSpotlight';
import { ConfigurationManager } from '@/components/ConfigurationManager';
import { BatchFileUpload } from '@/components/BatchFileUpload';
import {
  RefreshCw,
  XCircle,
  Zap,
  Settings2,
  CheckCircle2,
  ChevronRight,
  Play,
  AlertCircle,
  Circle,
} from 'lucide-react';
import { motion } from 'framer-motion';
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
  loadCumulativeStats,
  updateCumulativeStats,
  CUMULATIVE_STATS_EVENT,
  saveLastConfiguration,
} from '@/lib/storage';
import { autoDetectColumns, formatMonthDayTag, validateFilename, getParsedFieldName, toSlugBaseName } from '@/lib/utils';

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
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [suggestedCompanyColumn, setSuggestedCompanyColumn] = useState('');
  const [isCompanySuggestionAcknowledged, setIsCompanySuggestionAcknowledged] = useState(false);

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [referenceData, setReferenceData] = useState<CityStateReference[]>([]);
  const [referenceMapping, setReferenceMapping] = useState<ReferenceColumnMapping | null>(null);
  const [processedData, setProcessedData] = useState<CSVRow[]>([]);
  const [cleanedData, setCleanedData] = useState<CSVRow[]>([]);
  const [processingStats, setProcessingStats] = useState<ProcessingStats | null>(null);
  const [referenceFileInfo, setReferenceFileInfo] = useState<{ name: string; size: number } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const [customFilename, setCustomFilename] = useState('cleaned_data');
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>({
    rowsProcessed: 0,
    companiesCleaned: 0,
    duplicatesRemoved: 0,
  });
  const [exclusionList, setExclusionList] = useState<string[]>([]);
  const [dedupeAuditLookup, setDedupeAuditLookup] = useState<Record<number, CSVRow>>({});

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

  const [isConfigVisibleOnResults, setIsConfigVisibleOnResults] = useState(true);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [showColumnProfiler, setShowColumnProfiler] = useState(false);
  const [selectedProfileColumn, setSelectedProfileColumn] = useState<string>('');
  const [showBatchMode, setShowBatchMode] = useState(false);
  const [excludedColumns, setExcludedColumns] = useState<string[]>([]);

  const handleColumnExcludeToggle = (column: string) => {
    setExcludedColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handleColumnRename = (originalName: string, newName: string) => {
    setConfig(prev => ({
      ...prev,
      columnRenames: {
        ...prev.columnRenames,
        [originalName]: newName
      }
    }));
  };

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
    if (typeof window === 'undefined') return;
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
    setCustomFilename(toSlugBaseName(data.fileName));
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

    saveLastConfiguration(config);

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
    setFileData(null);
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

    const dateTag = formatMonthDayTag();
    const cleanedFilename = `${filename}_Cleaned_${dateTag}.csv`;
    const comparisonFilename = `${filename}_Original_vs_Cleaned_${dateTag}.csv`;

    const baseColumns = config.outputColumns.length > 0
      ? config.outputColumns
      : (fileData?.headers || []);
    const cleanColumnsToExport = baseColumns.filter(col => !excludedColumns.includes(col));

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
        true
      );
      triggerDownload(csvContent, cleanedFilename);
    }

    if (comparison) {
      const comparisonRows = buildOriginalVsCleanedRows(
        fileData.data,
        cleanedData,
        undefined,
        dedupeAuditLookup
      );

      if (comparisonRows.length > 0) {
        const comparisonCsv = exportToCSV(
          comparisonRows,
          comparisonFilename,
          undefined,
          undefined,
          false
        );
        triggerDownload(comparisonCsv, comparisonFilename);
      }
    }
  };

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

  const isCompanyColumnMissing = !config.companyNameColumn;
  const isReferenceFileMissing = config.cityStateValidationEnabled && referenceData.length === 0;

  const steps = [
    { n: 1, label: 'Upload', done: viewMode !== 'upload', active: viewMode === 'upload' },
    { n: 2, label: 'Configure', done: viewMode === 'results', active: viewMode === 'setup' },
    { n: 3, label: 'Process', done: viewMode === 'results', active: false },
    { n: 4, label: 'Results', done: false, active: viewMode === 'results' },
  ];

  const activeCount = [
    config.normalizationCleanup,
    config.removeLegalEntities,
    config.replaceAbbreviations,
    config.uppercaseConversion,
    config.addressParsingEnabled,
    config.phoneNormalizationEnabled,
    config.websiteNormalizationEnabled,
    config.cityStateValidationEnabled,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-[calc(100vh-48px)]">
      {/* Step Indicator */}
      <div className="border-b border-app-border bg-app-bg flex-shrink-0">
        <div className="max-w-[1440px] mx-auto px-phi-3 py-phi-2 flex items-center justify-between">
          <div className="step-indicator">
            {steps.map((s, i) => (
              <React.Fragment key={s.n}>
                <div className={`step-item ${s.active ? 'active' : s.done ? 'done' : 'pending'}`}>
                  {s.done ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className={`step-number ${s.active ? 'active' : ''}`}>{s.n}</span>
                  )}
                  <span>{s.label}</span>
                </div>
                {i < 3 && <ChevronRight className="w-3 h-3 text-app-subtle" />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex items-center gap-phi-2">
            {viewMode !== 'upload' && (
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="text-[11px] text-app-muted hover:text-app-text transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            )}
            {viewMode === 'results' && (
              <button
                onClick={handleStartNewTask}
                className="text-[11px] text-app-muted hover:text-app-text transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                New Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="max-w-[1440px] mx-auto px-phi-3 py-phi-3 flex-1 flex flex-col min-h-0 w-full">
          {/* Upload View */}
          {viewMode === 'upload' && (
            <div className="overflow-y-auto flex-1">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <FileUpload
                  onFileUploaded={handleFileUploaded}
                  showBatchMode={showBatchMode}
                  onBatchModeChange={setShowBatchMode}
                />
              </motion.div>
            </div>
          )}

          {/* Setup View — two-column layout */}
          {viewMode === 'setup' && fileData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-[268px_1fr] gap-phi-3 flex-1 min-h-0 h-full">

              {/* Left: Config Panel */}
              <aside className="space-y-phi-1 overflow-y-auto h-full pr-1 flex flex-col">
                <div className="flex items-center justify-between mb-phi-2 shrink-0">
                  <h2 className="text-[11px] font-mono uppercase tracking-wider text-app-muted">
                    Configuration
                  </h2>
                  <span className="text-[10px] font-mono text-app-accent bg-app-accent/10 px-1.5 py-0.5 rounded">
                    {activeCount} active
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-phi-1 pr-1 pb-4">
                  <ConfigurationPanel
                    compact
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

                  <ConfigurationManager
                    currentConfig={config}
                    onLoadConfiguration={handleLoadConfiguration}
                  />
                </div>

                {/* Run button */}
                <button
                  onClick={isProcessing ? handleCancelProcessing : handleStartProcessing}
                  disabled={!isProcessing && (!fileData || config.selectedColumns.length === 0 || isCompanyColumnMissing || isReferenceFileMissing)}
                  className={`btn-accent mt-phi-2 shrink-0 ${isProcessing ? '!bg-red-500 hover:!bg-red-600' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isProcessing ? (
                    <><XCircle className="w-3.5 h-3.5" /> Cancel</>
                  ) : (
                    <><Play className="w-3.5 h-3.5 fill-current" /> Run Normalization</>
                  )}
                </button>
              </aside>

              {/* Right: Work Area */}
              <section className="space-y-phi-2 overflow-y-auto h-full pr-1 pb-4">
                {/* Processing Error */}
                {processingError && (
                  <div className="flex items-start gap-phi-2 px-phi-2 py-phi-2 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 text-[12px]">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{processingError}</span>
                  </div>
                )}

                {/* Processing Progress */}
                <ProcessingProgressBar
                  progress={processingProgress}
                  isProcessing={isProcessing}
                />

                {/* Company column warning */}
                {isCompanyColumnMissing && (
                  <div className="callout-warn">
                    <AlertCircle className="w-4 h-4 text-white mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <div className="text-[12px] text-white">
                        Select the <span className="font-medium">main entity field</span> to enable processing.
                      </div>
                      {suggestedCompanyColumn && !isCompanySuggestionAcknowledged && (
                        <div className="text-[11px] text-white/85 mt-0.5">
                          We suggest <span className="font-mono text-[#74bf4b]">{suggestedCompanyColumn}</span>.
                        </div>
                      )}
                    </div>
                    {suggestedCompanyColumn && !isCompanySuggestionAcknowledged && (
                      <button
                        onClick={() => handleCompanyFieldSelection(suggestedCompanyColumn)}
                        className="text-[11px] text-[#74bf4b] hover:underline shrink-0"
                      >
                        Use suggestion →
                      </button>
                    )}
                  </div>
                )}

                {/* Quality + Top values (compact row) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-phi-2 items-stretch">
                  <DataQualityScoreCard
                    compact
                    data={fileData.data}
                    headers={fileData.headers}
                    config={config}
                  />
                  <TopValuesSpotlight data={fileData.data} headers={fileData.headers} />
                </div>

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
                  columnRenames={config.columnRenames}
                  onColumnRename={handleColumnRename}
                  excludedColumns={excludedColumns}
                  onColumnExcludeToggle={handleColumnExcludeToggle}
                  onOpenColumnProfiler={() => {
                    setSelectedProfileColumn(
                      config.companyNameColumn || fileData.headers[0] || ''
                    );
                    setShowColumnProfiler(true);
                  }}
                />

                <StatsPanel
                  fileData={fileData}
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

                {/* Export panel */}
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

                {/* Footer hint */}
                <div className="text-[11px] text-app-subtle flex items-center gap-phi-1 pb-phi-2">
                  <Circle className="w-2 h-2 fill-current" />
                  Configuration auto-saves. Click <span className="font-mono text-app-muted">Run Normalization</span> when ready.
                </div>
              </section>
            </motion.div>
          )}

          {/* Results View */}
          {viewMode === 'results' && processingStats && (
            <div className="overflow-y-auto flex-1 h-full w-full pr-1 pb-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-phi-3">
                {/* Export panel at top of results */}
                <ExportPanel
                  customFilename={customFilename}
                  onFilenameChange={setCustomFilename}
                  onExportClean={() => handleExport({ enhanced: true, comparison: false })}
                  onExportAudit={() => handleExport({ enhanced: false, comparison: true })}
                  isProcessing={isProcessing}
                  hasResults={processedData.length > 0}
                />

                <ResultsDisplay
                  stats={processingStats}
                  originalData={fileData?.data || []}
                  processedData={processedData}
                  cumulativeStats={cumulativeStats}
                />
              </motion.div>
            </div>
          )}
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
