import { CSVRow, ProcessingConfig, ProcessingStats, CityStateReference, Abbreviation, WordFrequency, DedupeAuditLookup } from './types';
import { extractHyperlink, extractDomainFromUrl, tokenizeText, escapeRegExp, getParsedFieldName } from './utils';

const ROW_INDEX_KEY = '__row_index__';

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

// Address replacements for standardization
const ADDRESS_REPLACEMENTS: { [key: string]: string } = {
  'street': 'ST',
  'st': 'ST',
  'avenue': 'AVE',
  'ave': 'AVE',
  'road': 'RD',
  'rd': 'RD',
  'boulevard': 'BLVD',
  'blvd': 'BLVD',
  'drive': 'DR',
  'dr': 'DR',
  'lane': 'LN',
  'ln': 'LN',
  'court': 'CT',
  'ct': 'CT',
  'highway': 'HWY',
  'hwy': 'HWY',
  'parkway': 'PKWY',
  'pkwy': 'PKWY',
  'suite': 'STE',
  'ste': 'STE',
  'apartment': 'APT',
  'apt': 'APT',
  'floor': 'FL',
  'north': 'N',
  'south': 'S',
  'east': 'E',
  'west': 'W',
  'number': '#',
  'no': '#',
  'unit': 'UNIT'
};

const ENTITY_STRIP_PATTERN = /[.@\(\)]/g;

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
  for (const [pattern, replacement] of Object.entries(ADDRESS_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function cleanEntityName(value: string): string {
  let cleaned = normalizeEncoding(value);
  
  // Preserve "&" meaning by expanding to "and" before aggressive cleanup
  cleaned = cleaned.replace(/&/g, ' and ');
  
  // Enhancement 2: Aggressive cleanup - remove dashes, dots, and parens, but allow spaces
  cleaned = cleaned.replace(ENTITY_STRIP_PATTERN, ' ');
  cleaned = cleaned.replace(/[.]/g, ''); 
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

// Helper: Check if value is a URL
function isURL(value: string): boolean {
  const urlPattern = /^(https?:\/\/)|(www\.)|([a-z0-9-]+\.[a-z]{2,})/i;
  return urlPattern.test(value.trim());
}

// Helper: Check if value is an email
function isEmail(value: string): boolean {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value.trim());
}

// Clean whitespace and punctuation
function cleanText(value: string, removePunctuation: boolean = false): string {
  let cleaned = normalizeEncoding(value).trim();
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Ensure ampersands survive punctuation stripping by mapping to lexical word first
  cleaned = cleaned.replace(/&/g, ' and ');
  
  if (removePunctuation) {
    cleaned = cleaned.replace(/[^\w\s-]/gi, '');
  }
  
  return cleaned;
}

// Clean website URL
function cleanWebsite(value: string): string {
  let cleaned = normalizeEncoding(value).trim().toLowerCase();
  
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^www\./i, '');
  
  // Remove path, query, fragment
  cleaned = cleaned.split('/')[0];
  cleaned = cleaned.split('?')[0];
  cleaned = cleaned.split('#')[0];
  
  return cleaned;
}

// Clean email
function cleanEmail(value: string): string {
  let cleaned = normalizeEncoding(value).trim().toLowerCase();
  
  // Remove special characters except @ and .
  cleaned = cleaned.replace(/[^\w@.\-]/gi, '');
  
  return cleaned;
}

// Extract email domain
function extractEmailDomain(email: string): string {
  const cleaned = cleanEmail(email);
  const parts = cleaned.split('@');
  return parts.length === 2 ? parts[1] : '';
}

// Normalize state name to abbreviation
function normalizeState(state: string): string {
  const cleaned = state.trim().toLowerCase();
  
  // If already an abbreviation, return uppercase
  if (cleaned.length === 2) {
    return cleaned.toUpperCase();
  }
  
  // Look up full name
  return STATE_ABBREVIATIONS[cleaned] || state;
}

// Remove legal entities from company name
function removeLegalEntities(companyName: string, legalEntities: string[]): { cleaned: string; removed: string[] } {
  let cleaned = companyName;
  const removed: string[] = [];
  
  // Sort by length (longest first) to avoid partial matches
  const sortedEntities = [...legalEntities].sort((a, b) => b.length - a.length);
  
  for (const entity of sortedEntities) {
    const pattern = new RegExp(`\\b${escapeRegExp(entity)}\\b`, 'gi');
    if (pattern.test(cleaned)) {
      removed.push(entity);
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }
  
  // Clean up extra whitespace and trailing commas/periods
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/[,.\s]+$/, '').trim();
  
  return { cleaned, removed };
}

// Replace abbreviations in company name
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

// Calculate word frequency
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
  
  // Convert to array and sort by frequency
  const frequencies: WordFrequency[] = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
  
  return frequencies;
}

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

