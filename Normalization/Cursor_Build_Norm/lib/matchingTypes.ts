export interface MatchConfig {
  internal_col: string;
  external_col: string;
  use_state_blocking: boolean;
  use_context_validation: boolean;
  abbreviations: Record<string, string> | null;
  skipped_stages?: string[];
}

export interface MatchResult {
  Match_Status: string;
  Matched_Name: string;
  Confidence_Score: number;
  Match_Stage: string;
  State: string;
  Context_Notes: string;
  Top_3_Candidates: string;
  Review_Required?: boolean;
  State_Mismatch_Flag?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface MatchStats {
  total_internal: number;
  total_external: number;
  stage_0_exact: number;
  stage_1_high_confidence: number;
  stage_2_confident: number;
  stage_3_probable: number;
  stage_4_review: number;
  unmatched: number;
  total_matched: number;
  match_rate: number;
  elapsed_time: number;
  stage_counts?: Record<string, number>;
}

export interface MatchStageDefinition {
  id: string;
  order: number;
  name: string;
  comparison_target: string;
  implemented: boolean;
}

export interface MatchRunSummary {
  skipped_stage_ids: string[];
  skipped_stages: string[];
  warnings: string[];
  stage_1_skipped_warning: boolean;
}

export interface MatchRunProgress {
  run_id: string;
  completed: boolean;
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped';
  message: string;
  current_stage_id?: string | null;
  current_stage_name?: string | null;
  comparison_target?: string | null;
  completed_stage_ids: string[];
  skipped_stage_ids: string[];
  warnings: string[];
  error?: string | null;
}

export interface ReviewDecision {
  internalIdx: number;
  internalName: string;
  selectedCandidate: string | null;
  accepted: boolean;
  notes: string;
  matchId: number | null;
  actionChosen: boolean;
}

export interface MatchRunResponse {
  run_id?: string;
  results: MatchResult[];
  stats: MatchStats;
  library_hits?: number;
  newly_staged?: number;
  suppressed?: number;
  stage_ladder?: MatchStageDefinition[];
  run_summary?: MatchRunSummary;
}
