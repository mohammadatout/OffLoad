import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRIMARY_COLUMNS,
  buildMatchingExportTables,
} from '@/lib/matchingOutput';
import { MatchResult } from '@/lib/matchingTypes';

function sampleResults(): MatchResult[] {
  return [
    {
      Name: 'CA-ALPHA ORGANIZATION',
      Match_Status: 'Matched',
      Matched_Name: 'ALPHA GROUP',
      Confidence_Score: 0.98,
      Match_Stage: 'verified_library',
      State: 'CA',
      Context_Notes: '',
      Top_3_Candidates: '',
      SAVM_Group_ID: 'SID-1',
      SAVM_Group_Name: 'ALPHA GROUP',
      AM_Name: 'Owner One',
      AM_Email: 'owner.one@example.com',
    },
    {
      Name: 'TX-UNKNOWN ORG',
      Match_Status: 'Unmatched',
      Matched_Name: '',
      Confidence_Score: 0,
      Match_Stage: 'exact_fuzzy_94',
      State: 'TX',
      Context_Notes: 'No candidates above threshold.',
      Top_3_Candidates: '',
      SAVM_Group_ID: '',
      SAVM_Group_Name: '',
      AM_Name: '',
      AM_Email: '',
    },
  ];
}

describe('matching output workbook contracts', () => {
  it('builds default primary/detail/unmatched tables with expected defaults', () => {
    const tables = buildMatchingExportTables(
      sampleResults(),
      'Name',
      'Company Name',
      null
    );

    expect(tables.selectedPrimaryColumns).toEqual(DEFAULT_PRIMARY_COLUMNS);
    expect(tables.primaryRows).toHaveLength(2);
    expect(tables.detailRows).toHaveLength(2);
    expect(tables.unmatchedRows).toHaveLength(1);

    expect(tables.primaryRows[0]['SAVM ID']).toBe('SID-1');
    expect(tables.primaryRows[0]['ORIGINAL entity name']).toBe(
      'CA-ALPHA ORGANIZATION'
    );
    expect(tables.unmatchedRows[0].reason).toBe('No candidates above threshold.');
  });

  it('applies selected primary columns without dropping detail sheet columns', () => {
    const selected = ['SAVM ID', 'ORIGINAL entity name'];
    const tables = buildMatchingExportTables(
      sampleResults(),
      'Name',
      'Company Name',
      selected
    );

    expect(tables.selectedPrimaryColumns).toEqual(selected);
    expect(Object.keys(tables.primaryRows[0])).toEqual(selected);
    expect(tables.detailRows[0]['account owner']).toBe('Owner One');
    expect(tables.detailRows[0]['match status']).toBe('Matched');
  });
});
