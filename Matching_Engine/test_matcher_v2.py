"""
Test Script for Entity Matcher v3.0 - Optimized Version
Fast diagnostics and validation
"""

import pandas as pd
import numpy as np
import time
import sys
from typing import Dict, List, Tuple, Set
import re

try:
    import jellyfish
    import Levenshtein
    from fuzzywuzzy import fuzz
except ImportError as e:
    print(f"Missing dependency: {e}")
    sys.exit(1)


class EntityNormalizer:
    """Entity name normalization"""
    
    ABBREVIATIONS = {
        'USD': 'UNIFIED SCHOOL DISTRICT',
        'SD': 'SCHOOL DISTRICT',
        'HSD': 'HIGH SCHOOL DISTRICT',
        'ESD': 'ELEMENTARY SCHOOL DISTRICT',
        'UHSD': 'UNION HIGH SCHOOL DISTRICT',
        'UESD': 'UNION ELEMENTARY SCHOOL DISTRICT',
        'ISD': 'INDEPENDENT SCHOOL DISTRICT',
        'CSD': 'CENTRAL SCHOOL DISTRICT',
        'UFSD': 'UNION FREE SCHOOL DISTRICT',
        'JTED': 'JOINT TECHNICAL EDUCATION DISTRICT',
        'CC': 'COMMUNITY COLLEGE',
        'CCD': 'COMMUNITY COLLEGE DISTRICT',
        'NO': 'NUMBER',
        '#': 'NUMBER',
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
        
        # Pattern: XX-NAME or XX - NAME
        match = re.match(r'^([A-Z]{2})\s*[-]\s*(.+)$', full_name)
        if match:
            state = match.group(1)
            name = match.group(2).strip()
            if state in cls.US_STATES:
                return state, name
        
        return '', full_name
    
    @classmethod
    def normalize_name(cls, name: str, expand_abbrev: bool = True) -> str:
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
        name = name.replace('/', ' ')
        name = name.replace('-', ' ')
        
        name = ' '.join(name.split())
        
        if expand_abbrev:
            words = name.split()
            expanded = []
            for word in words:
                expanded.append(cls.ABBREVIATIONS.get(word, word))
            name = ' '.join(expanded)
            name = ' '.join(name.split())
        
        return name


def calculate_similarity(name1: str, name2: str) -> float:
    """Calculate similarity between two names using multiple algorithms"""
    if not name1 or not name2:
        return 0.0
    
    if name1 == name2:
        return 1.0
    
    # Use maximum of multiple similarity measures for robustness
    scores = []
    
    # Levenshtein ratio
    scores.append(Levenshtein.ratio(name1, name2))
    
    # Jaro-Winkler
    scores.append(jellyfish.jaro_winkler_similarity(name1, name2))
    
    # Token sort ratio (handles word reordering)
    scores.append(fuzz.token_sort_ratio(name1, name2) / 100.0)
    
    # Token set ratio (handles subsets)
    scores.append(fuzz.token_set_ratio(name1, name2) / 100.0)
    
    # Weighted average with emphasis on token-based methods
    weights = [0.20, 0.20, 0.25, 0.35]  # Higher weight on token_set
    weighted = sum(w * s for w, s in zip(weights, scores))
    
    # Also consider the max score
    max_score = max(scores)
    
    # Final score: blend of weighted avg and max
    return 0.6 * weighted + 0.4 * max_score


def run_diagnostic():
    """Run diagnostic to understand the data"""
    
    print("=" * 70)
    print("ENTITY MATCHER - DIAGNOSTIC & TEST")
    print("=" * 70)
    print()
    
    # Load data
    print("Loading data...")
    internal_df = pd.read_csv('National_CRR_Intern_List.csv')
    external_df = pd.read_csv('SAVM_External_List.csv')
    
    print(f"  Internal records: {len(internal_df):,}")
    print(f"  External records: {len(external_df):,}")
    print()
    
    # Analyze state coverage
    print("STEP 1: Analyzing state coverage...")
    
    internal_by_state = {}
    internal_no_state = []
    
    for idx, row in internal_df.iterrows():
        full_name = str(row['Full_Entity_Name']) if pd.notna(row['Full_Entity_Name']) else ''
        state, core_name = EntityNormalizer.extract_state_and_name(full_name)
        
        if state:
            if state not in internal_by_state:
                internal_by_state[state] = []
            internal_by_state[state].append({
                'idx': idx,
                'original': full_name,
                'core_name': core_name,
                'normalized': EntityNormalizer.normalize_name(core_name)
            })
        else:
            internal_no_state.append({
                'idx': idx,
                'original': full_name
            })
    
    external_by_state = {}
    external_no_state = 0
    
    for idx, row in external_df.iterrows():
        full_name = str(row['Company Name']) if pd.notna(row['Company Name']) else ''
        state, core_name = EntityNormalizer.extract_state_and_name(full_name)
        
        if state:
            if state not in external_by_state:
                external_by_state[state] = []
            external_by_state[state].append({
                'idx': idx,
                'original': full_name,
                'core_name': core_name,
                'normalized': EntityNormalizer.normalize_name(core_name)
            })
        else:
            external_no_state += 1
    
    print(f"  Internal: {len(internal_by_state)} states, {len(internal_no_state)} without state")
    print(f"  External: {len(external_by_state)} states, {external_no_state} without state")
    
    # Check for states in internal but not external
    missing_states = set(internal_by_state.keys()) - set(external_by_state.keys())
    if missing_states:
        print(f"  WARNING: States in internal but NOT in external: {missing_states}")
        for state in missing_states:
            print(f"    {state}: {len(internal_by_state[state])} entities cannot be matched!")
    
    if internal_no_state:
        print(f"  Entities without state prefix:")
        for item in internal_no_state[:5]:
            print(f"    - {item['original']}")
    print()
    
    # Perform matching
    print("STEP 2: Running matching (state-blocked)...")
    start_time = time.time()
    
    all_matches = []
    unmatched = []
    
    total_internal = sum(len(v) for v in internal_by_state.values())
    processed = 0
    
    for state in internal_by_state:
        if state not in external_by_state:
            # No external entities for this state
            for item in internal_by_state[state]:
                unmatched.append({
                    'internal': item['original'],
                    'reason': f'No external entities for state {state}'
                })
            continue
        
        internal_entities = internal_by_state[state]
        external_entities = external_by_state[state]
        
        for int_item in internal_entities:
            processed += 1
            if processed % 100 == 0:
                print(f"  Processing {processed}/{total_internal}...", end='\r')
            
            best_match = None
            best_score = 0
            
            for ext_item in external_entities:
                # Calculate similarity on normalized names
                score = calculate_similarity(
                    int_item['normalized'],
                    ext_item['normalized']
                )
                
                if score > best_score:
                    best_score = score
                    best_match = ext_item
            
            if best_match and best_score >= 0.70:  # Lower threshold for analysis
                all_matches.append({
                    'internal_idx': int_item['idx'],
                    'internal_name': int_item['original'],
                    'external_idx': best_match['idx'],
                    'external_name': best_match['original'],
                    'score': best_score,
                    'state': state
                })
            else:
                unmatched.append({
                    'internal': int_item['original'],
                    'best_external': best_match['original'] if best_match else 'None',
                    'best_score': best_score,
                    'reason': f'Best score {best_score:.3f} below threshold'
                })
    
    print()
    elapsed = time.time() - start_time
    print(f"  Completed in {elapsed:.2f}s")
    print()
    
    # Analyze results at different thresholds
    print("STEP 3: Results at different thresholds...")
    print()
    
    thresholds = [0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95]
    
    print(f"{'Threshold':<12} {'Matches':>10} {'Rate':>10} {'Avg Score':>12}")
    print("-" * 46)
    
    baseline_matches = 567
    best_threshold = None
    best_count = 0
    
    for threshold in thresholds:
        matches_at_threshold = [m for m in all_matches if m['score'] >= threshold]
        count = len(matches_at_threshold)
        rate = count / len(internal_df) * 100
        avg_score = np.mean([m['score'] for m in matches_at_threshold]) if matches_at_threshold else 0
        
        diff = count - baseline_matches
        diff_str = f"({diff:+d})" if diff != 0 else ""
        
        print(f"{threshold:<12.0%} {count:>10} {rate:>9.1f}% {avg_score:>11.3f}  {diff_str}")
        
        if count > best_count:
            best_count = count
            best_threshold = threshold
    
    print()
    print(f"Baseline: {baseline_matches} matches")
    print(f"Best result: {best_count} at {best_threshold:.0%} threshold")
    print()
    
    # Show unmatched entities
    print("STEP 4: Analyzing unmatched entities...")
    
    # Filter unmatched at 70% threshold
    truly_unmatched = [u for u in unmatched if 'best_score' not in u or u.get('best_score', 0) < 0.70]
    
    print(f"  Total unmatched at 70% threshold: {len(truly_unmatched)}")
    print()
    
    # Categorize unmatched
    no_state_match = [u for u in truly_unmatched if 'No external entities' in u.get('reason', '')]
    low_score = [u for u in truly_unmatched if 'below threshold' in u.get('reason', '')]
    
    if no_state_match:
        print(f"  Unmatched due to no external entities in state ({len(no_state_match)}):")
        for item in no_state_match[:10]:
            print(f"    - {item['internal']}")
    
    if low_score:
        print(f"\n  Unmatched due to low similarity ({len(low_score)}):")
        for item in sorted(low_score, key=lambda x: x.get('best_score', 0), reverse=True)[:15]:
            print(f"    - {item['internal']}")
            print(f"      Best match: {item.get('best_external', 'None')} (score: {item.get('best_score', 0):.3f})")
    
    print()
    
    # Save results
    print("STEP 5: Saving results...")
    
    # Best threshold results
    best_matches = [m for m in all_matches if m['score'] >= 0.70]
    
    result_df = internal_df.copy()
    result_df['Match_Status'] = 'No Match'
    result_df['Matched_Name'] = ''
    result_df['Confidence_Score'] = 0.0
    result_df['State'] = ''
    
    for match in best_matches:
        idx = match['internal_idx']
        result_df.loc[idx, 'Match_Status'] = 'Matched'
        result_df.loc[idx, 'Matched_Name'] = match['external_name']
        result_df.loc[idx, 'Confidence_Score'] = match['score']
        result_df.loc[idx, 'State'] = match['state']
    
    result_df.to_csv('matching_results_diagnostic.csv', index=False)
    print("  Saved: matching_results_diagnostic.csv")
    
    # Unmatched analysis
    unmatched_df = pd.DataFrame(truly_unmatched)
    unmatched_df.to_csv('unmatched_analysis.csv', index=False)
    print("  Saved: unmatched_analysis.csv")
    
    print()
    print("=" * 70)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 70)
    
    return all_matches, truly_unmatched


if __name__ == "__main__":
    run_diagnostic()
