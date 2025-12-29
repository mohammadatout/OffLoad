import { CSVRow, ProcessingConfig, ProcessingStats, CityStateReference, Abbreviation, WordFrequency, DedupeAuditLookup, ColumnProfile, DataQualityScore, ProcessingProgress } from './types';
import { extractHyperlink, extractDomainFromUrl, tokenizeText, escapeRegExp, getParsedFieldName } from './utils';

const ROW_INDEX_KEY = '__row_index__';

// ============================================
// PRE-COMPILED REGEX PATTERNS (Performance optimization for 100K+ rows)
// ============================================

// State abbreviation mapping
const STATE_ABBREVIATIONS: { [key: string]: string } = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY'
};

const ADDRESS_COLUMN_HINTS = [
  'address',
  'street',
  'road',
  'rd',
  'avenue',
  'ave',
  'city',
  'state',
  'zip',
  'postal',
  'location',
  'suite',
  'unit',
  'building',
  'floor'
];

// Pre-compiled address replacement patterns (major performance boost)
const ADDRESS_REPLACEMENTS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bstreet\b/gi, replacement: 'ST' },
  { pattern: /\bst\b/gi, replacement: 'ST' },
  { pattern: /\bavenue\b/gi, replacement: 'AVE' },
  { pattern: /\bave\b/gi, replacement: 'AVE' },
  { pattern: /\broad\b/gi, replacement: 'RD' },
  { pattern: /\brd\b/gi, replacement: 'RD' },
  { pattern: /\bboulevard\b/gi, replacement: 'BLVD' },
  { pattern: /\bblvd\b/gi, replacement: 'BLVD' },
  { pattern: /\bdrive\b/gi, replacement: 'DR' },
  { pattern: /\bdr\b/gi, replacement: 'DR' },
  { pattern: /\blane\b/gi, replacement: 'LN' },
  { pattern: /\bln\b/gi, replacement: 'LN' },
  { pattern: /\bcourt\b/gi, replacement: 'CT' },
  { pattern: /\bct\b/gi, replacement: 'CT' },
  { pattern: /\bhighway\b/gi, replacement: 'HWY' },
  { pattern: /\bhwy\b/gi, replacement: 'HWY' },
  { pattern: /\bparkway\b/gi, replacement: 'PKWY' },
  { pattern: /\bpkwy\b/gi, replacement: 'PKWY' },
  { pattern: /\bsuite\b/gi, replacement: 'STE' },
  { pattern: /\bste\b/gi, replacement: 'STE' },
  { pattern: /\bapartment\b/gi, replacement: 'APT' },
  { pattern: /\bapt\b/gi, replacement: 'APT' },
  { pattern: /\bfloor\b/gi, replacement: 'FL' },
  { pattern: /\bnorth\b/gi, replacement: 'N' },
  { pattern: /\bsouth\b/gi, replacement: 'S' },
  { pattern: /\beast\b/gi, replacement: 'E' },
  { pattern: /\bwest\b/gi, replacement: 'W' },
  { pattern: /\bnumber\b/gi, replacement: '#' },
  { pattern: /\bno\b/gi, replacement: '#' },
  { pattern: /\bunit\b/gi, replacement: 'UNIT' },
];

// Pre-compiled patterns for detection
const PATTERNS = {
  entity: /[.@\(\)]/g,
  whitespace: /\s+/g,
  url: /^(https?:\/\/)|(www\.)|([a-z0-9-]+\.[a-z]{2,})/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/,
  phoneDigits: /\D/g,
  documentLink: /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)(\?|$)/i,
  protocol: /^https?:\/\//i,
  www: /^www\./i,
  punctuation: /[^\w\s-]/gi,
  trailingPunctuation: /[,.\s]+$/,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const normalizeEncoding = (value: string): string => {
  if (!value) return value;
  try {
    return value.normalize('NFKC');
  } catch {
    return value;
  }
};

function standardizeAddressComponent(value: string): string {
  let cleaned = normalizeEncoding(value);
  // Use pre-compiled patterns
  for (const { pattern, replacement } of ADDRESS_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }
  return cleaned.replace(PATTERNS.whitespace, ' ').trim();
}

