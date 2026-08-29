import { describe, expect, it } from 'vitest';

import {
  MONOSPACE_COLUMNS,
  NUMERIC_COLUMNS,
  SECONDARY_LINE,
  allocationCellValue,
  labelFor,
  salesHierarchy,
  verticalLabel,
} from '@/lib/allocationColumns';
import { CiscoAccount } from '@/lib/libraryTypes';

function account(overrides: Partial<CiscoAccount> = {}): CiscoAccount {
  return {
    id: 1,
    account_id: 1,
    savm_group_id: '700000001',
    savm_group_name: 'ALPHA GROUP',
    sfdc_account_name: 'ALPHA HOLDINGS INC',
    unified_account_name: 'ALPHA HOLDINGS',
    state: 'TX',
    vertical: 'RETAIL',
    segment: 'COMMERCIAL',
    tier: 'COM-FOCUS',
    source: 'SAV+SFDC',
    node_id: '200283765',
    sl1: 'Americas',
    sl2: 'US COMMERCIAL',
    sl3: 'COMMERCIAL EAST AREA',
    sl4: 'TRI-STATE COMMERCIAL OPERATION',
    sl5: 'PHILADELPHIA REGION',
    sl6: 'CEA_PHILADELPHIA 1',
    am_cec: 'aeone',
    am_name: 'AE One',
    am_email: 'ae.one@example.com',
    am_job_title: 'Account Executive',
    am_confidence: 'HIGH',
    am_priority: 2,
    am_reason: 'GS + SFDC agreement',
    exists_in_sav: 'YES',
    exists_in_sfdc: 'YES',
    ...overrides,
  };
}

describe('vertical labels', () => {
  it('maps the codes present in the current reference export', () => {
    expect(verticalLabel('RETAIL')).toBe('RETAIL — Retail');
    expect(verticalLabel('PROF_SRV')).toBe('PROF_SRV — Professional Services');
    expect(verticalLabel('ENG/UTL')).toBe('ENG/UTL — Energy & Utilities');
    expect(verticalLabel('HLTH_CARE')).toBe('HLTH_CARE — Healthcare');
    expect(verticalLabel('MFG')).toBe('MFG — Manufacturing');
  });

  it('passes unknown codes through rather than blanking them', () => {
    expect(verticalLabel('NEW_CODE')).toBe('NEW_CODE');
  });

  it('renders nothing for a missing vertical', () => {
    expect(verticalLabel(null)).toBe('');
    expect(verticalLabel(undefined)).toBe('');
  });
});

describe('sales hierarchy', () => {
  it('joins sl1 through sl6', () => {
    expect(salesHierarchy(account())).toBe(
      'Americas › US COMMERCIAL › COMMERCIAL EAST AREA › TRI-STATE COMMERCIAL OPERATION › PHILADELPHIA REGION › CEA_PHILADELPHIA 1'
    );
  });

  it('skips missing levels rather than leaving gaps', () => {
    expect(salesHierarchy(account({ sl3: null, sl4: null, sl5: null, sl6: null }))).toBe(
      'Americas › US COMMERCIAL'
    );
  });

  it('honours a level cap', () => {
    expect(salesHierarchy(account(), 3)).toBe(
      'Americas › US COMMERCIAL › COMMERCIAL EAST AREA'
    );
  });
});

describe('cell values', () => {
  it('renders the composite hierarchy column', () => {
    expect(allocationCellValue(account(), 'sales_hierarchy')).toContain('Americas ›');
  });

  it('labels the vertical column', () => {
    expect(allocationCellValue(account(), 'vertical')).toBe('RETAIL — Retail');
  });

  it('stringifies numbers', () => {
    expect(allocationCellValue(account(), 'am_priority')).toBe('2');
  });

  it('returns an empty string for null, empty, and unknown keys', () => {
    expect(allocationCellValue(account({ am_name: null }), 'am_name')).toBe('');
    expect(allocationCellValue(account({ state: '' }), 'state')).toBe('');
    expect(allocationCellValue(account(), 'not_a_column')).toBe('');
  });
});

describe('column presentation', () => {
  it('pairs the AE name with its email and the SAV ID with the SAV name', () => {
    expect(SECONDARY_LINE.am_name).toBe('am_email');
    expect(SECONDARY_LINE.savm_group_id).toBe('savm_group_name');
  });

  it('treats nomination numbers as numeric and identifiers as monospace', () => {
    expect(NUMERIC_COLUMNS.has('am_priority')).toBe(true);
    expect(MONOSPACE_COLUMNS.has('savm_group_id')).toBe(true);
    expect(MONOSPACE_COLUMNS.has('unified_account_name')).toBe(false);
  });
});

describe('labelFor', () => {
  const available = [
    { key: 'savm_group_id', label: 'SAV ID', group: 'Identity' },
    { key: 'state', label: 'State', group: 'Attributes' },
  ];

  it('resolves a label from the server catalogue', () => {
    expect(labelFor('savm_group_id', available)).toBe('SAV ID');
  });

  it('falls back to the key when the catalogue has not loaded', () => {
    expect(labelFor('tier', available)).toBe('tier');
    expect(labelFor('tier', [])).toBe('tier');
  });
});