// Main processing function
export function processCSVData(
  data: CSVRow[],
  config: ProcessingConfig,
  legalEntities: string[],
  abbreviations: Abbreviation[],
  cityStateReference: CityStateReference[] = [],
  abortSignal?: AbortSignal
): { processedData: CSVRow[]; cleanedData: CSVRow[]; stats: ProcessingStats; dedupeAuditLookup: DedupeAuditLookup } {
  
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
  
  // --- PHASE 1: ROW-LEVEL CLEANING (1:1 MAPPING) ---
  // This produces 'cleanedData' which corresponds 1:1 with original rows.
  // All validation and per-row transformations happen here.

  // Prepare validation maps
  const cityStateMap = new Map<string, Set<string>>();
  const cityStateCombinedMap = new Set<string>(); // Combined "City, State" or similar from reference

  if (config.cityStateValidationEnabled && cityStateReference.length > 0) {
    for (const ref of cityStateReference) {
      const city = ref.city.toLowerCase().trim();
      const state = ref.state.trim().toUpperCase();
      // Assuming ref.City_State is already constructed or exists
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

  let cleanedData = data.map((row, rowIndex) => {
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
      
      const isUrl = isURL(processedValue);
      const isEmailField = isEmail(processedValue);
      
      // Cleaning
      if (config.normalizationCleanup) {
        processedValue = cleanText(processedValue, !isUrl && !isEmailField);
      }
      if (isUrl) processedValue = cleanWebsite(processedValue);
      if (isEmailField) {
        processedValue = cleanEmail(processedValue);
        const domain = extractEmailDomain(processedValue);
        if (domain) newRow[`${column}_Domain`] = domain;
      }
      
      if (config.uppercaseConversion && !isUrl && !isEmailField) {
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
      
      // City Validation
      if (cityIsBlank) {
        cityValidation = 'No data';
        stats.noDataCities++;
      } else {
        if (!cityStateMap.has(city)) {
          cityValidation = 'Invalid';
          stats.invalidCities++;
        }
      }
      
      // State Validation (new logic: check if state exists in general? Or just basic valid check. 
      // Requirement said "compare the city... then the state".
      // Usually state validation means "is this a valid state code".
      // For now we just mark No data if blank.
      if (stateIsBlank) {
        stateValidation = 'No data';
      } 
      // Additional state check could be added if we have a list of all valid states.
      // But usually we check if the state is valid for the city.
      
      // City-State Validation
      if (cityIsBlank || stateIsBlank) {
        cityStateValidation = 'No data';
        stats.noDataCityStates++;
      } else {
        const validStates = cityStateMap.get(city);
        const cityStateValid = validStates ? validStates.has(state) : false;
        if (!cityStateValid) {
            // Check combined map as fallback or primary?
            // User said: "Parse the city_state and compare it to the City_state in the verification file."
            // Let's construct our combined string.
            const combined = `${city}, ${state.toLowerCase()}`; // Comma space format matches typical logic
            // But wait, the verification file's City_State format depends on how we parsed it. 
            // In app/page.tsx handleReferenceFileUploaded, we construct it: `${row[city]}, ${row[state]}`
            // We normalized the reference map to lower case for comparison.
            
            if (!cityStateCombinedMap.has(combined)) {
                 cityStateValidation = 'Invalid';
                 stats.invalidCityStates++;
            } else {
                // If combined map has it, then it's valid, even if hierarchical map failed (should overlap).
                cityStateValidation = 'Valid';
            }
        }
      }
      
      // Add verification columns
      if (config.cityColumn) newRow[`${config.cityColumn}_Verification`] = cityValidation;
      if (config.stateColumn) newRow[`${config.stateColumn}_Verification`] = stateValidation; // Or just use City_State_Valid? User asked for "beside each column".
      newRow['City_State_Verification'] = cityStateValidation;
    }

    // 3. Company Name Specific Cleaning (Abbreviations, Legal Entities)
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
          stats.companiesProcessed++; // This might be overcounting if called multiple times per row? No, distinct rows.
          stats.totalChanges++;
       }
       
       newRow[config.companyNameColumn] = companyName;
       newRow[`${config.companyNameColumn}_Removed_Entities`] = removedEntities.join(', ');
    }

    // 4. Address Combination (Parsed Columns)
    if (config.addressParsingEnabled && addressColumns.length > 0) {
      const parts: string[] = [];
      for (const column of addressColumns) {
        const addr = String(newRow[column] || '').trim();
        if (addr) parts.push(standardizeAddressComponent(addr));
      }
      newRow[parsedFieldName] = parts.join(addressDelimiter);
    }

    return newRow;
  });

  // --- PHASE 2: GROUPING & DEDUPLICATION (Produces processedData) ---
  // Clone cleanedData
  let processedData = JSON.parse(JSON.stringify(cleanedData));
  const dedupeAuditLookup: DedupeAuditLookup = {};

  // 5. Grouping & Merging (Deduplication)
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
  stats.columnsProcessed = config.selectedColumns.length; // Approximate

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

  return { processedData: filteredProcessed, cleanedData, stats, dedupeAuditLookup };
}