function cleanEntityName(value: string): string {
  let cleaned = normalizeEncoding(value);
  cleaned = cleaned.replace(/&/g, ' and ');
  cleaned = cleaned.replace(PATTERNS.entity, ' ');
  cleaned = cleaned.replace(/[.]/g, '');
  cleaned = cleaned.replace(PATTERNS.whitespace, ' ').trim();
  return cleaned;
}

function isURL(value: string): boolean {
  return PATTERNS.url.test(value.trim());
}

function isEmail(value: string): boolean {
  return PATTERNS.email.test(value.trim());
}

function isPhone(value: string): boolean {
  return PATTERNS.phone.test(value.trim());
}

function isDocumentLink(value: string): boolean {
  return PATTERNS.documentLink.test(value.trim());
}

function cleanText(value: string, removePunctuation: boolean = false): string {
  let cleaned = normalizeEncoding(value).trim();
  cleaned = cleaned.replace(PATTERNS.whitespace, ' ');
  cleaned = cleaned.replace(/&/g, ' and ');
  if (removePunctuation) {
    cleaned = cleaned.replace(PATTERNS.punctuation, '');
  }
  return cleaned;
}

function cleanWebsite(value: string): string {
  let cleaned = normalizeEncoding(value).trim().toLowerCase();
  cleaned = cleaned.replace(PATTERNS.protocol, '');
  cleaned = cleaned.replace(PATTERNS.www, '');
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  return cleaned;
}

function cleanEmail(value: string): string {
  let cleaned = normalizeEncoding(value).trim().toLowerCase();
  cleaned = cleaned.replace(/[^\w@.\-]/gi, '');
  return cleaned;
}

function extractEmailDomain(email: string): string {
  const cleaned = cleanEmail(email);
  const parts = cleaned.split('@');
  return parts.length === 2 ? parts[1] : '';
}

// ============================================
// PHONE NUMBER NORMALIZATION
// ============================================

type PhoneFormat = 'E164' | 'NATIONAL' | 'INTERNATIONAL' | 'DOTS' | 'DASHES';

function normalizePhoneNumber(phone: string, format: PhoneFormat = 'NATIONAL'): { 
  normalized: string; 
  isValid: boolean; 
  countryCode?: string;
  areaCode?: string;
  localNumber?: string;
} {
  // Extract only digits
  const digits = phone.replace(PATTERNS.phoneDigits, '');
  
  if (digits.length < 10) {
    return { normalized: phone, isValid: false };
  }
  
  let countryCode = '';
  let mainNumber = digits;
  
  // Handle US/Canada numbers (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) {
    countryCode = '1';
    mainNumber = digits.slice(1);
  } else if (digits.length === 10) {
    countryCode = '1'; // Assume US/Canada
    mainNumber = digits;
  } else if (digits.length > 11) {
    // International number
    countryCode = digits.slice(0, digits.length - 10);
    mainNumber = digits.slice(-10);
  }
  
  const areaCode = mainNumber.slice(0, 3);
  const exchange = mainNumber.slice(3, 6);
  const subscriber = mainNumber.slice(6, 10);
  
  let normalized: string;
  
  switch (format) {
    case 'E164':
      normalized = `+${countryCode}${mainNumber}`;
      break;
    case 'INTERNATIONAL':
      normalized = `+${countryCode} (${areaCode}) ${exchange}-${subscriber}`;
      break;
    case 'DOTS':
      normalized = `${areaCode}.${exchange}.${subscriber}`;
      break;
    case 'DASHES':
      normalized = `${areaCode}-${exchange}-${subscriber}`;
      break;
    case 'NATIONAL':
    default:
      normalized = `(${areaCode}) ${exchange}-${subscriber}`;
      break;
  }
  
  return {
    normalized,
    isValid: mainNumber.length === 10,
    countryCode,
    areaCode,
    localNumber: `${exchange}${subscriber}`,
  };
}

// ============================================
// DOCUMENT LINK PROCESSING
// ============================================

function extractDocumentInfo(url: string): {
  url: string;
  domain: string;
  fileName: string;
  fileType: string;
  isDocument: boolean;
} {
  const isDocument = isDocumentLink(url);
  const domain = extractDomainFromUrl(url);
  
  let fileName = '';
  let fileType = '';
  
  if (isDocument) {
    const match = url.match(/\/([^\/\?]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar))(\?|$)/i);
    if (match) {
      fileName = match[1];
      fileType = match[2].toUpperCase();
    }
  }
  
  return { url, domain, fileName, fileType, isDocument };
}

