export type MatchStatus =
  | 'pending_admin_approval'
  | 'pending_review'
  | 'active'
  | 'rejected'
  | 'deleted';

export type MatchLevel = 'SAVM' | 'SFDC';

export type LinkStatus = 'linked' | 'unlinked';

/** Live group/account attributes joined from the Cisco reference table. */
export interface LinkedAccount {
  savm_group_name: string | null;
  vertical: string | null;
  segment: string | null;
  tier: string | null;
  source: string | null;
  sl1: string | null;
  sl2: string | null;
  sl3: string | null;
  sl4: string | null;
  sl5: string | null;
  sl6: string | null;
  sfdc_account_name?: string | null;
  unified_account_name?: string | null;
  state?: string | null;
}

/** Resolved account manager. SAVM-level matches pick the best-ranked child. */
export interface ResolvedAm {
  am_name: string | null;
  am_email: string | null;
  am_cec: string | null;
  am_confidence: string | null;
  am_priority: number | null;
  am_reason: string | null;
  am_source_account_name: string | null;
}

export interface MatchLibraryItem {
  id: number;
  match_id: number;
  entity_name_original: string;
  entity_name_cleaned: string;
  entity_state: string | null;

  savm_group_id: string | null;
  sfdc_account_name: string | null;
  account_state: string | null;
  match_level: MatchLevel | null;

  snap_savm_group_name: string | null;
  snap_account_name: string | null;
  snap_am_name: string | null;
  snap_am_email: string | null;
  snap_am_confidence: string | null;

  confidence_score: number | null;
  match_stage: string | null;
  status: MatchStatus;
  notes: string | null;

  source: string;
  source_detail: string | null;

  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string | null;
  decided_by: string | null;
  decided_at: string | null;

  link_status: LinkStatus;
  prev_status: string | null;

  account: LinkedAccount | null;
  am: ResolvedAm | null;
  /** True when the approval-time snapshot no longer matches the reference table. */
  drifted: boolean;
}

export interface MatchListResponse {
  items: MatchLibraryItem[];
  total: number;
}

export interface MatchFilters {
  status?: MatchStatus | '';
  search?: string;
  state?: string;
  vertical?: string;
  tier?: string;
  link_status?: LinkStatus | '';
  match_level?: MatchLevel | '';
  limit?: number;
  offset?: number;
}

export interface MatchHistoryItem {
  id: number;
  match_id: number;
  event: string;
  from_status: string | null;
  to_status: string | null;
  field_changes: string | null;
  notes: string | null;
  actor: string;
  created_at: string;
}

export interface ImportRowIssue {
  row: number;
  reason: string;
  status?: string;
  [key: string]: unknown;
}

export interface ImportBatchSummary {
  id: number;
  kind: string;
  filename: string;
  row_count: number;
  inserted: number;
  updated: number;
  deactivated: number;
  skipped: number;
  skipped_blank: number;
  failed: number;
  newly_unlinked: number;
  actor: string;
  created_at: string;
  error_report: {
    warnings: string[];
    rows: ImportRowIssue[];
  };
}

export interface BulkApproveResult {
  approved: number;
  failed: { id: number; reason: string }[];
}

export interface CiscoAccount {
  id: number;
  account_id: number;
  savm_group_id: string;
  savm_group_name: string | null;
  sfdc_account_name: string;
  unified_account_name: string | null;
  state: string;
  vertical: string | null;
  segment: string | null;
  tier: string | null;
  source: string | null;
  node_id: string | null;
  sl1: string | null;
  sl2: string | null;
  sl3: string | null;
  sl4: string | null;
  sl5: string | null;
  sl6: string | null;
  am_cec: string | null;
  am_name: string | null;
  am_email: string | null;
  am_job_title: string | null;
  am_confidence: string | null;
  am_priority: number | null;
  am_reason: string | null;
  exists_in_sav: string | null;
  exists_in_sfdc: string | null;
}

export interface AccountListResponse {
  items: CiscoAccount[];
  total: number;
}

export interface AccountFacets {
  state: string[];
  vertical: string[];
  tier: string[];
  source: string[];
  sl2: string[];
  sl3: string[];
  sl4: string[];
  sl5: string[];
  sl6: string[];
  sl6_server_side: boolean;
  sl6_min_search_chars: number;
  total_accounts: number;
  total_groups: number;
}

export interface AccountFilters {
  search?: string;
  state?: string;
  vertical?: string;
  tier?: string;
  sub_segment?: string;
  segment?: string;
  source?: string;
  sl2?: string;
  sl3?: string;
  sl4?: string;
  sl5?: string;
  sl6?: string;
  savm_group_id?: string;
  unified_account_name?: string;
  sl6_search?: string;
  limit?: number;
  offset?: number;
}

/** Columns the reference exposes but which are too numerous for a plain list. */
export type SearchableOptionColumn =
  | 'savm_group_id'
  | 'unified_account_name'
  | 'savm_group_name'
  | 'sfdc_account_name'
  | 'sl6';

export interface AccountOptionsResponse {
  column: string;
  query: string;
  options: string[];
  /** True when more values match than the limit returned. */
  truncated: boolean;
  min_search_chars: number;
}

export interface AllocationColumn {
  key: string;
  label: string;
  group: string;
}

/** The AE Allocation column selection. Global: an admin sets it for everyone. */
export interface AllocationColumnSettings {
  available: AllocationColumn[];
  selected: string[];
  defaults: string[];
  is_default: boolean;
}

export interface AccountExportResponse {
  items: CiscoAccount[];
  total: number;
}

export interface PurgeAccountsResult {
  deleted: number;
  newly_unlinked: number;
}

export interface GroupSummary {
  savm_group_id: string;
  savm_group_name: string | null;
  vertical: string | null;
  segment: string | null;
  tier: string | null;
  source: string | null;
  account_count: number;
  am: ResolvedAm | null;
  accounts: CiscoAccount[];
}

export const STATUS_LABELS: Record<MatchStatus, string> = {
  pending_admin_approval: 'Pending admin approval',
  pending_review: 'Pending review',
  active: 'Active',
  rejected: 'Rejected',
  deleted: 'Deleted',
};
