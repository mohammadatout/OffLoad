import { Abbreviation, CumulativeStats, SavedConfiguration, ProcessingConfig } from './types';

// Storage keys
const STORAGE_KEYS = {
  ABBREVIATIONS: 'entitymatch_abbreviations',
  LEGAL_ENTITIES: 'entitymatch_legal_entities',
  THEME: 'entitymatch_theme',
  CUMULATIVE_STATS: 'entitymatch_cumulative_stats',
  SAVED_CONFIGS: 'entitymatch_saved_configs',
  LAST_CONFIG: 'entitymatch_last_config',
} as const;

export const SAVED_CONFIGS_EVENT = 'entitymatch-saved-configs-updated';

const DEFAULT_LEGAL_ENTITIES = [
  'LLC', 'L.L.C.', 'L.L.C', 'INC', 'INC.', 'INCORPORATED',
  'CORP', 'CORP.', 'CORPORATION', 'LTD', 'LTD.', 'LIMITED',
  'CO', 'CO.', 'COMPANY', 'LLP', 'L.L.P.', 'LP', 'L.P.',
  'PLC', 'P.L.C.', 'SA', 'S.A.', 'GMBH', 'AG'
];

const normalizeLegalEntity = (entity: string): string =>
  entity.trim().toUpperCase();

const normalizeCompanyName = (name: string): string =>
  name.trim().toUpperCase();

const normalizeAbbreviationList = (entries: string[]): string[] =>
  entries
    .map(entry => entry.trim().toUpperCase())
    .filter(Boolean);

export const LEGAL_ENTITIES_EVENT = 'entitymatch-legal-entities-updated';
export const CUMULATIVE_STATS_EVENT = 'entitymatch-cumulative-stats-updated';

const notifyLegalEntitiesUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LEGAL_ENTITIES_EVENT));
  }
};

const notifyCumulativeStatsUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CUMULATIVE_STATS_EVENT));
  }
};

const normalizeAbbreviationRecord = (abbr: Abbreviation): Abbreviation => ({
  ...abbr,
  normalizedCompanyName: normalizeCompanyName(abbr.companyName),
  abbreviations: normalizeAbbreviationList(abbr.abbreviations),
});

// Abbreviation Storage
export const saveAbbreviations = (abbreviations: Abbreviation[]): void => {
  try {
    const normalized = abbreviations.map(normalizeAbbreviationRecord);
    localStorage.setItem(STORAGE_KEYS.ABBREVIATIONS, JSON.stringify(normalized));
  } catch (error) {
    console.error('Failed to save abbreviations:', error);
  }
};

export const loadAbbreviations = (): Abbreviation[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ABBREVIATIONS);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    return parsed.map((abbr: any) => normalizeAbbreviationRecord({
      ...abbr,
      normalizedCompanyName: abbr.normalizedCompanyName ?? normalizeCompanyName(abbr.companyName ?? ''),
      abbreviations: Array.isArray(abbr.abbreviations) ? abbr.abbreviations : [],
      createdAt: new Date(abbr.createdAt),
      updatedAt: new Date(abbr.updatedAt),
    }));
  } catch (error) {
    console.error('Failed to load abbreviations:', error);
    return [];
  }
};