// ============================================
// STATE NORMALIZATION
// ============================================

function normalizeState(state: string): string {
  const cleaned = state.trim().toLowerCase();
  if (cleaned.length === 2) {
    return cleaned.toUpperCase();
  }
  return STATE_ABBREVIATIONS[cleaned] || state;
}

// ============================================
// LEGAL ENTITY AND ABBREVIATION PROCESSING
// ============================================

function removeLegalEntities(companyName: string, legalEntities: string[]): { cleaned: string; removed: string[] } {
  let cleaned = companyName;
  const removed: string[] = [];
  
  const sortedEntities = [...legalEntities].sort((a, b) => b.length - a.length);
  
  for (const entity of sortedEntities) {
    const pattern = new RegExp(`\\b${escapeRegExp(entity)}\\b`, 'gi');
    if (pattern.test(cleaned)) {
      removed.push(entity);
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }
  
  cleaned = cleaned.replace(PATTERNS.whitespace, ' ').replace(PATTERNS.trailingPunctuation, '').trim();
  
  return { cleaned, removed };
}

function replaceAbbreviations(companyName: string, abbreviations: Abbreviation[]): string {
  let result = companyName;
  
  for (const abbr of abbreviations) {
    for (const abbreviation of abbr.abbreviations) {
      const pattern = new RegExp(`\\b${escapeRegExp(abbreviation)}\\b`, 'gi');
      if (pattern.test(result)) {
        result = result.replace(pattern, abbr.companyName);
      }
    }
  }
  
  return result;
}

// ============================================
// WORD FREQUENCY ANALYSIS
// ============================================

export function calculateWordFrequency(
  data: CSVRow[],
  columns: string[],
  excludeStopwords: boolean = false
): WordFrequency[] {
  const wordCounts = new Map<string, number>();
  
  for (const row of data) {
    for (const column of columns) {
      const value = String(row[column] || '');
      if (!value.trim()) continue;
      
      const words = tokenizeText(value, excludeStopwords);
      
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }
  
  const frequencies: WordFrequency[] = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
  
  return frequencies;
}

// ============================================
// DATA QUALITY SCORING
// ============================================

export function calculateDataQualityScore(
  data: CSVRow[],
  headers: string[],
  config: ProcessingConfig
): DataQualityScore {
  if (data.length === 0) {
    return {
      overall: 0,
      completeness: 0,
      consistency: 0,
      validity: 0,
      uniqueness: 0,
      columnScores: [],
    };
  }

  const columnScores: DataQualityScore['columnScores'] = [];
  let totalCompleteness = 0;
  let totalValidity = 0;
  let totalUniqueness = 0;

  for (const header of headers) {
    const values = data.map(row => String(row[header] || ''));
    const nonEmpty = values.filter(v => v.trim() !== '');
    const uniqueValues = new Set(nonEmpty);
    
    const completeness = (nonEmpty.length / values.length) * 100;
    const issues: string[] = [];
    
    // Validity check based on detected type
    let validCount = nonEmpty.length;
    const lowerHeader = header.toLowerCase();
    
    if (lowerHeader.includes('email')) {
      validCount = nonEmpty.filter(v => PATTERNS.email.test(v)).length;
      if (validCount < nonEmpty.length) {
        issues.push(`${nonEmpty.length - validCount} invalid email formats`);
      }
    } else if (lowerHeader.includes('phone')) {
      validCount = nonEmpty.filter(v => PATTERNS.phone.test(v)).length;
      if (validCount < nonEmpty.length) {
        issues.push(`${nonEmpty.length - validCount} invalid phone formats`);
      }
    } else if (lowerHeader.includes('url') || lowerHeader.includes('website') || lowerHeader.includes('link')) {
      validCount = nonEmpty.filter(v => PATTERNS.url.test(v)).length;
      if (validCount < nonEmpty.length) {
        issues.push(`${nonEmpty.length - validCount} invalid URL formats`);
      }
    }
    
    const validity = nonEmpty.length > 0 ? (validCount / nonEmpty.length) * 100 : 100;
    
    if (completeness < 50) {
      issues.push('Low data completeness (< 50%)');
    }
    
    columnScores.push({
      column: header,
      completeness,
      validity,
      issues,
    });
    
    totalCompleteness += completeness;
    totalValidity += validity;
    totalUniqueness += (uniqueValues.size / Math.max(nonEmpty.length, 1)) * 100;
  }

  const avgCompleteness = headers.length > 0 ? totalCompleteness / headers.length : 0;
  const avgValidity = headers.length > 0 ? totalValidity / headers.length : 0;
  const avgUniqueness = headers.length > 0 ? totalUniqueness / headers.length : 0;
  
  // Consistency is a measure of pattern uniformity
  const consistency = (avgValidity + avgCompleteness) / 2;
  
  const overall = (avgCompleteness * 0.3 + avgValidity * 0.3 + consistency * 0.2 + avgUniqueness * 0.2);

  return {
    overall: Math.round(overall),
    completeness: Math.round(avgCompleteness),
    consistency: Math.round(consistency),
    validity: Math.round(avgValidity),
    uniqueness: Math.round(avgUniqueness),
    columnScores,
  };
}

// ============================================
// COLUMN PROFILING
// ============================================

export function profileColumn(data: CSVRow[], columnName: string): ColumnProfile {
  const values = data.map(row => String(row[columnName] || ''));
  const nonEmpty = values.filter(v => v.trim() !== '');
  const uniqueValues = new Map<string, number>();
  
  let minLength = Infinity;
  let maxLength = 0;
  let totalLength = 0;
  
  for (const value of nonEmpty) {
    const len = value.length;
    minLength = Math.min(minLength, len);
    maxLength = Math.max(maxLength, len);
    totalLength += len;
    uniqueValues.set(value, (uniqueValues.get(value) || 0) + 1);
  }
  
  // Detect type
  let type: ColumnProfile['type'] = 'text';
  const sampleSize = Math.min(100, nonEmpty.length);
  const sample = nonEmpty.slice(0, sampleSize);
  
  const emailCount = sample.filter(v => PATTERNS.email.test(v)).length;
  const phoneCount = sample.filter(v => PATTERNS.phone.test(v)).length;
  const urlCount = sample.filter(v => PATTERNS.url.test(v)).length;
  const docCount = sample.filter(v => PATTERNS.documentLink.test(v)).length;
  
  if (emailCount / sampleSize > 0.5) type = 'email';
  else if (phoneCount / sampleSize > 0.5) type = 'phone';
  else if (docCount / sampleSize > 0.3) type = 'document_link';
  else if (urlCount / sampleSize > 0.5) type = 'website';
  else if (columnName.toLowerCase().includes('address')) type = 'address';
  
  // Top values
  const topValues = Array.from(uniqueValues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value: value.slice(0, 50), count }));
  
  return {
    name: columnName,
    type,
    totalCount: values.length,
    uniqueCount: uniqueValues.size,
    nullCount: values.filter(v => v === '' || v === 'null' || v === 'NULL').length,
    emptyCount: values.filter(v => v.trim() === '').length,
    completeness: Math.round((nonEmpty.length / values.length) * 100),
    topValues,
    minLength: minLength === Infinity ? 0 : minLength,
    maxLength,
    avgLength: nonEmpty.length > 0 ? Math.round(totalLength / nonEmpty.length) : 0,
  };
}

