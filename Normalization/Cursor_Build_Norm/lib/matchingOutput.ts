import { MatchResult } from './matchingTypes';

type Row = Record<string, string | number | null | undefined>;

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
