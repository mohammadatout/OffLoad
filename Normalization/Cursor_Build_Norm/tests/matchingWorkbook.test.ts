import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { MatchResult } from '@/lib/matchingTypes';
import { buildMatchingExportTables } from '@/lib/matchingOutput';
import { buildMatchingWorkbook } from '@/lib/matchingWorkbook';

function matchedOnlyResults(): MatchResult[] {
  return [
    {
      Name: 'ACME LABS',
      Match_Status: 'Matched',
      Matched_Name: 'ACME LABS',
      Confidence_Score: 0.97,
      Match_Stage: 'verified_library',
      State: 'CA',
      Context_Notes: '',
      Top_3_Candidates: '',
      SAVM_Group_ID: 'SAVM-100',
      SAVM_Group_Name: 'ACME LABS',
      AM_Name: 'Alex Owner',
      AM_Email: 'alex.owner@example.com',
    },
  ];
}

describe('matching workbook contract', () => {
  it('builds three named sheets and MATCHED_ filename prefix', () => {
    const tables = buildMatchingExportTables(
      matchedOnlyResults(),
      'Name',
      'Company Name',
      null
    );
    const { workbook, fileName } = buildMatchingWorkbook(tables, 'My Upload.csv', 'Jan_15');

    expect(fileName).toBe('MATCHED_My_Upload_Jan_15.xlsx');
    expect(workbook.SheetNames).toEqual(['Primary', 'Detail', 'Unmatched']);
  });

  it('keeps unmatched sheet headers even when there are no unmatched rows', () => {
    const tables = buildMatchingExportTables(
      matchedOnlyResults(),
      'Name',
      'Company Name',
      null
    );
    const { workbook } = buildMatchingWorkbook(tables, 'My Upload.csv', 'Jan_15');

    const unmatchedSheet = workbook.Sheets.Unmatched;
    const matrix = XLSX.utils.sheet_to_json(unmatchedSheet, { header: 1 }) as string[][];
    expect(matrix[0]).toContain('reason');
    expect(matrix[0]).toContain('match status');
  });
});