export function profileAllColumns(data: CSVRow[], headers: string[]): ColumnProfile[] {
  return headers.map(header => profileColumn(data, header));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const countPopulatedFields = (row: CSVRow): number => {
  return Object.values(row).reduce((total, value) => {
    if (value === null || value === undefined) return total;
    const normalized = String(value).trim();
    return normalized ? total + 1 : total;
  }, 0);
};

const cloneWithoutMeta = (row: CSVRow): CSVRow => {
  const cloned: CSVRow = { ...row };
  if (ROW_INDEX_KEY in cloned) {
    delete (cloned as any)[ROW_INDEX_KEY];
  }
  return cloned;
};

const stripMetaFromRows = (rows: CSVRow[]): void => {
  for (const row of rows) {
    if (ROW_INDEX_KEY in row) {
      delete (row as any)[ROW_INDEX_KEY];
    }
  }
};

// ============================================
// MAIN PROCESSING FUNCTION (Optimized for 100K+ rows)
// ============================================

export function processCSVData(
  data: CSVRow[],
  config: ProcessingConfig,
  legalEntities: string[],
  abbreviations: Abbreviation[],
  cityStateReference: CityStateReference[] = [],
  abortSignal?: AbortSignal,
  onProgress?: (progress: ProcessingProgress) => void
): { processedData: CSVRow[]; cleanedData: CSVRow[]; stats: ProcessingStats; dedupeAuditLookup: DedupeAuditLookup } {
  
  const startTime = Date.now();
  const stats: ProcessingStats = {
    initialRows: data.length,
    totalRows: data.length,
    totalColumns: Object.keys(data[0] || {}).length,
    columnsProcessed: 0,
    totalChanges: 0,
    duplicatesRemoved: 0,
    companiesProcessed: 0,
    rowsGrouped: 0,
    invalidCities: 0,
    invalidCityStates: 0,
    noDataCities: 0,
    noDataCityStates: 0,
  };
  
  const addressColumns = config.addressColumns || [];
  const parsedFieldName = getParsedFieldName(addressColumns);
  const addressDelimiter = config.addressDelimiter ?? ', ';

  if (data.length === 0) {
    return { processedData: data, cleanedData: data, stats, dedupeAuditLookup: {} };
  }
  
  // Progress reporting helper
  const reportProgress = (phase: ProcessingProgress['phase'], currentRow: number) => {
    if (onProgress) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rowsPerSecond = currentRow / Math.max(elapsed, 0.1);
      const remainingRows = data.length - currentRow;
      const estimatedTimeRemaining = remainingRows / Math.max(rowsPerSecond, 1);
      
      onProgress({
        phase,
        currentRow,
        totalRows: data.length,
        percentage: Math.round((currentRow / data.length) * 100),
        estimatedTimeRemaining: Math.round(estimatedTimeRemaining),
        startTime,
      });
    }
  };

  // --- PHASE 1: ROW-LEVEL CLEANING (1:1 MAPPING) ---
  reportProgress('cleaning', 0);

  // Prepare validation maps
  const cityStateMap = new Map<string, Set<string>>();
  const cityStateCombinedMap = new Set<string>();

  if (config.cityStateValidationEnabled && cityStateReference.length > 0) {
    for (const ref of cityStateReference) {
      const city = ref.city.toLowerCase().trim();
      const state = ref.state.trim().toUpperCase();
      const cityStateCombined = ref.City_State ? ref.City_State.toLowerCase().trim() : `${city}, ${state.toLowerCase()}`;
      
      if (!cityStateMap.has(city)) {
        cityStateMap.set(city, new Set());
      }
      cityStateMap.get(city)!.add(state);
      cityStateCombinedMap.add(cityStateCombined);
    }
  }

  const entityColumns = new Set<string>();
  if (config.companyNameColumn) {
    entityColumns.add(config.companyNameColumn);
  }
  for (const column of config.selectedColumns) {
    const lower = column.toLowerCase();
    if (lower.includes('company') || lower.includes('entity') || lower.includes('organization')) {
      entityColumns.add(column);
    }
  }

  // Pre-compute phone columns set for faster lookup
  const phoneColumnsSet = new Set(config.phoneColumns || []);
  const websiteColumnsSet = new Set(config.websiteColumns || []);
  const documentLinkColumnsSet = new Set(config.documentLinkColumns || []);

  let cleanedData = data.map((row, rowIndex) => {
    // Check for abort
    if (abortSignal?.aborted) {
      throw new Error('Processing cancelled');
    }
    
    // Report progress every 1000 rows
    if (rowIndex % 1000 === 0) {
      reportProgress('cleaning', rowIndex);
    }
    
    const newRow: CSVRow = { ...row };
    (newRow as any)[ROW_INDEX_KEY] = rowIndex;
    const allColumns = Object.keys(row);

    // 1. Basic Column Processing
    for (const column of config.selectedColumns) {
      if (!allColumns.includes(column)) continue;
      
      const originalValue = String(row[column] || '');
      let processedValue = originalValue;
      
      if (!processedValue || processedValue.trim() === '') continue;
      
      // Hyperlink extraction
      const hyperlinkData = extractHyperlink(processedValue);
      if (hyperlinkData) {
        processedValue = hyperlinkData.text;
        newRow[column] = processedValue;
        newRow[`${column}_HyperlinkDomain`] = hyperlinkData.domain;
        stats.totalChanges++;
        continue;
      }
      
      const valueIsUrl = isURL(processedValue);
      const valueIsEmail = isEmail(processedValue);
      const valueIsPhone = isPhone(processedValue);
      
      // Phone normalization
      if (config.phoneNormalizationEnabled && phoneColumnsSet.has(column)) {
        const phoneResult = normalizePhoneNumber(processedValue, config.phoneFormat);
        if (phoneResult.isValid) {
          processedValue = phoneResult.normalized;
          if (phoneResult.areaCode) {
            newRow[`${column}_AreaCode`] = phoneResult.areaCode;
          }
        }
        newRow[`${column}_Valid`] = phoneResult.isValid ? 'Yes' : 'No';
      }
      
      // Website normalization
      if (config.websiteNormalizationEnabled && websiteColumnsSet.has(column) && valueIsUrl) {
        if (config.extractDomain) {
          newRow[`${column}_Domain`] = extractDomainFromUrl(processedValue);
        }
        processedValue = cleanWebsite(processedValue);
      }
      
      // Document link processing
      if (config.extractDocumentInfo && documentLinkColumnsSet.has(column)) {
        const docInfo = extractDocumentInfo(processedValue);
        if (docInfo.isDocument) {
          newRow[`${column}_FileName`] = docInfo.fileName;
          newRow[`${column}_FileType`] = docInfo.fileType;
          newRow[`${column}_Domain`] = docInfo.domain;
        }
      }
      
      // Standard cleaning
      if (config.normalizationCleanup && !valueIsPhone) {
        processedValue = cleanText(processedValue, !valueIsUrl && !valueIsEmail);
      }
      if (valueIsUrl && !phoneColumnsSet.has(column)) processedValue = cleanWebsite(processedValue);
      if (valueIsEmail) {
        processedValue = cleanEmail(processedValue);
        const domain = extractEmailDomain(processedValue);
        if (domain) newRow[`${column}_Domain`] = domain;
      }
      
      if (config.uppercaseConversion && !valueIsUrl && !valueIsEmail && !valueIsPhone) {
        processedValue = processedValue.toUpperCase();
      }
      
      if (entityColumns.has(column)) {
        processedValue = cleanEntityName(processedValue);
      }
      
      if (column === config.stateColumn) {
        processedValue = normalizeState(processedValue);
      }
      
      if (processedValue !== originalValue) stats.totalChanges++;
      newRow[column] = processedValue;
    }

    // 2. City & State Validation
    if (config.cityStateValidationEnabled && cityStateReference.length > 0 && config.cityColumn && config.stateColumn) {
      const city = String(newRow[config.cityColumn] || '').toLowerCase().trim();
      const state = String(newRow[config.stateColumn] || '').trim().toUpperCase();
      
      const cityIsBlank = !city;
      const stateIsBlank = !state;
      
      let cityValidation = 'Valid';
      let stateValidation = 'Valid';
      let cityStateValidation = 'Valid';
      
      if (cityIsBlank) {
        cityValidation = 'No data';
        stats.noDataCities++;
      } else {
        if (!cityStateMap.has(city)) {
          cityValidation = 'Invalid';
          stats.invalidCities++;
        }
      }
      
      if (stateIsBlank) {
        stateValidation = 'No data';
      }
      
      if (cityIsBlank || stateIsBlank) {
        cityStateValidation = 'No data';
        stats.noDataCityStates++;
      } else {
        const validStates = cityStateMap.get(city);
        const cityStateValid = validStates ? validStates.has(state) : false;
        if (!cityStateValid) {
          const combined = `${city}, ${state.toLowerCase()}`;
          if (!cityStateCombinedMap.has(combined)) {
            cityStateValidation = 'Invalid';
            stats.invalidCityStates++;
          }
        }
      }
      
      if (config.cityColumn) newRow[`${config.cityColumn}_Verification`] = cityValidation;
      if (config.stateColumn) newRow[`${config.stateColumn}_Verification`] = stateValidation;
      newRow['City_State_Verification'] = cityStateValidation;
    }

    // 3. Company Name Specific Cleaning
    if (config.companyNameCleaningEnabled && config.companyNameColumn) {
      let companyName = String(newRow[config.companyNameColumn] || '');
      const originalCompany = String(row[config.companyNameColumn] || '');
      let removedEntities: string[] = [];

      if (config.replaceAbbreviations && abbreviations.length > 0) {
        companyName = replaceAbbreviations(companyName, abbreviations);
      }
      if (config.removeLegalEntities && legalEntities.length > 0) {
        const result = removeLegalEntities(companyName, legalEntities);
        companyName = result.cleaned;
        removedEntities = result.removed;
      }
      
      if (companyName !== originalCompany) {
        stats.companiesProcessed++;
        stats.totalChanges++;
      }
      
      newRow[config.companyNameColumn] = companyName;
      newRow[`${config.companyNameColumn}_Removed_Entities`] = removedEntities.join(', ');
    }

    // 4. Address Combination
    if (config.addressParsingEnabled && addressColumns.length > 0) {
      const parts: string[] = [];
      for (const column of addressColumns) {
        const rawValue = String(newRow[column] || '').trim();
        if (!rawValue) continue;
        const columnName = column.toLowerCase();
        const shouldStandardize = ADDRESS_COLUMN_HINTS.some((hint) =>
          columnName.includes(hint)
        );
        const parsedValue = shouldStandardize
          ? standardizeAddressComponent(rawValue)
          : normalizeEncoding(rawValue).replace(PATTERNS.whitespace, ' ').trim();
        if (parsedValue) {
          parts.push(parsedValue);
        }
      }
      if (parts.length > 0) {
        newRow[parsedFieldName] = parts.join(addressDelimiter);
        stats.totalChanges++;
      } else {
        newRow[parsedFieldName] = '';
      }
    }

    return newRow;
  });

  // --- PHASE 2: GROUPING & DEDUPLICATION ---
  reportProgress('deduplicating', data.length);
  
  // Use structuredClone for better performance (or spread if not available)
  let processedData: CSVRow[];
  try {
    processedData = structuredClone(cleanedData);
  } catch {
    processedData = cleanedData.map(row => ({ ...row }));
  }
  
  const dedupeAuditLookup: DedupeAuditLookup = {};

  const groupingColumns = config.duplicateDetectionColumns.length > 0
    ? config.duplicateDetectionColumns
    : [];

  if (groupingColumns.length > 0) {
    const groups = new Map<string, CSVRow[]>();
    const originalEntityNames = new Map<string, Set<string>>();

    for (const row of processedData) {
      const keyParts = groupingColumns.map(col =>
        String(row[col] || '').toLowerCase().trim()
      );
      const groupKey = keyParts.join('|||');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
        if (config.companyNameColumn) {
          originalEntityNames.set(groupKey, new Set());
        }
      }
      groups.get(groupKey)!.push(row);
    }

    processedData.forEach((row) => {
      if (!config.companyNameColumn) return;
      const keyParts = groupingColumns.map(col =>
        String(row[col] || '').toLowerCase().trim()
      );
      const groupKey = keyParts.join('|||');
      const originalName = String(row[config.companyNameColumn] || '');
      if (originalName && originalEntityNames.has(groupKey)) {
        originalEntityNames.get(groupKey)!.add(originalName);
      }
    });

    const aggregatedRows: CSVRow[] = [];
    const condensedRows: CSVRow[] = [];

    for (const [groupKey, rows] of groups.entries()) {
      const valueMap = new Map<string, Set<string>>();

      for (const r of rows) {
        for (const [k, v] of Object.entries(r)) {
          const s = String(v).trim();
          if (s) {
            if (!valueMap.has(k)) valueMap.set(k, new Set());
            valueMap.get(k)!.add(s);
          }
        }
      }

      const mergedRow: CSVRow = {};
      for (const [k, vSet] of valueMap.entries()) {
        const values = Array.from(vSet);
        mergedRow[k] = values.length === 1 ? values[0] : values.join(' | ');
      }

      if (config.companyNameColumn) {
        const origNames = originalEntityNames.get(groupKey);
        if (origNames && origNames.size > 0) {
          mergedRow['Original_Entity_Names'] = Array.from(origNames).join(' | ');
        }
      }

      aggregatedRows.push(mergedRow);

      let bestRow = rows[0];
      let bestScore = countPopulatedFields(rows[0]);
      for (let i = 1; i < rows.length; i++) {
        const candidate = rows[i];
        const candidateScore = countPopulatedFields(candidate);
        if (candidateScore > bestScore) {
          bestRow = candidate;
          bestScore = candidateScore;
        }
      }
      condensedRows.push(cloneWithoutMeta(bestRow));

      for (const r of rows) {
        const idx = (r as any)[ROW_INDEX_KEY];
        if (typeof idx === 'number') {
          dedupeAuditLookup[idx] = mergedRow;
        }
      }
    }

    const rowsRemovedByGrouping = processedData.length - condensedRows.length;
    if (rowsRemovedByGrouping > 0) stats.duplicatesRemoved += rowsRemovedByGrouping;

    processedData = condensedRows;
    stats.rowsGrouped = aggregatedRows.length;
  } else {
    stats.rowsGrouped = 0;
  }

  stats.totalRows = processedData.length;
  stats.columnsProcessed = config.selectedColumns.length;

  const outputColumns = (() => {
    if (config.outputColumns && config.outputColumns.length > 0) {
      return config.outputColumns;
    }
    if (processedData.length > 0) {
      return Object.keys(processedData[0]);
    }
    return [];
  })();

  const filteredProcessed = processedData.map(row => {
    const filtered: CSVRow = {};
    for (const col of outputColumns) {
      if (col in row) {
        filtered[col] = row[col];
      } else {
        filtered[col] = '';
      }
    }
    return filtered;
  });

  stripMetaFromRows(cleanedData);
  
  reportProgress('complete', data.length);

  return { processedData: filteredProcessed, cleanedData, stats, dedupeAuditLookup };
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

