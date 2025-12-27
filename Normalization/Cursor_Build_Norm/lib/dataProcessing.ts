import { CSVRow, ProcessingConfig, ProcessingStats, CityStateReference, Abbreviation, WordFrequency } from './types';
import { extractHyperlink, extractDomainFromUrl, tokenizeText, escapeRegExp } from './utils';

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

const ENTITY_STRIP_PATTERN = /[.@\-\(\)]/g;

function standardizeAddressComponent(value: string): string {
  let cleaned = value;
  for (const [pattern, replacement] of Object.entries(ADDRESS_REPLACEMENTS)) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    cleaned = cleaned.replace(regex, replacement);
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function cleanEntityName(value: string): string {
  // Preserve "&" meaning by expanding to "and" before aggressive cleanup
  let cleaned = value.replace(/&/g, ' and ');
  
  // Enhancement 2: Aggressive cleanup - remove dashes, dots, and parens, but allow spaces
  cleaned = cleaned.replace(ENTITY_STRIP_PATTERN, ' ');
  cleaned = cleaned.replace(/[.\-]/g, ''); 
  
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
  let cleaned = value.trim();
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Ensure ampersands survive punctuation stripping by mapping to lexical word first
  cleaned = cleaned.replace(/&/g, ' and ');
  
  if (removePunctuation) {
    // Strip all punctuation characters (including @ . - &) for non-email/url fields
    cleaned = cleaned.replace(/[^\w\s]/gi, '');
  }
  
  return cleaned;
}

// Clean website URL
function cleanWebsite(value: string): string {
  let cleaned = value.trim().toLowerCase();
  
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
  let cleaned = value.trim().toLowerCase();
  
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

// Main processing function
export function processCSVData(
  data: CSVRow[],
  config: ProcessingConfig,
  legalEntities: string[],
  abbreviations: Abbreviation[],
  cityStateReference: CityStateReference[] = [],
  abortSignal?: AbortSignal
): { processedData: CSVRow[]; cleanedData: CSVRow[]; stats: ProcessingStats } {
  
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
  
  if (data.length === 0) {
    return { processedData: data, cleanedData: data, stats };
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

  let cleanedData = data.map((row) => {
    const newRow: CSVRow = { ...row };
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
      
      if (column === config.stateColumn && config.cityStateValidationEnabled) {
        processedValue = normalizeState(processedValue);
      }
      
      if (processedValue !== originalValue) stats.totalChanges++;
      newRow[column] = processedValue;
    }

    // 2. Address Combination (Full_Address)
    const hasAddress1 = Boolean(config.address1Column);
    const hasAddress2 = Boolean(config.address2Column);
    if (config.addressParsingEnabled && (hasAddress1 || hasAddress2)) {
      const parts: string[] = [];
      if (hasAddress1) {
        const addr1 = String(newRow[config.address1Column] || '').trim();
        if (addr1) parts.push(standardizeAddressComponent(addr1));
      }
      if (hasAddress2) {
        const addr2 = String(newRow[config.address2Column] || '').trim();
        if (addr2) parts.push(standardizeAddressComponent(addr2));
      }
      newRow['Full_Address'] = parts.join(', ');
    }

    // 3. City & State Validation
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

    // 4. Company Name Specific Cleaning (Abbreviations, Legal Entities)
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

    return newRow;
  });

  // --- PHASE 2: GROUPING & DEDUPLICATION (Produces processedData) ---
  // Clone cleanedData
  let processedData = JSON.parse(JSON.stringify(cleanedData));

  // 5. Grouping & Merging (Deduplication)
  // If duplicate detection columns are selected, use them.
  // Otherwise, fall back to Company Name if enabled.
  let groupingColumns: string[] = [];
  
  if (config.duplicateDetectionColumns.length > 0) {
    groupingColumns = config.duplicateDetectionColumns;
  } else if (config.companyNameColumn) {
    groupingColumns = [config.companyNameColumn];
  }

  if (groupingColumns.length > 0) {
    const groups = new Map<string, CSVRow[]>();
    const originalEntityNames = new Map<string, Set<string>>();
    
    // Bucketing
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
        
        // Store original names if we are deduplicating (and have a company name column to track)
        if (config.companyNameColumn) {
             // We need to find the index in cleanedData to map back to original data
             // But we don't have index easily here unless we kept it.
             // However, processedData currently is 1:1 with cleanedData (and data) before this step.
             // But wait, we're iterating processedData.
             // Let's assume processedData order hasn't changed yet.
             // BUT we need the ORIGINAL name from 'data'.
             // To do this reliably, we should have added metadata index to rows, but we can't easily modify CSVRow type structure without impact.
             // Let's use a simple counter if we assume iteration order is preserved.
        }
    }

    // Re-iterate to get original names using index?
    // Actually, we can just build the groups first, then map.
    // Better: let's use index in the loop.
    processedData.forEach((row, idx) => {
        const keyParts = groupingColumns.map(col => 
            String(row[col] || '').toLowerCase().trim()
        );
        const groupKey = keyParts.join('|||');
        
        if (config.companyNameColumn) {
             const originalName = String(data[idx][config.companyNameColumn] || '');
             if (originalName && originalEntityNames.has(groupKey)) {
                 originalEntityNames.get(groupKey)!.add(originalName);
             }
        }
    });

    const aggregatedRows: CSVRow[] = [];
    for (const [groupKey, rows] of groups.entries()) {
        // Enrichment/Merge logic
        // We merge ALL columns.
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
            // User Requirement: "Merge/Enrichment... Merge into 1 Master Record"
            // Ideally, we want single values if they are unique. If multiple different values, we join them.
            // If only 1 unique value exists across rows, that's the value.
            const values = Array.from(vSet);
            if (values.length === 1) {
                mergedRow[k] = values[0];
            } else {
                mergedRow[k] = values.join(' | ');
            }
        }
        
        if (config.companyNameColumn) {
            const origNames = originalEntityNames.get(groupKey);
            if (origNames && origNames.size > 0) {
                mergedRow['Original_Entity_Names'] = Array.from(origNames).join(' | ');
            }
        }
        
        aggregatedRows.push(mergedRow);
    }
    
    const rowsRemovedByGrouping = processedData.length - aggregatedRows.length;
    if (rowsRemovedByGrouping > 0) stats.duplicatesRemoved += rowsRemovedByGrouping;
    
    processedData = aggregatedRows;
    stats.rowsGrouped = processedData.length;
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

  return { processedData: filteredProcessed, cleanedData, stats };
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
  columns?: string[]
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
      const cleanedValue = cleanedData[i]?.[column] ?? '';
      row[`Original_${column}`] = originalValue;
      row[`Cleaned_${column}`] = cleanedValue;
    }
    
    comparisonRows.push(row);
  }
  
  return comparisonRows;
}