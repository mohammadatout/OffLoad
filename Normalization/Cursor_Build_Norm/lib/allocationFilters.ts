import { AccountFilters } from './libraryTypes';

/**
 * AE Allocation opens unfiltered.
 *
 * It previously opened on a preset slice (`SAV+SFDC` + `US PS Market Segment`),
 * but those values do not exist in the current reference export, so the preset
 * showed an empty table. Reset now clears every filter rather than restoring a
 * preset, which makes the default and the reset target the same state.
 */
export const DEFAULT_ALLOCATION_FILTERS: AccountFilters = {};

/**
 * Filter order as rendered, with the labels the business uses. The sales
 * hierarchy comes first because selecting a level cascades into the ones below.
 */
export const ALLOCATION_FILTER_ORDER = [
  { key: 'sl2', label: 'Theater - SL2' },
  { key: 'sl3', label: 'Area - SL3' },
  { key: 'sl4', label: 'Operation - SL4' },
  { key: 'sl5', label: 'Region - SL5' },
  { key: 'sl6', label: 'Account - SL6' },
  { key: 'savm_group_id', label: 'SAV ID' },
  { key: 'unified_account_name', label: 'Unified Acc. Name' },
  { key: 'state', label: 'State' },
  { key: 'source', label: 'Source' },
  { key: 'tier', label: 'Tier' },
  { key: 'vertical', label: 'SAV Vertical' },
] as const;

export type UrlFilterKey =
  | 'search'
  | 'state'
  | 'vertical'
  | 'tier'
  | 'source'
  | 'sl2'
  | 'sl3'
  | 'sl4'
  | 'sl5'
  | 'sl6'
  | 'savm_group_id'
  | 'unified_account_name';

export const URL_FILTER_KEYS: UrlFilterKey[] = [
  'search',
  'sl2',
  'sl3',
  'sl4',
  'sl5',
  'sl6',
  'savm_group_id',
  'unified_account_name',
  'state',
  'source',
  'tier',
  'vertical',
];

/** Levels that clear their descendants when changed. */
export const HIERARCHY_LEVELS = ['sl2', 'sl3', 'sl4', 'sl5', 'sl6'] as const;
export type HierarchyLevel = (typeof HIERARCHY_LEVELS)[number];

interface SearchParamReader {
  get(name: string): string | null;
}

export function parseAllocationUrlState(searchParams: SearchParamReader): {
  filters: AccountFilters;
  page: number;
} {
  const filters: AccountFilters = {};
  URL_FILTER_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) filters[key] = value;
  });

  const rawPage = Number(searchParams.get('page') ?? '0');
  const page = Number.isFinite(rawPage) && rawPage >= 0 ? rawPage : 0;
  return { filters, page };
}

export function buildAllocationQueryString(filters: AccountFilters, page: number): string {
  const query = new URLSearchParams();

  URL_FILTER_KEYS.forEach((key) => {
    const raw = filters[key];
    if (typeof raw === 'string' && raw.trim()) {
      query.set(key, raw.trim());
    }
  });

  if (page > 0) {
    query.set('page', String(page));
  }

  return query.toString();
}

/** True when no filter is applied, i.e. the view is showing everything. */
export function isUnfiltered(filters: AccountFilters): boolean {
  return !URL_FILTER_KEYS.some((key) => {
    const raw = filters[key];
    return typeof raw === 'string' && raw.trim().length > 0;
  });
}

/**
 * Clear the levels below the one just changed. A stale `sl5` under a new `sl2`
 * would otherwise filter to nothing.
 */
export function clearDescendantLevels(
  filters: AccountFilters,
  level: HierarchyLevel
): AccountFilters {
  const next: AccountFilters = { ...filters };
  const startIndex = HIERARCHY_LEVELS.indexOf(level) + 1;
  HIERARCHY_LEVELS.slice(startIndex).forEach((descendant) => {
    delete next[descendant];
  });
  return next;
}