export function exportToCSV(
  data: CSVRow[],
  fileName: string,
  selectedColumns?: string[],
  columnRenames?: { [key: string]: string },
  excludeVerificationColumns: boolean = false
): string {
  if (data.length === 0) return '';
  
  let headers = selectedColumns && selectedColumns.length > 0 
    ? selectedColumns 
    : Object.keys(data[0]);
  
  if (excludeVerificationColumns) {
    headers = headers.filter(h => 
      !h.endsWith('_Verification') && 
      h !== 'City_State_Verification' &&
      !h.endsWith('_Removed_Entities') &&
      !h.endsWith('_HyperlinkDomain') &&
      !h.endsWith('_Domain') &&
      !h.endsWith('_AreaCode') &&
      !h.endsWith('_Valid') &&
      !h.endsWith('_FileName') &&
      !h.endsWith('_FileType') &&
      h !== 'Original_Entity_Names'
    );
  }

  headers = headers.filter(h => h in data[0]);
  
  const csvRows: string[] = [];
  
  const displayHeaders = headers.map(h => {
    if (columnRenames && columnRenames[h]) {
      return columnRenames[h];
    }
    return h;
  });
  
  csvRows.push(displayHeaders.map(h => `"${h}"`).join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = String(row[header] || '');
      return `"${value.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

export function exportWordFrequencyToCSV(frequencies: WordFrequency[]): string {
  const csvRows: string[] = [];
  csvRows.push('"Word","Count"');
  
  for (const freq of frequencies) {
    csvRows.push(`"${freq.word}","${freq.count}"`);
  }
  
  return csvRows.join('\n');
}

export function buildOriginalVsCleanedRows(
  originalData: CSVRow[],
  cleanedData: CSVRow[],
  columns?: string[],
  aggregatedLookup?: DedupeAuditLookup
): CSVRow[] {
  if (originalData.length === 0 || cleanedData.length === 0) return [];
  
  const targetColumns = columns && columns.length > 0
    ? columns
    : Array.from(
        new Set([
          ...Object.keys(originalData[0] || {}),
          ...Object.keys(cleanedData[0] || {}),
        ])
      );
  
  const length = Math.min(originalData.length, cleanedData.length);
  const comparisonRows: CSVRow[] = [];
  
  for (let i = 0; i < length; i++) {
    const row: CSVRow = {};
    
    for (const column of targetColumns) {
      const originalValue = originalData[i]?.[column] ?? '';
      const auditRow = aggregatedLookup ? aggregatedLookup[i] : undefined;
      const cleanedSource = auditRow ?? cleanedData[i];
      const cleanedValue = cleanedSource?.[column] ?? '';
      row[`Original_${column}`] = originalValue;
      row[`Cleaned_${column}`] = cleanedValue;
    }
    
    comparisonRows.push(row);
  }
  
  return comparisonRows;
}
