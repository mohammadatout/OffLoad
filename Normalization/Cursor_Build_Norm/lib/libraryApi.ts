import {
  AccountFacets,
  AccountFilters,
  AccountListResponse,
  BulkApproveResult,
  GroupSummary,
  ImportBatchSummary,
  MatchFilters,
  MatchHistoryItem,
  MatchLibraryItem,
  MatchListResponse,
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

export async function fetchAccounts(
  params: AccountFilters = {}
): Promise<AccountListResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.state) query.set('state', params.state);
  if (params.vertical) query.set('vertical', params.vertical);
  if (params.tier) query.set('tier', params.tier);
  if (params.segment) query.set('segment', params.segment);
  if (params.source) query.set('source', params.source);
  query.set('limit', String(params.limit ?? 50));
  query.set('offset', String(params.offset ?? 0));

  const response = await checkedFetch(`${API_BASE}/accounts?${query}`);
  return (await response.json()) as AccountListResponse;
}

export async function fetchAccountFacets(): Promise<AccountFacets> {
  const response = await checkedFetch(`${API_BASE}/accounts/facets`);
  return (await response.json()) as AccountFacets;
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
