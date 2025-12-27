// Core Data Types
export interface CSVRow {
  [key: string]: string | number;
}

export interface ColumnInfo {
  name: string;
  type: 'text' | 'email' | 'website' | 'address' | 'other';
}

export interface ProcessingConfig {
  // Text Processing
  uppercaseConversion: boolean;
  normalizationCleanup: boolean;
  
  // Address Parsing
  addressParsingEnabled: boolean;
  address1Column: string;
  address2Column: string;
  
  // City & State Validation
  cityStateValidationEnabled: boolean;
  cityColumn: string;
  stateColumn: string;
  
  // Company Name Cleaning
  companyNameCleaningEnabled: boolean;
  companyNameColumn: string;
  removeLegalEntities: boolean;
  replaceAbbreviations: boolean;
  
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

