import { MatchResult } from './matchingTypes';

type Row = Record<string, string | number | boolean | null | undefined>;

export const DEFAULT_PRIMARY_COLUMNS = [
  'SAVM ID',
  'ORIGINAL entity name',
  'SAVM name',
  'account owner',
];

const SYSTEM_KEYS = new Set([
  'Match_Status',
  'Matched_Name',
  'Confidence_Score',
  'Match_Stage',
  'State',
  'Context_Notes',
  'Top_3_Candidates',
  'Review_Decision',
  'Review_Selected',
  'Review_Required',
  'State_Mismatch_Flag',
  'Library_Note',
  'Library_Match_ID',
  'SAVM_Group_ID',
  'SAVM_Group_Name',
  'Match_Level',
  'AM_Name',
  'AM_Email',
  'AM_Confidence',
  'AM_Source_Account',
  'Staged_Match_ID',
  'Staged_Status',
]);

function toPercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10000) / 100;
}

export function buildTaggedOrderedRow(
  row: MatchResult | Row,
  externalCol: string,
  internalCol: string
): Row {
  const input = row as Row;
  const tagged: Row = {};

  Object.entries(input).forEach(([key, value]) => {
    if (SYSTEM_KEYS.has(key)) {
      tagged[key] = value;
      return;
    }
    if (key.startsWith('External_')) {
      const internalKey = `Internal_${key.slice('External_'.length)}`;
      tagged[internalKey] = value;
      return;
    }
    tagged[`External_${key}`] = value;
  });

  const externalFieldKey = `External_${externalCol}`;
  const matchedInternalKey = `Matched_Internal_${internalCol}`;
  const ordered: Row = {
    [externalFieldKey]: tagged[externalFieldKey] ?? '',
    'Match_%': toPercent(tagged.Confidence_Score),
    [matchedInternalKey]: tagged.Matched_Name ?? '',
    Match_Stage: tagged.Match_Stage ?? '',
  };

  const internalKeys = Object.keys(tagged)
    .filter((k) => k.startsWith('Internal_') && k !== matchedInternalKey)
    .sort();
  const externalKeys = Object.keys(tagged)
    .filter((k) => k.startsWith('External_') && k !== externalFieldKey)
    .sort();
  const middleKeys = Object.keys(tagged).filter(
    (k) =>
      !k.startsWith('Internal_') &&
      !k.startsWith('External_') &&
      !['Match_Stage', 'Matched_Name', 'Confidence_Score'].includes(k)
  );

  internalKeys.forEach((k) => {
    ordered[k] = tagged[k];
  });
  middleKeys.forEach((k) => {
    ordered[k] = tagged[k];
  });
  externalKeys.forEach((k) => {
    ordered[k] = tagged[k];
  });

  return ordered;
}

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  return String(value);
}

function originalEntityName(result: MatchResult, externalCol: string): string {
  const direct = result[externalCol];
  if (direct != null && direct !== '') return asText(direct);
  const tagged = result[`External_${externalCol}`];
  if (tagged != null && tagged !== '') return asText(tagged);
  return '';
}

function matchedSavmName(result: MatchResult): string {
  const explicit = result['SAVM_Group_Name'];
  if (explicit != null && explicit !== '') return asText(explicit);
  return asText(result.Matched_Name);
}

function accountOwner(result: MatchResult): string {
  const owner = result['AM_Name'];
  if (owner != null && owner !== '') return asText(owner);
  return asText(result['AM_Email']);
}

function unmatchedReason(result: MatchResult): string {
  const status = asText(result.Match_Status);
  const explicit =
    asText(result.Context_Notes) ||
    asText(result['Library_Note']) ||
    asText(result.State_Mismatch_Flag);
  if (status.toLowerCase() === 'matched') return '';
  return explicit || 'No match produced in enabled stages.';
}

function toDetailRow(result: MatchResult, externalCol: string, internalCol: string): Row {
  const ordered = buildTaggedOrderedRow(result, externalCol, internalCol);
  return {
    'SAVM ID': asText(result['SAVM_Group_ID']),
    'ORIGINAL entity name': originalEntityName(result, externalCol),
    'SAVM name': matchedSavmName(result),
    'account owner': accountOwner(result),
    'account owner email': asText(result['AM_Email']),
    'match status': asText(result.Match_Status),
    'match stage': asText(result.Match_Stage),
    'unmatched reason': unmatchedReason(result),
    ...ordered,
  };
}

function dedupePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  values.forEach((value) => {
    if (seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  });
  return ordered;
}

export interface MatchingExportTables {
  primaryRows: Row[];
  detailRows: Row[];
  unmatchedRows: Row[];
  availablePrimaryColumns: string[];
  selectedPrimaryColumns: string[];
}

export function buildMatchingExportTables(
  results: MatchResult[],
  externalCol: string,
  internalCol: string,
  selectedColumns: string[] | null
): MatchingExportTables {
  const detailRows = results.map((result) => toDetailRow(result, externalCol, internalCol));
  const dynamicColumns = dedupePreserveOrder(detailRows.flatMap((row) => Object.keys(row)));
  const availablePrimaryColumns = dedupePreserveOrder([
    ...DEFAULT_PRIMARY_COLUMNS,
    ...dynamicColumns,
  ]);

  const validSelected =
    selectedColumns?.filter((column) => availablePrimaryColumns.includes(column)) ?? [];
  const selectedPrimaryColumns =
    validSelected.length > 0 ? validSelected : [...DEFAULT_PRIMARY_COLUMNS];

  const primaryRows = detailRows.map((row) => {
    const projected: Row = {};
    selectedPrimaryColumns.forEach((column) => {
      projected[column] = row[column] ?? '';
    });
    return projected;
  });

  const unmatchedRows = detailRows
    .filter((row) => asText(row['match status']).toLowerCase() !== 'matched')
    .map((row) => ({
      ...row,
      reason: asText(row['unmatched reason']),
    }));

  return {
    primaryRows,
    detailRows,
    unmatchedRows,
    availablePrimaryColumns,
    selectedPrimaryColumns,
  };
}
