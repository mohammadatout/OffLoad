"""
Entity Matcher v3.0 - Diagnostic & Test Script
Validates improvements against baseline and provides detailed analysis

Run: python test_matcher.py
"""

import pandas as pd
import numpy as np
import time
import sys
from typing import Dict, List, Tuple, Set
import re

# Attempt imports
try:
    import jellyfish
    import Levenshtein
    from fuzzywuzzy import fuzz
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install jellyfish python-Levenshtein fuzzywuzzy")
    sys.exit(1)


class EntityNormalizer:
    """Entity name normalization and preprocessing"""
    
    ABBREVIATIONS = {
        'USD': 'UNIFIED SCHOOL DISTRICT',
        'SD': 'SCHOOL DISTRICT',
        'HSD': 'HIGH SCHOOL DISTRICT',
        'ESD': 'ELEMENTARY SCHOOL DISTRICT',
        'UHSD': 'UNION HIGH SCHOOL DISTRICT',
        'UESD': 'UNION ELEMENTARY SCHOOL DISTRICT',
        'CUSD': 'COMMUNITY UNIFIED SCHOOL DISTRICT',
        'JUSD': 'JOINT UNIFIED SCHOOL DISTRICT',
        'JUHSD': 'JOINT UNION HIGH SCHOOL DISTRICT',
        'JUESD': 'JOINT UNION ELEMENTARY SCHOOL DISTRICT',
        'ISD': 'INDEPENDENT SCHOOL DISTRICT',
        'CISD': 'CONSOLIDATED INDEPENDENT SCHOOL DISTRICT',
        'CSD': 'CENTRAL SCHOOL DISTRICT',
        'UFSD': 'UNION FREE SCHOOL DISTRICT',
        'BOCES': 'BOARD OF COOPERATIVE EDUCATIONAL SERVICES',
        'JTED': 'JOINT TECHNICAL EDUCATION DISTRICT',
        'CC': 'COMMUNITY COLLEGE',
        'CCD': 'COMMUNITY COLLEGE DISTRICT',
        'CO': 'COUNTY',
        'CTY': 'CITY',
        'TWP': 'TOWNSHIP',
        'BORO': 'BOROUGH',
        'MUN': 'MUNICIPAL',
        'GOVT': 'GOVERNMENT',
        'GOV': 'GOVERNMENT',
        'DIST': 'DISTRICT',
        'AUTH': 'AUTHORITY',
        'DEPT': 'DEPARTMENT',
        'COMM': 'COMMISSION',
        'BD': 'BOARD',
        'BRD': 'BOARD',
        'ADMIN': 'ADMINISTRATION',
        'SVCS': 'SERVICES',
        'SVC': 'SERVICE',
        'CTR': 'CENTER',
        'HOSP': 'HOSPITAL',
        'UNIV': 'UNIVERSITY',
        'COLL': 'COLLEGE',
        'ACAD': 'ACADEMY',
        'INST': 'INSTITUTE',
        'ASSN': 'ASSOCIATION',
        'ASSOC': 'ASSOCIATION',
        'CORP': 'CORPORATION',
        'INC': 'INCORPORATED',
        'LLC': 'LIMITED LIABILITY COMPANY',
        'LTD': 'LIMITED',
        'INTL': 'INTERNATIONAL',
        'NATL': 'NATIONAL',
        'REG': 'REGIONAL',
        'REGL': 'REGIONAL',
        'FED': 'FEDERAL',
        'ST': 'STATE',
        'PUB': 'PUBLIC',
        'ELEM': 'ELEMENTARY',
        'SEC': 'SECONDARY',
        'JR': 'JUNIOR',
        'SR': 'SENIOR',
        'NO': 'NUMBER',
        'NUM': 'NUMBER',
        '#': 'NUMBER',
        'N': 'NORTH',
        'S': 'SOUTH',
        'E': 'EAST',
        'W': 'WEST',
        'MT': 'MOUNT',
        'PT': 'POINT',
        'FT': 'FORT',
        'VLG': 'VILLAGE',
        'HTS': 'HEIGHTS',
        'SPG': 'SPRING',
        'SPGS': 'SPRINGS',
        'TWN': 'TOWN',
        'GRV': 'GROVE',
        'VLY': 'VALLEY',
        'CHAR': 'CHARTER',
    }
    
    US_STATES = {
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
        'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
    }
    
    @classmethod
    def extract_state_and_name(cls, full_name: str) -> Tuple[str, str]:
        if not full_name:
            return '', ''
        
        full_name = full_name.strip().upper()
        
        patterns = [
            r'^([A-Z]{2})\s*[-\u2013\u2014]\s*(.+)$',
            r'^([A-Z]{2})\s+(.+)$',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, full_name)
            if match:
                state = match.group(1)
                name = match.group(2).strip()
                if state in cls.US_STATES:
                    return state, name
        
        return '', full_name
    
    @classmethod
    def normalize_name(cls, name: str, expand_abbreviations: bool = True) -> str:
        if not name:
            return ''
        
        name = name.upper().strip()
        
        # Replace special characters
        name = name.replace('&', ' AND ')
        name = name.replace('#', ' NUMBER ')
        name = name.replace('.', ' ')
        name = name.replace(',', ' ')
        name = name.replace("'", '')
        name = name.replace('"', '')
        name = name.replace('(', ' ')
        name = name.replace(')', ' ')
        name = name.replace('[', ' ')
        name = name.replace(']', ' ')
        name = name.replace('/', ' ')
        name = name.replace('\\', ' ')
        name = name.replace('-', ' ')
        
        name = ' '.join(name.split())
        
        if expand_abbreviations:
            words = name.split()
            expanded_words = []
            for word in words:
                if word in cls.ABBREVIATIONS:
                    expanded_words.append(cls.ABBREVIATIONS[word])
                else:
                    expanded_words.append(word)
            name = ' '.join(expanded_words)
            name = ' '.join(name.split())
        
        return name
    
    @classmethod
    def get_phonetic_key(cls, name: str) -> str:
        if not name:
            return ''
        words = name.split()[:4]
        phonetics = []
        for word in words:
            try:
                phonetic = jellyfish.metaphone(word)
                if phonetic:
                    phonetics.append(phonetic)
            except Exception:
                phonetics.append(word[:3])
        return ' '.join(phonetics)
    
    @classmethod
    def get_core_tokens(cls, name: str) -> Set[str]:
        STOP_WORDS = {
            'OF', 'THE', 'AND', 'A', 'AN', 'IN', 'AT', 'FOR', 'TO', 'BY',
            'CITY', 'COUNTY', 'TOWN', 'TOWNSHIP', 'VILLAGE', 'BOROUGH',
            'STATE', 'DISTRICT', 'SCHOOL', 'PUBLIC', 'CHARTER'
        }
        
        words = name.split()
        return {w for w in words if w not in STOP_WORDS and len(w) > 1}


