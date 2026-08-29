import * as XLSX from 'xlsx';

import { MatchingExportTables } from './matchingOutput';
import { formatMonthDayTag, toSlugBaseName } from './utils';

type Row = Record<string, unknown>;

export function headersForRows(rows: Row[]): string[] {
  const seen = new Set<string>();
  const headers: string[] = [];
  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (seen.has(key)) return;
      seen.add(key);
      headers.push(key);
    });
  });
  return headers;
}

export function buildMatchingWorkbook(
  tables: MatchingExportTables,
  externalFileName: string,
  dateTag: string = formatMonthDayTag()
): { workbook: XLSX.WorkBook; fileName: string } {
  const workbook = XLSX.utils.book_new();
  const primaryHeaders = tables.selectedPrimaryColumns;
  const detailHeaders = headersForRows(tables.detailRows as Row[]);
  const unmatchedHeaders = headersForRows(tables.unmatchedRows as Row[]);
  const unmatchedSheetHeaders =
    unmatchedHeaders.length > 0 ? unmatchedHeaders : [...detailHeaders, 'reason'];

  const primarySheet = XLSX.utils.json_to_sheet(tables.primaryRows, { header: primaryHeaders });
  const detailSheet = XLSX.utils.json_to_sheet(tables.detailRows, { header: detailHeaders });
  const unmatchedSheet = XLSX.utils.json_to_sheet(tables.unmatchedRows, {
    header: unmatchedSheetHeaders,
  });

  XLSX.utils.book_append_sheet(workbook, primarySheet, 'Primary');
  XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detail');
  XLSX.utils.book_append_sheet(workbook, unmatchedSheet, 'Unmatched');

  const baseName = toSlugBaseName(externalFileName || 'matching_results');
  const fileName = `MATCHED_${baseName}_${dateTag}.xlsx`;
  return { workbook, fileName };
}
