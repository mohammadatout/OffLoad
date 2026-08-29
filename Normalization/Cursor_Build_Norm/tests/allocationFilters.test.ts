import { describe, expect, it } from 'vitest';

import {
  ALLOCATION_FILTER_ORDER,
  DEFAULT_ALLOCATION_FILTERS,
  URL_FILTER_KEYS,
  buildAllocationQueryString,
  clearDescendantLevels,
  isUnfiltered,
  parseAllocationUrlState,
} from '@/lib/allocationFilters';

describe('allocation filter URL contracts', () => {
  it('opens unfiltered when the URL carries no filters', () => {
    const state = parseAllocationUrlState(new URLSearchParams(''));
    expect(state.filters).toEqual(DEFAULT_ALLOCATION_FILTERS);
    expect(state.filters).toEqual({});
    expect(state.page).toBe(0);
  });

  it('parses filters and page from the URL', () => {
    const state = parseAllocationUrlState(
      new URLSearchParams('source=SAV%2BSFDC&sl2=US+COMMERCIAL&sl4=STR_RED+RIVER+OPERATION&page=2')
    );
    expect(state.filters).toEqual({
      source: 'SAV+SFDC',
      sl2: 'US COMMERCIAL',
      sl4: 'STR_RED RIVER OPERATION',
    });
    expect(state.page).toBe(2);
  });

  it('round-trips every filter through the builder and parser', () => {
    const filters = {
      search: 'beta',
      sl2: 'US COMMERCIAL',
      sl3: 'COMMERCIAL EAST AREA',
      sl4: 'TRI-STATE COMMERCIAL OPERATION',
      sl5: 'PHILADELPHIA REGION',
      sl6: 'CEA_PHILADELPHIA 1',
      savm_group_id: '700000001',
      unified_account_name: 'ALPHA HOLDINGS',
      state: 'TX',
      source: 'SAV+SFDC',
      tier: 'COM-FOCUS',
      vertical: 'RETAIL',
    };
    const parsed = parseAllocationUrlState(
      new URLSearchParams(buildAllocationQueryString(filters, 3))
    );
    expect(parsed.filters).toEqual(filters);
    expect(parsed.page).toBe(3);
  });

  it('omits the page parameter on the first page', () => {
    expect(buildAllocationQueryString({ state: 'TX' }, 0)).toBe('state=TX');
    expect(buildAllocationQueryString({}, 0)).toBe('');
  });

  it('drops blank and whitespace-only filter values', () => {
    expect(buildAllocationQueryString({ state: '   ', source: 'SAV+SFDC' }, 0)).toBe(
      'source=SAV%2BSFDC'
    );
  });

  it('no longer carries a segment filter', () => {
    expect(URL_FILTER_KEYS).not.toContain('segment');
    expect(ALLOCATION_FILTER_ORDER.map((entry) => entry.key)).not.toContain('segment');
    const parsed = parseAllocationUrlState(new URLSearchParams('segment=COMMERCIAL'));
    expect(parsed.filters).toEqual({});
  });
});

describe('filter order and labels', () => {
  it('renders the hierarchy first, then identity, then attributes', () => {
    expect(ALLOCATION_FILTER_ORDER.map((entry) => entry.key)).toEqual([
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
    ]);
  });

  it('uses the business labels rather than the column names', () => {
    const labels = Object.fromEntries(
      ALLOCATION_FILTER_ORDER.map((entry) => [entry.key, entry.label])
    );
    expect(labels.sl2).toBe('Theater - SL2');
    expect(labels.sl3).toBe('Area - SL3');
    expect(labels.sl4).toBe('Operation - SL4');
    expect(labels.sl5).toBe('Region - SL5');
    expect(labels.sl6).toBe('Account - SL6');
    expect(labels.savm_group_id).toBe('SAV ID');
    expect(labels.unified_account_name).toBe('Unified Acc. Name');
    expect(labels.state).toBe('State');
    expect(labels.tier).toBe('Tier');
    expect(labels.vertical).toBe('SAV Vertical');
  });
});

describe('isUnfiltered', () => {
  it('is true for an empty filter set and for blank values', () => {
    expect(isUnfiltered({})).toBe(true);
    expect(isUnfiltered({ state: '', sl2: '   ' })).toBe(true);
  });

  it('is false as soon as one filter has a value', () => {
    expect(isUnfiltered({ state: 'TX' })).toBe(false);
    expect(isUnfiltered({ search: 'beta' })).toBe(false);
  });
});

describe('hierarchy cascade', () => {
  const full = {
    sl2: 'US COMMERCIAL',
    sl3: 'COMMERCIAL EAST AREA',
    sl4: 'TRI-STATE COMMERCIAL OPERATION',
    sl5: 'PHILADELPHIA REGION',
    sl6: 'CEA_PHILADELPHIA 1',
    state: 'TX',
  };

  it('clears every level below the one that changed', () => {
    expect(clearDescendantLevels(full, 'sl2')).toEqual({
      sl2: 'US COMMERCIAL',
      state: 'TX',
    });
    expect(clearDescendantLevels(full, 'sl4')).toEqual({
      sl2: 'US COMMERCIAL',
      sl3: 'COMMERCIAL EAST AREA',
      sl4: 'TRI-STATE COMMERCIAL OPERATION',
      state: 'TX',
    });
  });

  it('leaves non-hierarchy filters untouched', () => {
    expect(clearDescendantLevels(full, 'sl6').state).toBe('TX');
  });

  it('does not mutate the input', () => {
    const input = { ...full };
    clearDescendantLevels(input, 'sl2');
    expect(input).toEqual(full);
  });
});
