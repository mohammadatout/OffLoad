// Core Data Types
export interface CSVRow {
  [key: string]: string | number;
}

export interface ColumnInfo {
  name: string;
  type: 'text' | 'email' | 'website' | 'address' | 'phone' | 'document_link' | 'other';
}

// Column Profiling Statistics
export interface ColumnProfile {
  name: string;
  type: ColumnInfo['type'];
  totalCount: number;
  uniqueCount: number;
  nullCount: number;
  emptyCount: number;
  completeness: number; // percentage
  topValues: { value: string; count: number }[];
  minLength: number;
  maxLength: number;
  avgLength: number;
  patterns?: { pattern: string; count: number }[]; // for phone, email patterns
}

// Processing Progress
export interface ProcessingProgress {
  phase: 'parsing' | 'cleaning' | 'validating' | 'deduplicating' | 'complete';
  currentRow: number;
  totalRows: number;
  percentage: number;
  estimatedTimeRemaining: number; // in seconds
  startTime: number;
}

// Saved Configuration for team sharing
export interface SavedConfiguration {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  config: ProcessingConfig;
  columnMappings?: { [key: string]: string }; // Remember column associations
}

// Data Quality Score
export interface DataQualityScore {
  overall: number; // 0-100
  completeness: number; // % of non-null values
  consistency: number; // % of values matching expected patterns
  validity: number; // % of values passing validation rules
  uniqueness: number; // % of unique values vs total
  columnScores: {
    column: string;
    completeness: number;
    validity: number;
    issues: string[];
  }[];
}

// Multi-file Processing
export interface BatchFileInfo {
  id: string;
  file: File;
  fileName: string;
  size: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  rowCount?: number;
  error?: string;
  processedData?: CSVRow[];
  stats?: ProcessingStats;
}

export interface ProcessingConfig {
  // Text Processing
  uppercaseConversion: boolean;
  normalizationCleanup: boolean;
  
  // Parsing
  addressParsingEnabled: boolean;
  addressColumns: string[];
  addressDelimiter: string;
  
  // City & State Validation
  cityStateValidationEnabled: boolean;
  cityColumn: string;
  stateColumn: string;
  
  // Company Name Cleaning
  companyNameCleaningEnabled: boolean;
  companyNameColumn: string;
  removeLegalEntities: boolean;
  replaceAbbreviations: boolean;
  
  // Phone Number Processing
  phoneNormalizationEnabled: boolean;
  phoneColumns: string[];
  phoneFormat: 'E164' | 'NATIONAL' | 'INTERNATIONAL' | 'DOTS' | 'DASHES'; // E164: +12025551234, NATIONAL: (202) 555-1234
  
  // URL/Website Processing
  websiteNormalizationEnabled: boolean;
  websiteColumns: string[];
  extractDomain: boolean;
  
  // Document Link Processing
  documentLinkColumns: string[];
  extractDocumentInfo: boolean;
  
  // Columns to normalize
  selectedColumns: string[];
  
  // Columns to include in output
  outputColumns: string[];
  
  // Duplicate Detection
  duplicateDetectionColumns: string[];
  
  // Column Renaming
  columnRenames: { [originalName: string]: string };
  
  // Word Frequency
  wordFrequencyEnabled: boolean;
  wordFrequencyColumns: string[];
  excludeStopwords: boolean;
}

export interface ProcessingStats {
  initialRows: number;
  totalRows: number;
  totalColumns: number;
  columnsProcessed: number;
  totalChanges: number;
  duplicatesRemoved: number;
  companiesProcessed: number;
  rowsGrouped: number;
  invalidCities: number;
  invalidCityStates: number;
  noDataCities: number;
  noDataCityStates: number;
}

export interface Abbreviation {
  id: string;
  companyName: string;
  normalizedCompanyName: string;
  abbreviations: string[]; // Array of abbreviations
  createdAt: Date;
  updatedAt: Date;
}

export interface CityStateReference {
  city: string;
  state: string;
  City_State: string;
}

export interface FileData {
  fileName: string;
  headers: string[];
  data: CSVRow[];
  columnInfo: ColumnInfo[];
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface ReferenceColumnMapping {
  city: string;
  state: string;
  cityState: string;
}

export interface CumulativeStats {
  rowsProcessed: number;
  companiesCleaned: number;
  duplicatesRemoved: number;
}

export type DedupeAuditLookup = Record<number, CSVRow>;

