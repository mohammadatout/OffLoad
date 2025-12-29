"""
Test Script for Entity Matcher v4.0
Validates multi-stage matching and context-aware features

Run: python test_matcher_v4.py
"""

import pandas as pd
import numpy as np
import time
import sys
import re
from typing import Dict, List, Tuple, Optional, Set

try:
    import jellyfish
    import Levenshtein
    from fuzzywuzzy import fuzz
except ImportError as e:
    print(f"Missing dependency: {e}")
    sys.exit(1)


# Known cities for context validation
KNOWN_CITIES = {
    'SAN DIEGO', 'SAN FRANCISCO', 'SAN JOSE', 'SAN MATEO', 'SAN ANTONIO',
    'SAN BERNARDINO', 'SAN MARCOS', 'SANTA MONICA', 'SANTA BARBARA',
    'SANTA CRUZ', 'SANTA ANA', 'SANTA CLARA', 'SANTA FE', 'SANTA ROSA',
    'LOS ANGELES', 'NEW YORK', 'CHICAGO', 'HOUSTON', 'PHOENIX',
    'ISANTI', 'AURORA', 'BERKELEY', 'FULLERTON', 'GILROY',
}

# Entity types
ENTITY_TYPES = {
    'SCHOOL': ['SCHOOL', 'SCHOOLS', 'USD', 'SD', 'HSD', 'ESD', 'ISD', 'ACADEMY'],
    'COLLEGE': ['COLLEGE', 'COMMUNITY COLLEGE', 'CC', 'UNIVERSITY'],
    'CITY': ['CITY OF', 'CITY', 'TOWN OF', 'TOWN', 'VILLAGE'],
    'COUNTY': ['COUNTY OF', 'COUNTY'],
    'DISTRICT': ['DISTRICT', 'FIRE DISTRICT', 'WATER DISTRICT'],
}

US_STATES = {
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
}

# Abbreviations
ABBREVIATIONS = {
    'USD': 'UNIFIED SCHOOL DISTRICT',
    'SD': 'SCHOOL DISTRICT',
    'HSD': 'HIGH SCHOOL DISTRICT',
    'ESD': 'ELEMENTARY SCHOOL DISTRICT',
    'CC': 'COMMUNITY COLLEGE',
    'CCD': 'COMMUNITY COLLEGE DISTRICT',
    'NO': 'NUMBER',
    '#': 'NUMBER',
    'CO': 'COUNTY',
    'ST': 'SAINT',
    'MT': 'MOUNT',
    'FT': 'FORT',
}


def extract_state_and_name(full_name: str) -> Tuple[str, str]:
    if not full_name:
        return '', ''
    full_name = full_name.strip().upper()
    match = re.match(r'^([A-Z]{2})\s*[-]\s*(.+)$', full_name)
    if match and match.group(1) in US_STATES:
        return match.group(1), match.group(2).strip()
    return '', full_name


def normalize_name(name: str, expand_abbrev: bool = True) -> str:
    if not name:
        return ''
    name = name.upper().strip()
    name = name.replace('&', ' AND ')
    name = name.replace('#', ' NUMBER ')
    for char in '.,"\'()[]{}/:;\\':
        name = name.replace(char, ' ')
    name = name.replace('-', ' ')
    name = ' '.join(name.split())
    
    if expand_abbrev:
        words = name.split()
        expanded = [ABBREVIATIONS.get(w, w) for w in words]
        name = ' '.join(expanded)
        name = ' '.join(name.split())
    
    return name


def extract_city(name: str) -> Optional[str]:
    name_upper = name.upper()
    for city in KNOWN_CITIES:
        if city in name_upper:
            return city
    match = re.search(r'CITY\s+OF\s+(\w+(?:\s+\w+)?)', name_upper)
    if match:
        return match.group(1).strip()
    return None


def extract_entity_type(name: str) -> str:
    name_upper = name.upper()
    for etype, keywords in ENTITY_TYPES.items():
        for keyword in keywords:
            if keyword in name_upper:
                return etype
    return 'OTHER'


def get_sorted_tokens(name: str) -> str:
    return ' '.join(sorted(name.split()))