// Enhancement 2: Export to CSV with column selection and renaming
export function exportToCSV(
  data: CSVRow[],
  fileName: string,
  selectedColumns?: string[],
  columnRenames?: { [key: string]: string },
  excludeVerificationColumns: boolean = false
): string {
  if (data.length === 0) return '';
  
  // Get all columns or use selected ones (Enhancement 2)
  let headers = selectedColumns && selectedColumns.length > 0 
    ? selectedColumns 
    : Object.keys(data[0]);
  
  // Enhancement 3: Filter out verification columns for "Cleaned" file export if requested
  if (excludeVerificationColumns) {
      headers = headers.filter(h => 
          !h.endsWith('_Verification') && 
          h !== 'City_State_Verification' &&
          !h.endsWith('_Removed_Entities') &&
          !h.endsWith('_HyperlinkDomain') &&
          !h.endsWith('_Domain') &&
          h !== 'Original_Entity_Names' // Also remove the audit trail column from pure clean export
      );
  }

  // Filter headers to only include existing columns
  headers = headers.filter(h => h in data[0]);
  
  const csvRows: string[] = [];
  
  // Enhancement 6: Apply column renaming to headers
  const displayHeaders = headers.map(h => {
    if (columnRenames && columnRenames[h]) {
      return columnRenames[h];
    }
    return h;
  });
  
  // Add headers
  csvRows.push(displayHeaders.map(h => `"${h}"`).join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = String(row[header] || '');
      // Escape quotes and wrap in quotes
      return `"${value.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Export word frequency to CSV
export function exportWordFrequencyToCSV(frequencies: WordFrequency[]): string {
  const csvRows: string[] = [];
  
  // Add headers
  csvRows.push('"Word","Count"');
  
  // Add data rows
  for (const freq of frequencies) {
    csvRows.push(`"${freq.word}","${freq.count}"`);
  }
  
  return csvRows.join('\n');
}

export function buildOriginalVsCleanedRows(
  originalData: CSVRow[],
  cleanedData: CSVRow[], // CHANGED: expects cleanedData (1:1)
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
  
  // Should be 1:1 now
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