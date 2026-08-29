import { CiscoAccount } from './libraryTypes';

/**
 * Rendering rules for the AE Allocation columns.
 *
 * The catalogue and labels come from the server so the picker and the SQL agree
 * on one list. What lives here is how a column turns into text, which the table
 * and the workbook export both need to answer the same way.
 */

/** Rendered from sl1-sl6 rather than read from a single column. */
export const SALES_HIERARCHY_KEY = 'sales_hierarchy';

/** `vertical` stores codes; unknown codes fall through unchanged. */
export const VERTICAL_LABELS: Record<string, string> = {
  ED: 'ED — Education',
  GOVT: 'GOVT — Government',
  HLTH_CARE: 'HLTH_CARE — Healthcare',
  FIN_SRV: 'FIN_SRV — Financial Services',
  'ENG/UTL': 'ENG/UTL — Energy & Utilities',
  MFG: 'MFG — Manufacturing',
  ENT: 'ENT — Enterprise',
  RETAIL: 'RETAIL — Retail',
  PROF_SRV: 'PROF_SRV — Professional Services',
  TRANSPORT: 'TRANSPORT — Transportation',
  MEDIA: 'MEDIA — Media & Entertainment',
};

export function verticalLabel(code: string | null | undefined): string {
  if (!code) return '';
  return VERTICAL_LABELS[code] ?? code;
}

/** Columns that show a second, quieter line beneath the main value. */
export const SECONDARY_LINE: Record<string, keyof CiscoAccount> = {
  am_name: 'am_email',
  savm_group_id: 'savm_group_name',
};

export function salesHierarchy(account: CiscoAccount, levels = 6): string {
  return [account.sl1, account.sl2, account.sl3, account.sl4, account.sl5, account.sl6]
    .slice(0, levels)
    .filter(Boolean)
    .join(' › ');
}

/**
 * The text a column shows for one account. Shared by the table and the export
 * so a downloaded workbook matches what was on screen.
 */
export function allocationCellValue(account: CiscoAccount, key: string): string {
  if (key === SALES_HIERARCHY_KEY) return salesHierarchy(account);
  if (key === 'vertical') return verticalLabel(account.vertical);

  const raw = (account as unknown as Record<string, unknown>)[key];
  if (raw === null || raw === undefined || raw === '') return '';
  return String(raw);
}

/** Right-align numeric columns in the table. */
export const NUMERIC_COLUMNS = new Set(['am_priority', 'am_candidate_rank']);

/** Columns rendered in a monospace face because they are identifiers. */
export const MONOSPACE_COLUMNS = new Set([
  'savm_group_id',
  'sfdc_savm_id',
  'node_id',
  'am_priority',
  'am_candidate_rank',
]);

export function labelFor(
  key: string,
  available: { key: string; label: string }[]
): string {
  return available.find((column) => column.key === key)?.label ?? key;
}