def calculate_similarity(name1: str, name2: str, sorted1: str, sorted2: str,
                        city1: Optional[str], city2: Optional[str],
                        type1: str, type2: str) -> Tuple[float, Dict]:
    """Calculate similarity with context validation"""
    
    if not name1 or not name2:
        return 0.0, {}
    
    # Exact match
    if name1 == name2:
        return 1.0, {'reason': 'exact'}
    
    # Sorted tokens exact match (word order independent)
    if sorted1 == sorted2:
        return 0.98, {'reason': 'exact_sorted'}
    
    # Calculate component scores
    components = {}
    
    # Token sort ratio (handles word reordering)
    components['token_sort'] = fuzz.token_sort_ratio(name1, name2) / 100.0
    
    # Token set ratio (handles subsets)
    components['token_set'] = fuzz.token_set_ratio(name1, name2) / 100.0
    
    # Jaro-Winkler
    components['jaro_winkler'] = jellyfish.jaro_winkler_similarity(name1, name2)
    
    # Levenshtein
    components['levenshtein'] = Levenshtein.ratio(name1, name2)
    
    # Sorted tokens similarity
    components['sorted_tokens'] = Levenshtein.ratio(sorted1, sorted2)
    
    # Weighted sum (higher weight on token-based)
    weights = {
        'token_sort': 0.30,
        'token_set': 0.25,
        'jaro_winkler': 0.20,
        'levenshtein': 0.15,
        'sorted_tokens': 0.10,
    }
    
    score = sum(weights[k] * components[k] for k in weights)
    
    # Context validation
    context_penalty = 0
    context_notes = {}
    
    # City mismatch penalty
    if city1 and city2 and city1 != city2:
        context_penalty = 0.15
        context_notes['city_mismatch'] = f"{city1} vs {city2}"
    elif city1 and city2 and city1 == city2:
        score = min(1.0, score + 0.05)
        context_notes['city_match'] = city1
    
    # Entity type mismatch
    if type1 != type2 and type1 != 'OTHER' and type2 != 'OTHER':
        context_penalty += 0.05
        context_notes['type_mismatch'] = f"{type1} vs {type2}"
    
    final_score = max(0, score - context_penalty)
    
    return final_score, {'components': components, 'context': context_notes, 'penalty': context_penalty}


