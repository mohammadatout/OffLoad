import {
  AccountExportResponse,
  AccountFacets,
  AccountFilters,
  AccountListResponse,
  AccountOptionsResponse,
  AllocationColumnSettings,
  BulkApproveResult,
  GroupSummary,
  ImportBatchSummary,
  MatchFilters,
  MatchHistoryItem,
  MatchLibraryItem,
  MatchListResponse,
  PurgeAccountsResult,
  SearchableOptionColumn,
} from './libraryTypes';

import { API_BASE, HEAVY_API_BASE } from './apiBase';

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function checkedFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { credentials: 'include', ...init });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response;
}

function asJsonBody(body: unknown): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function buildMatchQuery(filters: MatchFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.status) query.set('status', filters.status);
  if (filters.search) query.set('search', filters.search);
  if (filters.state) query.set('state', filters.state);
  if (filters.vertical) query.set('vertical', filters.vertical);
  if (filters.tier) query.set('tier', filters.tier);
  if (filters.link_status) query.set('link_status', filters.link_status);
  if (filters.match_level) query.set('match_level', filters.match_level);
  query.set('limit', String(filters.limit ?? 50));
  query.set('offset', String(filters.offset ?? 0));
  return query;
}

export async function fetchMatches(filters: MatchFilters = {}): Promise<MatchListResponse> {
  const response = await checkedFetch(`${API_BASE}/matches?${buildMatchQuery(filters)}`);
  return (await response.json()) as MatchListResponse;
}

export async function updateMatchNotes(
  matchId: number,
  notes: string
): Promise<MatchLibraryItem> {
  const response = await checkedFetch(`${API_BASE}/matches/${matchId}`, {
    method: 'PATCH',
    ...asJsonBody({ notes }),
  });
  return (await response.json()) as MatchLibraryItem;
}

export async function approveMatch(
  matchId: number,
  notes?: string
): Promise<MatchLibraryItem> {
  const response = await checkedFetch(`${API_BASE}/matches/${matchId}/approve`, {
    method: 'POST',
    ...asJsonBody({ notes: notes || null }),
  });
  return (await response.json()) as MatchLibraryItem;
}

export async function rejectMatch(
  matchId: number,
  notes: string
): Promise<MatchLibraryItem> {
  const response = await checkedFetch(`${API_BASE}/matches/${matchId}/reject`, {
    method: 'POST',
    ...asJsonBody({ notes }),
  });
  return (await response.json()) as MatchLibraryItem;
}

export async function deleteMatch(
  matchId: number,
  notes: string
): Promise<MatchLibraryItem> {
  const response = await checkedFetch(`${API_BASE}/matches/${matchId}`, {
    method: 'DELETE',
    ...asJsonBody({ notes }),
  });
  return (await response.json()) as MatchLibraryItem;
}

export async function restoreMatch(matchId: number): Promise<MatchLibraryItem> {
  const response = await checkedFetch(`${API_BASE}/matches/${matchId}/restore`, {
    method: 'POST',
  });
  return (await response.json()) as MatchLibraryItem;
}

export async function bulkApproveMatches(
  ids: number[],
  notes?: string
): Promise<BulkApproveResult> {
  const response = await checkedFetch(`${API_BASE}/matches/bulk-approve`, {
    method: 'POST',
    ...asJsonBody({ ids, notes: notes || null }),
  });
  return (await response.json()) as BulkApproveResult;
}

export async function fetchMatchHistory(matchId: number): Promise<MatchHistoryItem[]> {
  const response = await checkedFetch(`${API_BASE}/matches/${matchId}/history`);
  return (await response.json()) as MatchHistoryItem[];
}

export function buildExportUrl(filters: MatchFilters = {}): string {
  const query = buildMatchQuery({ ...filters, limit: filters.limit ?? 200 });
  return `${API_BASE}/matches/export?${query}`;
}

export async function downloadMatchExport(filters: MatchFilters = {}): Promise<Blob> {
  const response = await checkedFetch(buildExportUrl(filters));
  return response.blob();
}