export const addAbbreviation = (companyName: string, abbreviations: string[]): Abbreviation => {
  const allAbbreviations = loadAbbreviations();
  
  const newAbbreviation: Abbreviation = {
    id: `abbr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    companyName,
    normalizedCompanyName: normalizeCompanyName(companyName),
    abbreviations: normalizeAbbreviationList(abbreviations),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  allAbbreviations.push(newAbbreviation);
  saveAbbreviations(allAbbreviations);
  
  return newAbbreviation;
};

export const updateAbbreviation = (id: string, companyName: string, abbreviations: string[]): void => {
  const allAbbreviations = loadAbbreviations();
  const index = allAbbreviations.findIndex(abbr => abbr.id === id);
  
  if (index !== -1) {
    allAbbreviations[index] = {
      ...allAbbreviations[index],
      companyName,
      normalizedCompanyName: normalizeCompanyName(companyName),
      abbreviations: normalizeAbbreviationList(abbreviations),
      updatedAt: new Date(),
    };
    saveAbbreviations(allAbbreviations);
  }
};

export const deleteAbbreviation = (id: string): void => {
  const allAbbreviations = loadAbbreviations();
  const filtered = allAbbreviations.filter(abbr => abbr.id !== id);
  saveAbbreviations(filtered);
};

// Legal Entities Storage
export const saveLegalEntities = (entities: string[]): void => {
  try {
    const normalized = Array.from(
      new Set(
        entities
          .map(normalizeLegalEntity)
          .filter(Boolean)
      )
    );
    localStorage.setItem(STORAGE_KEYS.LEGAL_ENTITIES, JSON.stringify(normalized));
    notifyLegalEntitiesUpdated();
  } catch (error) {
    console.error('Failed to save legal entities:', error);
  }
};

export const loadLegalEntities = (): string[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LEGAL_ENTITIES);
    if (!stored) {
      return DEFAULT_LEGAL_ENTITIES;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.map((item: string) => normalizeLegalEntity(item)).filter(Boolean)
      : DEFAULT_LEGAL_ENTITIES;
  } catch (error) {
    console.error('Failed to load legal entities:', error);
    return [];
  }
};

export const addLegalEntity = (entity: string): void => {
  addLegalEntitiesBulk([entity]);
};

export const removeLegalEntity = (entity: string): void => {
  const entities = loadLegalEntities();
  const normalized = normalizeLegalEntity(entity);
  const filtered = entities.filter(e => e !== normalized);
  saveLegalEntities(filtered);
};

export const addLegalEntitiesBulk = (entitiesToAdd: string[]): string[] => {
  const entities = loadLegalEntities();
  let updated = [...entities];
  let changed = false;
  
  for (const entity of entitiesToAdd) {
    const normalized = normalizeLegalEntity(entity);
    if (!normalized) continue;
    if (!updated.includes(normalized)) {
      updated.push(normalized);
      changed = true;
    }
  }
  
  if (changed) {
    saveLegalEntities(updated);
  }
  
  return updated;
};

// Theme Storage
export const saveTheme = (theme: 'light' | 'dark'): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (error) {
    console.error('Failed to save theme:', error);
  }
};

export const loadTheme = (): 'light' | 'dark' | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.THEME);
    return stored as 'light' | 'dark' | null;
  } catch (error) {
    console.error('Failed to load theme:', error);
    return null;
  }
};

const DEFAULT_CUMULATIVE: CumulativeStats = {
  rowsProcessed: 0,
  companiesCleaned: 0,
  duplicatesRemoved: 0,
};

export const loadCumulativeStats = (): CumulativeStats => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CUMULATIVE_STATS);
    if (!stored) return { ...DEFAULT_CUMULATIVE };
    const parsed = JSON.parse(stored);
    return {
      rowsProcessed: Number(parsed.rowsProcessed) || 0,
      companiesCleaned: Number(parsed.companiesCleaned) || 0,
      duplicatesRemoved: Number(parsed.duplicatesRemoved) || 0,
    };
  } catch (error) {
    console.error('Failed to load cumulative stats:', error);
    return { ...DEFAULT_CUMULATIVE };
  }
};

export const updateCumulativeStats = (delta: Partial<CumulativeStats>): CumulativeStats => {
  const current = loadCumulativeStats();
  const updated: CumulativeStats = {
    rowsProcessed: current.rowsProcessed + (delta.rowsProcessed || 0),
    companiesCleaned: current.companiesCleaned + (delta.companiesCleaned || 0),
    duplicatesRemoved: current.duplicatesRemoved + (delta.duplicatesRemoved || 0),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.CUMULATIVE_STATS, JSON.stringify(updated));
    notifyCumulativeStatsUpdated();
  } catch (error) {
    console.error('Failed to update cumulative stats:', error);
  }
  return updated;
};

// ============================================
// CONFIGURATION MANAGEMENT (Team Sharing)
// ============================================

const notifySavedConfigsUpdated = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SAVED_CONFIGS_EVENT));
  }
};

export const loadSavedConfigurations = (): SavedConfiguration[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SAVED_CONFIGS);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.map((config: any) => ({
      ...config,
      createdAt: new Date(config.createdAt),
      updatedAt: new Date(config.updatedAt),
    }));
  } catch (error) {
    console.error('Failed to load saved configurations:', error);
    return [];
  }
};

export const saveConfiguration = (
  name: string,
  config: ProcessingConfig,
  description?: string,
  createdBy?: string
): SavedConfiguration => {
  const configs = loadSavedConfigurations();
  
  const newConfig: SavedConfiguration = {
    id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy,
    config,
  };
  
  configs.push(newConfig);
  
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_CONFIGS, JSON.stringify(configs));
    notifySavedConfigsUpdated();
  } catch (error) {
    console.error('Failed to save configuration:', error);
  }
  
  return newConfig;
};

export const updateSavedConfiguration = (
  id: string,
  updates: Partial<Omit<SavedConfiguration, 'id' | 'createdAt'>>
): void => {
  const configs = loadSavedConfigurations();
  const index = configs.findIndex(c => c.id === id);
  
  if (index !== -1) {
    configs[index] = {
      ...configs[index],
      ...updates,
      updatedAt: new Date(),
    };
    
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_CONFIGS, JSON.stringify(configs));
      notifySavedConfigsUpdated();
    } catch (error) {
      console.error('Failed to update configuration:', error);
    }
  }
};

export const deleteSavedConfiguration = (id: string): void => {
  const configs = loadSavedConfigurations();
  const filtered = configs.filter(c => c.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEYS.SAVED_CONFIGS, JSON.stringify(filtered));
    notifySavedConfigsUpdated();
  } catch (error) {
    console.error('Failed to delete configuration:', error);
  }
};

export const exportConfigurationToJSON = (config: SavedConfiguration): string => {
  return JSON.stringify(config, null, 2);
};

export const importConfigurationFromJSON = (json: string): SavedConfiguration | null => {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.name || !parsed.config) {
      throw new Error('Invalid configuration format');
    }
    
    // Generate new ID and dates for imported config
    return {
      ...parsed,
      id: `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      name: `${parsed.name} (Imported)`,
    };
  } catch (error) {
    console.error('Failed to import configuration:', error);
    return null;
  }
};

// Save last used configuration for recurring files
export const saveLastConfiguration = (config: ProcessingConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_CONFIG, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save last configuration:', error);
  }
};

export const loadLastConfiguration = (): ProcessingConfig | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_CONFIG);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load last configuration:', error);
    return null;
  }
};

