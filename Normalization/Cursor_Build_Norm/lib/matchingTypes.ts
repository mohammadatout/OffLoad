export interface MatchConfig {
  internal_col: string;
  external_col: string;
  use_state_blocking: boolean;
  use_context_validation: boolean;
  abbreviations: Record<string, string> | null;
}

export interface MatchResult {
  Match_Status: string;
  Matched_Name: string;
  Confidence_Score: number;
  Match_Stage: string;
  State: string;
  Context_Notes: string;
  Top_3_Candidates: string;
  [key: string]: string | number;
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
}

export interface ReviewDecision {
  internalIdx: number;
  internalName: string;
  selectedCandidate: string | null;
  accepted: boolean;
}
