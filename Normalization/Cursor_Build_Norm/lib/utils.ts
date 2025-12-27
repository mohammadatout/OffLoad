import { ColumnInfo, CSVRow } from './types';

// Utility function for conditional class names
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Detect column type based on content
export function detectColumnType(columnName: string, sampleValues: string[]): ColumnInfo['type'] {
  const lowerName = columnName.toLowerCase();
  
  // Check column name first
  if (lowerName.includes('email') || lowerName.includes('e-mail')) {
    return 'email';
  }
  
  if (lowerName.includes('website') || lowerName.includes('url') || lowerName.includes('site')) {
    return 'website';
  }
  
  if (lowerName.includes('address') || lowerName.includes('street') || lowerName.includes('addr')) {
    return 'address';
  }
  
  // Check sample values
  const nonEmptyValues = sampleValues.filter(v => v && v.trim());
  if (nonEmptyValues.length === 0) return 'other';
  
  // Email detection
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailCount = nonEmptyValues.filter(v => emailPattern.test(v)).length;
  if (emailCount / nonEmptyValues.length > 0.5) {
    return 'email';
  }
  
  // Website detection
  const urlPattern = /^(https?:\/\/)|(www\.)|([a-z0-9-]+\.[a-z]{2,})/i;
  const urlCount = nonEmptyValues.filter(v => urlPattern.test(v)).length;
  if (urlCount / nonEmptyValues.length > 0.5) {
    return 'website';
  }
  
  return 'text';
}

// Analyze CSV data to extract column information
export function analyzeCSVData(data: CSVRow[]): ColumnInfo[] {
  if (data.length === 0) return [];
  
  const headers = Object.keys(data[0]);
  const sampleSize = Math.min(100, data.length);
  
  return headers.map(header => {
    const sampleValues = data
      .slice(0, sampleSize)
      .map(row => String(row[header] || ''));
    
    return {
      name: header,
      type: detectColumnType(header, sampleValues),
    };
  });
}

// Auto-detect common column names
export function autoDetectColumns(headers: string[]): {
  companyName?: string;
  city?: string;
  state?: string;
  address1?: string;
  address2?: string;
} {
  const detected: {
    companyName?: string;
    city?: string;
    state?: string;
    address1?: string;
    address2?: string;
  } = {};
  
  const lowerHeaders = headers.map(h => h.toLowerCase());
  
  // Company name detection
  const companyPatterns = ['company', 'business', 'organization', 'org', 'firm', 'entity'];
  for (let i = 0; i < lowerHeaders.length; i++) {
    if (companyPatterns.some(p => lowerHeaders[i].includes(p))) {
      detected.companyName = headers[i];
      break;
    }
  }
  
  // City detection
  const cityPatterns = ['city', 'municipality'];
  for (let i = 0; i < lowerHeaders.length; i++) {
    if (cityPatterns.some(p => lowerHeaders[i].includes(p))) {
      detected.city = headers[i];
      break;
    }
  }
  
  // State detection
  const statePatterns = ['state', 'province', 'region'];
  for (let i = 0; i < lowerHeaders.length; i++) {
    if (statePatterns.some(p => lowerHeaders[i].includes(p))) {
      detected.state = headers[i];
      break;
    }
  }
  
  // Address detection
  const address1Patterns = ['address1', 'address 1', 'street', 'address line 1'];
  const address2Patterns = ['address2', 'address 2', 'address line 2', 'suite'];
  
  for (let i = 0; i < lowerHeaders.length; i++) {
    if (address1Patterns.some(p => lowerHeaders[i].includes(p))) {
      detected.address1 = headers[i];
    }
    if (address2Patterns.some(p => lowerHeaders[i].includes(p))) {
      detected.address2 = headers[i];
    }
  }
  
  // If no address1 found, look for generic 'address'
  if (!detected.address1) {
    for (let i = 0; i < lowerHeaders.length; i++) {
      if (lowerHeaders[i] === 'address' || lowerHeaders[i] === 'addr') {
        detected.address1 = headers[i];
        break;
      }
    }
  }
  
  return detected;
}