class DiagnosticEntityMatcher:
    """Entity matcher with diagnostic capabilities"""
    
    def __init__(self, use_state_blocking: bool = True,
                 expand_abbreviations: bool = True,
                 use_phonetic: bool = True):
        
        self.use_state_blocking = use_state_blocking
        self.expand_abbreviations = expand_abbreviations
        self.use_phonetic = use_phonetic
        
        self.similarity_weights = {
            'levenshtein': 0.18,
            'jaro_winkler': 0.18,
            'token_sort': 0.16,
            'token_set': 0.18,
            'ngram': 0.12,
            'monge_elkan': 0.10,
            'phonetic': 0.08,
        }
    
    def preprocess_datasets(self, internal_df: pd.DataFrame, external_df: pd.DataFrame,
                           internal_col: str, external_col: str) -> Tuple[Dict, Dict, Dict]:
        
        internal_data = {}
        for idx, row in internal_df.iterrows():
            full_name = str(row[internal_col]) if pd.notna(row[internal_col]) else ''
            state, core_name = EntityNormalizer.extract_state_and_name(full_name)
            
            normalized = EntityNormalizer.normalize_name(core_name, self.expand_abbreviations)
            phonetic = EntityNormalizer.get_phonetic_key(normalized) if self.use_phonetic else ''
            
            internal_data[idx] = {
                'original': full_name,
                'state': state,
                'core_name': core_name,
                'normalized': normalized,
                'phonetic': phonetic,
                'tokens': EntityNormalizer.get_core_tokens(normalized)
            }
        
        external_data = {}
        external_by_state = {}
        
        for idx, row in external_df.iterrows():
            full_name = str(row[external_col]) if pd.notna(row[external_col]) else ''
            state, core_name = EntityNormalizer.extract_state_and_name(full_name)
            
            normalized = EntityNormalizer.normalize_name(core_name, self.expand_abbreviations)
            phonetic = EntityNormalizer.get_phonetic_key(normalized) if self.use_phonetic else ''
            
            external_data[idx] = {
                'original': full_name,
                'state': state,
                'core_name': core_name,
                'normalized': normalized,
                'phonetic': phonetic,
                'tokens': EntityNormalizer.get_core_tokens(normalized)
            }
            
            if state not in external_by_state:
                external_by_state[state] = []
            external_by_state[state].append(idx)
        
        return internal_data, external_data, external_by_state
    
    def calculate_similarity(self, data1: dict, data2: dict) -> float:
        name1 = data1['normalized']
        name2 = data2['normalized']
        
        if not name1 or not name2:
            return 0.0
        
        if name1 == name2:
            return 1.0
        
        scores = {}
        
        scores['levenshtein'] = Levenshtein.ratio(name1, name2)
        scores['jaro_winkler'] = jellyfish.jaro_winkler_similarity(name1, name2)
        scores['token_sort'] = fuzz.token_sort_ratio(name1, name2) / 100.0
        scores['token_set'] = fuzz.token_set_ratio(name1, name2) / 100.0
        scores['ngram'] = self._ngram_jaccard(name1, name2, n=3)
        scores['monge_elkan'] = self._monge_elkan(name1, name2)
        
        if self.use_phonetic and data1['phonetic'] and data2['phonetic']:
            if data1['phonetic'] == data2['phonetic']:
                scores['phonetic'] = 1.0
            else:
                scores['phonetic'] = Levenshtein.ratio(data1['phonetic'], data2['phonetic'])
        else:
            scores['phonetic'] = 0.0
        
        token_overlap = len(data1['tokens'] & data2['tokens'])
        token_union = len(data1['tokens'] | data2['tokens'])
        token_jaccard = token_overlap / token_union if token_union > 0 else 0.0
        
        weighted_sum = sum(
            self.similarity_weights.get(method, 0.1) * score 
            for method, score in scores.items()
        )
        
        return min(1.0, weighted_sum + (token_jaccard * 0.1))
    
    def _ngram_jaccard(self, s1: str, s2: str, n: int = 3) -> float:
        def get_ngrams(text, n):
            text = ' ' + text + ' '
            return set([text[i:i+n] for i in range(max(0, len(text)-n+1))])
        
        ngrams1 = get_ngrams(s1, n)
        ngrams2 = get_ngrams(s2, n)
        
        if not ngrams1 or not ngrams2:
            return 0.0
        
        intersection = len(ngrams1 & ngrams2)
        union = len(ngrams1 | ngrams2)
        
        return intersection / union if union > 0 else 0.0
    
    def _monge_elkan(self, s1: str, s2: str) -> float:
        tokens1 = s1.split()
        tokens2 = s2.split()
        
        if not tokens1 or not tokens2:
            return 0.0
        
        def one_direction(t1, t2):
            scores = []
            for token in t1:
                max_sim = max([jellyfish.jaro_winkler_similarity(token, t) for t in t2], default=0)
                scores.append(max_sim)
            return sum(scores) / len(scores) if scores else 0.0
        
        forward = one_direction(tokens1, tokens2)
        backward = one_direction(tokens2, tokens1)
        
        return (forward + backward) / 2
    
    def calculate_all_similarities(self, internal_data: Dict, external_data: Dict,
                                   external_by_state: Dict) -> Dict[int, List[Tuple[int, float]]]:
        """Calculate all similarities and store them for multi-threshold analysis"""
        
        all_scores = {}
        total = len(internal_data)
        
        for i, (int_idx, int_record) in enumerate(internal_data.items()):
            if (i + 1) % 100 == 0:
                print(f"  Processing {i+1}/{total}...", end='')
            
            int_state = int_record['state']
            
            if self.use_state_blocking and int_state:
                candidates = external_by_state.get(int_state, [])
            else:
                candidates = list(external_data.keys())
            
            scores_for_entity = []
            for ext_idx in candidates:
                ext_record = external_data[ext_idx]
                score = self.calculate_similarity(int_record, ext_record)
                if score > 0.3:  # Pre-filter very low scores
                    scores_for_entity.append((ext_idx, score))
            
            # Sort by score descending
            scores_for_entity.sort(key=lambda x: x[1], reverse=True)
            all_scores[int_idx] = scores_for_entity
        
        print()
        return all_scores
    
    def apply_matching_at_threshold(self, all_scores: Dict, threshold: float) -> List[Tuple[int, int, float]]:
        """Apply UMC + EXC matching at a specific threshold"""
        
        # EXC: Find mutual best matches
        internal_best = {}
        for int_idx, scores in all_scores.items():
            if scores and scores[0][1] >= threshold:
                internal_best[int_idx] = scores[0]
        
        external_best = {}
        for int_idx, (ext_idx, score) in internal_best.items():
            if ext_idx not in external_best or score > external_best[ext_idx][1]:
                external_best[ext_idx] = (int_idx, score)
        
        exc_matches = set()
        for int_idx, (ext_idx, score) in internal_best.items():
            if ext_idx in external_best and external_best[ext_idx][0] == int_idx:
                exc_matches.add((int_idx, ext_idx, score))
        
        # UMC: Greedy assignment
        all_edges = []
        for int_idx, scores in all_scores.items():
            for ext_idx, score in scores:
                if score >= threshold:
                    all_edges.append((int_idx, ext_idx, score))
        
        all_edges.sort(key=lambda x: x[2], reverse=True)
        
        umc_matches = []
        matched_internal = set()
        matched_external = set()
        
        for int_idx, ext_idx, score in all_edges:
            if int_idx not in matched_internal and ext_idx not in matched_external:
                umc_matches.append((int_idx, ext_idx, score))
                matched_internal.add(int_idx)
                matched_external.add(ext_idx)
        
        # Ensemble
        match_dict = {(i, j): s for i, j, s in exc_matches}
        for i, j, s in umc_matches:
            if (i, j) not in match_dict:
                match_dict[(i, j)] = s * 0.98
        
        return [(i, j, s) for (i, j), s in match_dict.items()]