async function uploadCsv(path: string, file: File): Promise<ImportBatchSummary> {
  const formData = new FormData();
  formData.append('file', file);
  // Direct to the API: the reference export is hundreds of megabytes and the
  // dev proxy drops connections that run long.
  const response = await checkedFetch(`${HEAVY_API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  });
  return (await response.json()) as ImportBatchSummary;
}

export function uploadAccountImport(file: File): Promise<ImportBatchSummary> {
  return uploadCsv('/accounts/import', file);
}

export function uploadBulkMatchImport(file: File): Promise<ImportBatchSummary> {
  return uploadCsv('/matches/import', file);
}

export function uploadBulkDeletionImport(file: File): Promise<ImportBatchSummary> {
  return uploadCsv('/matches/import-deletions', file);
}

/** Shared filter serialization, so every account call sends the same shape. */
export function buildAccountQuery(params: AccountFilters = {}): URLSearchParams {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.state) query.set('state', params.state);
  if (params.vertical) query.set('vertical', params.vertical);
  if (params.tier || params.sub_segment) query.set('tier', params.tier ?? params.sub_segment ?? '');
  if (params.segment) query.set('segment', params.segment);
  if (params.source) query.set('source', params.source);
  if (params.sl2) query.set('sl2', params.sl2);
  if (params.sl3) query.set('sl3', params.sl3);
  if (params.sl4) query.set('sl4', params.sl4);
  if (params.sl5) query.set('sl5', params.sl5);
  if (params.sl6) query.set('sl6', params.sl6);
  if (params.savm_group_id) query.set('savm_group_id', params.savm_group_id);
  if (params.unified_account_name) {
    query.set('unified_account_name', params.unified_account_name);
  }
  return query;
}

export async function fetchAccounts(
  params: AccountFilters = {},
  signal?: AbortSignal
): Promise<AccountListResponse> {
  const query = buildAccountQuery(params);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));

  const response = await checkedFetch(`${API_BASE}/accounts?${query}`, { signal });
  return (await response.json()) as AccountListResponse;
}

export async function fetchAccountFacets(
  params: AccountFilters = {},
  signal?: AbortSignal
): Promise<AccountFacets> {
  const query = buildAccountQuery(params);
  if (params.sl6_search) query.set('sl6_search', params.sl6_search);
  const response = await checkedFetch(`${API_BASE}/accounts/facets?${query.toString()}`, {
    signal,
  });
  return (await response.json()) as AccountFacets;
}

/**
 * Options for one high-cardinality dropdown. The list is derived server-side so
 * a column with hundreds of thousands of distinct values never reaches the
 * browser in full.
 */
export async function fetchAccountOptions(
  column: SearchableOptionColumn,
  query: string,
  params: AccountFilters = {},
  signal?: AbortSignal
): Promise<AccountOptionsResponse> {
  const search = buildAccountQuery(params);
  search.set('column', column);
  if (query.trim()) search.set('query', query.trim());
  const response = await checkedFetch(`${API_BASE}/accounts/options?${search.toString()}`, {
    signal,
  });
  return (await response.json()) as AccountOptionsResponse;
}

/**
 * The filtered rows as JSON. Capped server-side, so only for small sets.
 * Use `downloadAccountsWorkbook` for a real export.
 */
export async function fetchAllAccounts(
  params: AccountFilters = {}
): Promise<AccountExportResponse> {
  const query = buildAccountQuery(params);
  const response = await checkedFetch(
    `${HEAVY_API_BASE}/accounts/export?${query.toString()}`
  );
  return (await response.json()) as AccountExportResponse;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function fileNameFromDisposition(header: string | null, fallback: string): string {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? fallback;
}

/**
 * Download every row matching the filters as an Excel workbook.
 *
 * The workbook is built by the API, not here: the reference runs to a few
 * hundred thousand rows, and assembling that in the browser meant transferring
 * hundreds of megabytes of JSON first. Goes direct to the API because the Next
 * dev proxy drops requests that run long.
 */
export async function downloadAccountsWorkbook(
  params: AccountFilters = {},
  options: { includeInactive?: boolean; columns?: string[] } = {}
): Promise<string> {
  const query = buildAccountQuery(params);
  if (options.includeInactive) query.set('include_inactive', 'true');
  if (options.columns?.length) query.set('columns', options.columns.join(','));

  const response = await checkedFetch(
    `${HEAVY_API_BASE}/accounts/export.xlsx?${query.toString()}`
  );
  const blob = await response.blob();
  const fileName = fileNameFromDisposition(
    response.headers.get('Content-Disposition'),
    'ALLOCATION_ae_accounts.xlsx'
  );
  triggerBrowserDownload(blob, fileName);
  return fileName;
}

export async function fetchAllocationColumns(): Promise<AllocationColumnSettings> {
  const response = await checkedFetch(`${API_BASE}/settings/allocation-columns`);
  return (await response.json()) as AllocationColumnSettings;
}

export async function saveAllocationColumns(
  columns: string[]
): Promise<AllocationColumnSettings> {
  const response = await checkedFetch(`${API_BASE}/settings/allocation-columns`, {
    method: 'PUT',
    ...asJsonBody({ columns }),
  });
  return (await response.json()) as AllocationColumnSettings;
}

export async function resetAllocationColumns(): Promise<AllocationColumnSettings> {
  const response = await checkedFetch(`${API_BASE}/settings/allocation-columns/reset`, {
    method: 'POST',
  });
  return (await response.json()) as AllocationColumnSettings;
}

/** Irreversible. Callers must export first; the endpoint does not. */
export async function purgeAccounts(confirm: string): Promise<PurgeAccountsResult> {
  const response = await checkedFetch(`${HEAVY_API_BASE}/accounts`, {
    method: 'DELETE',
    ...asJsonBody({ confirm }),
  });
  return (await response.json()) as PurgeAccountsResult;
}

export async function fetchGroup(savmGroupId: string): Promise<GroupSummary> {
  const response = await checkedFetch(
    `${API_BASE}/accounts/group/${encodeURIComponent(savmGroupId)}`
  );
  return (await response.json()) as GroupSummary;
}

export async function createBackup(): Promise<{ backup_file: string; created_at: string }> {
  const response = await checkedFetch(`${API_BASE}/admin/backup`, { method: 'POST' });
  return (await response.json()) as { backup_file: string; created_at: string };
}