// Format bytes to human readable
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Generate unique ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Escape RegExp special characters
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract hyperlink from various formats
export function extractHyperlink(value: string): { text: string; url: string; domain: string } | null {
  const trimmed = value.trim();
  
  // Excel HYPERLINK formula: =HYPERLINK("url","text")
  const excelPattern = /=HYPERLINK\("([^"]+)","([^"]+)"\)/i;
  const excelMatch = trimmed.match(excelPattern);
  if (excelMatch) {
    const url = excelMatch[1];
    const text = excelMatch[2];
    const domain = extractDomainFromUrl(url);
    return { text, url, domain };
  }
  
  // HTML anchor: <a href="url">text</a>
  const htmlPattern = /<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i;
  const htmlMatch = trimmed.match(htmlPattern);
  if (htmlMatch) {
    const url = htmlMatch[1];
    const text = htmlMatch[2];
    const domain = extractDomainFromUrl(url);
    return { text, url, domain };
  }
  
  return null;
}

// Extract domain from URL
export function extractDomainFromUrl(url: string): string {
  try {
    let cleanUrl = url.trim();
    
    // Add protocol if missing
    if (!cleanUrl.match(/^https?:\/\//i)) {
      cleanUrl = 'http://' + cleanUrl;
    }
    
    const urlObj = new URL(cleanUrl);
    return urlObj.hostname.replace(/^www\./i, '');
  } catch (e) {
    // If URL parsing fails, try simple extraction
    let domain = url.replace(/^https?:\/\//i, '');
    domain = domain.replace(/^www\./i, '');
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    domain = domain.split('#')[0];
    return domain;
  }
}

// Detect reference file columns with flexible matching
export function detectReferenceColumns(headers: string[]): {
  city: string | null;
  state: string | null;
  cityState: string | null;
} {
  const lowerHeaders = headers.map(h => h.toLowerCase().replace(/[_\s-]/g, ''));
  
  const detected = {
    city: null as string | null,
    state: null as string | null,
    cityState: null as string | null,
  };
  
  // City patterns (case-insensitive, flexible)
  const cityPatterns = ['city', 'cityname', 'municipality'];
  for (let i = 0; i < lowerHeaders.length; i++) {
    for (const pattern of cityPatterns) {
      if (lowerHeaders[i].includes(pattern)) {
        detected.city = headers[i];
        break;
      }
    }
    if (detected.city) break;
  }
  
  // State patterns (case-insensitive, flexible)
  const statePatterns = ['state', 'statename', 'statefull', 'statelong', 'province'];
  for (let i = 0; i < lowerHeaders.length; i++) {
    for (const pattern of statePatterns) {
      if (lowerHeaders[i].includes(pattern)) {
        detected.state = headers[i];
        break;
      }
    }
    if (detected.state) break;
  }
  
  // City_State patterns (case-insensitive, flexible)
  const cityStatePatterns = ['citystate', 'city_state', 'cityst'];
  for (let i = 0; i < lowerHeaders.length; i++) {
    for (const pattern of cityStatePatterns) {
      if (lowerHeaders[i].includes(pattern)) {
        detected.cityState = headers[i];
        break;
      }
    }
    if (detected.cityState) break;
  }
  
  return detected;
}

// Common stopwords for word frequency analysis
export const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
  'had', 'what', 'when', 'where', 'who', 'which', 'why', 'how',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'can', 'just', 'should', 'now'
]);

// Tokenize text for word frequency
export function tokenizeText(text: string, excludeStopwords: boolean = false): string[] {
  // Convert to lowercase and extract words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/) // Split on whitespace
    .filter(word => word.length > 2); // Filter out very short words
  
  if (excludeStopwords) {
    return words.filter(word => !STOPWORDS.has(word));
  }
  
  return words;
}

// Format timestamp for filename
export function formatTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

// Validate filename
export function validateFilename(filename: string): boolean {
  // Only allow alphanumeric, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(filename);
}