def run_diagnostic():
    """Run comprehensive diagnostic test"""
    
    print("=" * 70)
    print("ENTITY MATCHER - DIAGNOSTIC & TEST")
    print("=" * 70)
    print()
    
    # Load data
    print("Loading data...")
    try:
        internal_df = pd.read_csv('National_CRR_Intern_List.csv')
        external_df = pd.read_csv('SAVM_External_List.csv')
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Make sure CSV files are in the same directory as this script.")
        return
    
    print(f"  Internal records: {len(internal_df):,}")
    print(f"  External records: {len(external_df):,}")
    print()
    
    # Step 1: State coverage analysis
    print("STEP 1: Analyzing state coverage...")
    
    internal_by_state = {}
    for idx, row in internal_df.iterrows():
        full_name = str(row['Full_Entity_Name']) if pd.notna(row['Full_Entity_Name']) else ''
        state, _ = EntityNormalizer.extract_state_and_name(full_name)
        if state not in internal_by_state:
            internal_by_state[state] = []
        internal_by_state[state].append(full_name)
    
    external_states = set()
    for idx, row in external_df.iterrows():
        full_name = str(row['Company Name']) if pd.notna(row['Company Name']) else ''
        state, _ = EntityNormalizer.extract_state_and_name(full_name)
        if state:
            external_states.add(state)
    
    internal_states = set(s for s in internal_by_state.keys() if s)
    no_state_internal = len(internal_by_state.get('', []))
    no_state_external = len([1 for idx, row in external_df.iterrows() 
                              if not EntityNormalizer.extract_state_and_name(
                                  str(row['Company Name']) if pd.notna(row['Company Name']) else '')[0]])
    
    print(f"  Internal: {len(internal_states)} states, {no_state_internal} without state")
    print(f"  External: {len(external_states)} states, {no_state_external} without state")
    
    missing_states = internal_states - external_states
    if missing_states:
        print(f"  WARNING: States in internal but NOT in external: {missing_states}")
        total_unmatchable = 0
        for state in missing_states:
            count = len(internal_by_state.get(state, []))
            print(f"    {state}: {count} entities cannot be matched!")
            total_unmatchable += count
    else:
        total_unmatchable = 0
    print()
    
    # Step 2: Run matching
    print("STEP 2: Running matching (state-blocked)...")
    
    matcher = DiagnosticEntityMatcher(
        use_state_blocking=True,
        expand_abbreviations=True,
        use_phonetic=True
    )
    
    internal_data, external_data, external_by_state_dict = matcher.preprocess_datasets(
        internal_df, external_df, 'Full_Entity_Name', 'Company Name'
    )
    
    start_time = time.time()
    all_scores = matcher.calculate_all_similarities(internal_data, external_data, external_by_state_dict)
    elapsed = time.time() - start_time
    print(f"  Completed in {elapsed:.2f}s")
    print()
    
    # Step 3: Results at different thresholds
    print("STEP 3: Results at different thresholds...")
    print()
    
    baseline = 567
    
    thresholds = [0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
    results = []
    
    print(f"{'Threshold':<15} {'Matches':<15} {'Rate':<10} {'Avg Score'}")
    print("-" * 46)
    
    for threshold in thresholds:
        matches = matcher.apply_matching_at_threshold(all_scores, threshold)
        match_count = len(matches)
        match_rate = match_count / len(internal_df) * 100
        avg_score = np.mean([s for _, _, s in matches]) if matches else 0
        diff = match_count - baseline
        diff_str = f"({diff:+d})"
        
        print(f"{threshold*100:.0f}%{'':<12} {match_count:<15} {match_rate:.1f}%{'':<5} {avg_score:.3f}  {diff_str}")
        
        results.append({
            'threshold': threshold,
            'matches': match_count,
            'diff': diff,
            'avg_score': avg_score
        })
    
    print()
    best = max(results, key=lambda x: x['matches'])
    print(f"Baseline: {baseline} matches")
    print(f"Best result: {best['matches']} at {best['threshold']*100:.0f}% threshold")
    print()
    
    # Step 4: Analyze unmatched
    print("STEP 4: Analyzing unmatched entities...")
    
    best_matches = matcher.apply_matching_at_threshold(all_scores, 0.70)
    matched_internal = set(i for i, _, _ in best_matches)
    unmatched = [idx for idx in internal_data if idx not in matched_internal]
    
    print(f"  Total unmatched at 70% threshold: {len(unmatched)}")
    print()
    
    # Categorize unmatched
    no_candidates = []
    low_similarity = []
    
    for idx in unmatched:
        state = internal_data[idx]['state']
        if state and state not in external_states:
            no_candidates.append(idx)
        else:
            low_similarity.append(idx)
    
    if no_candidates:
        print(f"  Unmatched due to no external entities in state ({len(no_candidates)}):")
        for idx in no_candidates[:10]:
            print(f"    - {internal_data[idx]['original']}")
        if len(no_candidates) > 10:
            print(f"    ... and {len(no_candidates) - 10} more")
        print()
    
    if low_similarity:
        print(f"  Unmatched due to low similarity ({len(low_similarity)}):")
        for idx in low_similarity:
            scores = all_scores.get(idx, [])
            if scores:
                best_ext, best_score = scores[0]
                print(f"    - {internal_data[idx]['original']}")
                print(f"      Best match: {external_data[best_ext]['original']} (score: {best_score:.3f})")
            else:
                print(f"    - {internal_data[idx]['original']}")
                print(f"      No candidates found")
        print()
    
    # Step 5: Save results
    print("STEP 5: Saving results...")
    
    # Build result DataFrame at best threshold
    matches_at_70 = matcher.apply_matching_at_threshold(all_scores, 0.70)
    match_lookup = {i: (j, s) for i, j, s in matches_at_70}
    
    result_df = internal_df.copy()
    result_df['Match_Status'] = 'No Match'
    result_df['Matched_Name'] = ''
    result_df['Confidence_Score'] = 0.0
    result_df['State'] = ''
    result_df['Unmatch_Reason'] = ''
    
    for col in external_df.columns:
        result_df[f'External_{col}'] = ''
    
    for int_idx in internal_data:
        state = internal_data[int_idx]['state']
        result_df.loc[int_idx, 'State'] = state
        
        if int_idx in match_lookup:
            ext_idx, score = match_lookup[int_idx]
            result_df.loc[int_idx, 'Match_Status'] = 'Matched'
            result_df.loc[int_idx, 'Matched_Name'] = external_data[ext_idx]['original']
            result_df.loc[int_idx, 'Confidence_Score'] = round(score, 4)
            
            for col in external_df.columns:
                result_df.loc[int_idx, f'External_{col}'] = external_df.loc[ext_idx, col]
        else:
            if state and state not in external_states:
                result_df.loc[int_idx, 'Unmatch_Reason'] = f'State {state} not in external data'
            else:
                scores = all_scores.get(int_idx, [])
                if scores:
                    result_df.loc[int_idx, 'Unmatch_Reason'] = f'Best score {scores[0][1]:.3f} below threshold'
                else:
                    result_df.loc[int_idx, 'Unmatch_Reason'] = 'No candidates found'
    
    result_df = result_df.sort_values('Confidence_Score', ascending=False)
    result_df.to_csv('matching_results_diagnostic.csv', index=False)
    print("  Saved: matching_results_diagnostic.csv")
    
    # Save unmatched analysis
    unmatched_df = result_df[result_df['Match_Status'] == 'No Match'].copy()
    unmatched_df.to_csv('unmatched_analysis.csv', index=False)
    print(f"  Saved: unmatched_analysis.csv")
    print()
    
    print("=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    run_diagnostic()