def run_test():
    """Run comprehensive test"""
    
    print("=" * 70)
    print("ENTITY MATCHER v4.0 - MULTI-STAGE TEST")
    print("=" * 70)
    print()
    
    # Load data
    print("Loading data...")
    internal_df = pd.read_csv('National_CRR_Intern_List.csv')
    external_df = pd.read_csv('SAVM_External_List.csv')
    print(f"  Internal: {len(internal_df):,} records")
    print(f"  External: {len(external_df):,} records")
    print()
    
    # Preprocess
    print("Preprocessing...")
    
    internal_data = {}
    for idx, row in internal_df.iterrows():
        full_name = str(row['Full_Entity_Name']) if pd.notna(row['Full_Entity_Name']) else ''
        state, core = extract_state_and_name(full_name)
        norm = normalize_name(core)
        internal_data[idx] = {
            'original': full_name,
            'state': state,
            'normalized': norm,
            'sorted': get_sorted_tokens(norm),
            'city': extract_city(core),
            'type': extract_entity_type(core),
        }
    
    external_data = {}
    external_by_state = {}
    
    for idx, row in external_df.iterrows():
        full_name = str(row['Company Name']) if pd.notna(row['Company Name']) else ''
        state, core = extract_state_and_name(full_name)
        norm = normalize_name(core)
        external_data[idx] = {
            'original': full_name,
            'state': state,
            'normalized': norm,
            'sorted': get_sorted_tokens(norm),
            'city': extract_city(core),
            'type': extract_entity_type(core),
        }
        if state not in external_by_state:
            external_by_state[state] = []
        external_by_state[state].append(idx)
    
    print(f"  Preprocessed {len(internal_data)} internal, {len(external_data)} external")
    print()
    
    # Multi-stage matching
    print("Running multi-stage matching...")
    start_time = time.time()
    
    results = {
        'stage_0_exact': [],
        'stage_1_high': [],      # >= 95%
        'stage_2_confident': [], # >= 85%
        'stage_3_probable': [],  # >= 70%
        'stage_4_review': [],    # < 70% or context issues
        'unmatched': []
    }
    
    matched_internal = set()
    matched_external = set()
    
    # STAGE 0: Exact matches
    print("  Stage 0: Exact matches...")
    for int_idx, int_rec in internal_data.items():
        state = int_rec['state']
        if state not in external_by_state:
            continue
        
        for ext_idx in external_by_state[state]:
            ext_rec = external_data[ext_idx]
            if int_rec['normalized'] == ext_rec['normalized']:
                results['stage_0_exact'].append({
                    'int_idx': int_idx,
                    'ext_idx': ext_idx,
                    'score': 1.0,
                    'stage': 'exact'
                })
                matched_internal.add(int_idx)
                matched_external.add(ext_idx)
                break
    
    print(f"    Found {len(results['stage_0_exact'])} exact matches")
    
    # STAGES 1-4: Similarity matching
    print("  Stages 1-4: Similarity matching...")
    remaining = [idx for idx in internal_data if idx not in matched_internal]
    
    for i, int_idx in enumerate(remaining):
        if (i + 1) % 100 == 0:
            print(f"    Processing {i+1}/{len(remaining)}...", end='\r')
        
        int_rec = internal_data[int_idx]
        state = int_rec['state']
        
        if state not in external_by_state:
            results['unmatched'].append({
                'int_idx': int_idx,
                'reason': f'No external in state {state}'
            })
            continue
        
        candidates = [c for c in external_by_state[state] if c not in matched_external]
        
        if not candidates:
            results['unmatched'].append({
                'int_idx': int_idx,
                'reason': 'All candidates already matched'
            })
            continue
        
        # Find best matches
        all_matches = []
        for ext_idx in candidates:
            ext_rec = external_data[ext_idx]
            
            score, details = calculate_similarity(
                int_rec['normalized'], ext_rec['normalized'],
                int_rec['sorted'], ext_rec['sorted'],
                int_rec['city'], ext_rec['city'],
                int_rec['type'], ext_rec['type']
            )
            
            if score >= 0.50:
                all_matches.append({
                    'int_idx': int_idx,
                    'ext_idx': ext_idx,
                    'score': score,
                    'details': details,
                    'ext_name': ext_rec['original']
                })
        
        all_matches.sort(key=lambda x: x['score'], reverse=True)
        
        if not all_matches:
            results['unmatched'].append({
                'int_idx': int_idx,
                'reason': 'No matches above 50%'
            })
            continue
        
        best = all_matches[0]
        score = best['score']
        has_context_issue = best['details'].get('penalty', 0) > 0
        
        # Categorize
        if score >= 0.95:
            best['stage'] = 'high_confidence'
            results['stage_1_high'].append(best)
            matched_internal.add(int_idx)
            matched_external.add(best['ext_idx'])
        elif score >= 0.85:
            best['stage'] = 'confident'
            results['stage_2_confident'].append(best)
            matched_internal.add(int_idx)
            matched_external.add(best['ext_idx'])
        elif score >= 0.70 and not has_context_issue:
            best['stage'] = 'probable'
            results['stage_3_probable'].append(best)
            matched_internal.add(int_idx)
            matched_external.add(best['ext_idx'])
        else:
            # Needs review - add top 3
            best['stage'] = 'review'
            best['top_3'] = all_matches[:3]
            results['stage_4_review'].append(best)
    
    print()
    elapsed = time.time() - start_time
    print(f"  Completed in {elapsed:.2f}s")
    print()
    
    # Summary
    print("=" * 70)
    print("RESULTS SUMMARY")
    print("=" * 70)
    print()
    
    total_matched = (
        len(results['stage_0_exact']) +
        len(results['stage_1_high']) +
        len(results['stage_2_confident']) +
        len(results['stage_3_probable']) +
        len(results['stage_4_review'])
    )
    
    auto_matched = (
        len(results['stage_0_exact']) +
        len(results['stage_1_high']) +
        len(results['stage_2_confident'])
    )
    
    print(f"{'Stage':<30} {'Count':>10} {'%':>8}")
    print("-" * 50)
    print(f"{'Stage 0: Exact':<30} {len(results['stage_0_exact']):>10} {len(results['stage_0_exact'])/len(internal_df)*100:>7.1f}%")
    print(f"{'Stage 1: High Confidence (>=95%)':<30} {len(results['stage_1_high']):>10} {len(results['stage_1_high'])/len(internal_df)*100:>7.1f}%")
    print(f"{'Stage 2: Confident (>=85%)':<30} {len(results['stage_2_confident']):>10} {len(results['stage_2_confident'])/len(internal_df)*100:>7.1f}%")
    print(f"{'Stage 3: Probable (>=70%)':<30} {len(results['stage_3_probable']):>10} {len(results['stage_3_probable'])/len(internal_df)*100:>7.1f}%")
    print(f"{'Stage 4: Needs Review':<30} {len(results['stage_4_review']):>10} {len(results['stage_4_review'])/len(internal_df)*100:>7.1f}%")
    print("-" * 50)
    print(f"{'Total Matched':<30} {total_matched:>10} {total_matched/len(internal_df)*100:>7.1f}%")
    print(f"{'Auto-Matched (>=85%)':<30} {auto_matched:>10} {auto_matched/len(internal_df)*100:>7.1f}%")
    print(f"{'Unmatched':<30} {len(results['unmatched']):>10} {len(results['unmatched'])/len(internal_df)*100:>7.1f}%")
    print()
    
    # Baseline comparison
    baseline = 567
    print(f"Baseline (v2): {baseline} matches")
    print(f"v3 Result: 579 matches")
    print(f"v4 Result: {total_matched} matches (diff: {total_matched - baseline:+d})")
    print()
    
    # Show items needing review
    print("=" * 70)
    print("ITEMS NEEDING REVIEW (Context Issues)")
    print("=" * 70)
    
    context_issues = [r for r in results['stage_4_review'] if r['details'].get('penalty', 0) > 0]
    
    if context_issues:
        print(f"\n{len(context_issues)} items with context issues:\n")
        for item in context_issues[:10]:
            int_rec = internal_data[item['int_idx']]
            print(f"  Internal: {int_rec['original']}")
            print(f"  Matched:  {item['ext_name']}")
            print(f"  Score:    {item['score']:.3f}")
            print(f"  Context:  {item['details'].get('context', {})}")
            print(f"  Top 3:")
            for m in item.get('top_3', [])[:3]:
                print(f"    - {m['ext_name']} ({m['score']:.3f})")
            print()
    else:
        print("\nNo items with context issues!")
    
    # Validate specific test cases
    print("=" * 70)
    print("SPECIFIC TEST CASES")
    print("=" * 70)
    print()
    
    # Test Case 1: Word order (ISANTI COUNTY vs COUNTY OF ISANTI)
    print("Test 1: Word order tolerance (ISANTI COUNTY vs COUNTY OF ISANTI)")
    name1 = normalize_name("ISANTI COUNTY")
    name2 = normalize_name("COUNTY OF ISANTI")
    sorted1, sorted2 = get_sorted_tokens(name1), get_sorted_tokens(name2)
    score, details = calculate_similarity(name1, name2, sorted1, sorted2, None, None, 'COUNTY', 'COUNTY')
    print(f"  Name 1: {name1}")
    print(f"  Name 2: {name2}")
    print(f"  Sorted 1: {sorted1}")
    print(f"  Sorted 2: {sorted2}")
    print(f"  Score: {score:.3f}")
    print(f"  Components: {details.get('components', {})}")
    print()
    
    # Test Case 2: City mismatch (SAN MATEO vs SAN DIEGO)
    print("Test 2: City mismatch prevention (SAN MATEO vs SAN DIEGO)")
    name1 = normalize_name("SAN MATEO COMMUNITY COLLEGE DISTRICT")
    name2 = normalize_name("SAN DIEGO COMMUNITY COLLEGE DISTRICT")
    sorted1, sorted2 = get_sorted_tokens(name1), get_sorted_tokens(name2)
    city1, city2 = 'SAN MATEO', 'SAN DIEGO'
    score, details = calculate_similarity(name1, name2, sorted1, sorted2, city1, city2, 'COLLEGE', 'COLLEGE')
    print(f"  Name 1: {name1} (city: {city1})")
    print(f"  Name 2: {name2} (city: {city2})")
    print(f"  Score: {score:.3f}")
    print(f"  Context: {details.get('context', {})}")
    print(f"  Penalty: {details.get('penalty', 0)}")
    print()
    
    # Save results
    print("=" * 70)
    print("SAVING RESULTS")
    print("=" * 70)
    
    # Build result DataFrame
    result_df = internal_df.copy()
    result_df['Match_Status'] = 'No Match'
    result_df['Matched_Name'] = ''
    result_df['Confidence_Score'] = 0.0
    result_df['Match_Stage'] = ''
    result_df['Context_Notes'] = ''
    result_df['Top_3_Candidates'] = ''
    
    all_matches = (
        results['stage_0_exact'] +
        results['stage_1_high'] +
        results['stage_2_confident'] +
        results['stage_3_probable'] +
        results['stage_4_review']
    )
    
    for match in all_matches:
        idx = match['int_idx']
        ext_idx = match['ext_idx']
        
        result_df.loc[idx, 'Match_Status'] = 'Matched'
        result_df.loc[idx, 'Matched_Name'] = external_data[ext_idx]['original']
        result_df.loc[idx, 'Confidence_Score'] = round(match['score'], 4)
        result_df.loc[idx, 'Match_Stage'] = match['stage']
        
        if 'details' in match and match['details'].get('context'):
            notes = '; '.join(f"{k}: {v}" for k, v in match['details']['context'].items())
            result_df.loc[idx, 'Context_Notes'] = notes
        
        if 'top_3' in match:
            top3 = ' | '.join([f"{m['ext_name']} ({m['score']:.3f})" for m in match['top_3']])
            result_df.loc[idx, 'Top_3_Candidates'] = top3
    
    result_df = result_df.sort_values('Confidence_Score', ascending=False)
    result_df.to_csv('matching_results_v4.csv', index=False)
    print("  Saved: matching_results_v4.csv")
    
    # Save review items
    review_df = result_df[result_df['Match_Stage'] == 'review']
    review_df.to_csv('review_items_v4.csv', index=False)
    print(f"  Saved: review_items_v4.csv ({len(review_df)} items)")
    
    print()
    print("=" * 70)
    print("TEST COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    run_test()
