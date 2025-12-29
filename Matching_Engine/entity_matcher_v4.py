"""
Enterprise Entity Matching Tool v4.0 - Context-Aware Multi-Stage Matching
Improvements:
- Multi-stage matching (Exact → High Confidence → Enhanced → Top-3 Review)
- Context-aware matching (City/Entity Type validation)
- Enhanced word-order tolerance
- User-configurable abbreviation dictionary
- Abbreviation expansion for unmatched

Based on VLDB 2023 Research + User Feedback Enhancements
"""

import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime
import time
import gc
import re
import json
from typing import Dict, List, Tuple, Optional, Set
import jellyfish
import Levenshtein
from fuzzywuzzy import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
import warnings
warnings.filterwarnings('ignore')

# Page configuration
st.set_page_config(
    page_title="Entity Matcher Pro v4.0",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'matches' not in st.session_state:
    st.session_state.matches = None
if 'internal_df' not in st.session_state:
    st.session_state.internal_df = None
if 'external_df' not in st.session_state:
    st.session_state.external_df = None
if 'abbreviations' not in st.session_state:
    st.session_state.abbreviations = None
if 'context_config' not in st.session_state:
    st.session_state.context_config = {}


# Default abbreviations dictionary
DEFAULT_ABBREVIATIONS = {
    # School Districts
    'USD': 'UNIFIED SCHOOL DISTRICT',
    'SD': 'SCHOOL DISTRICT',
    'HSD': 'HIGH SCHOOL DISTRICT',
    'ESD': 'ELEMENTARY SCHOOL DISTRICT',
    'UHSD': 'UNION HIGH SCHOOL DISTRICT',
    'UESD': 'UNION ELEMENTARY SCHOOL DISTRICT',
    'CUSD': 'COMMUNITY UNIFIED SCHOOL DISTRICT',
    'JUSD': 'JOINT UNIFIED SCHOOL DISTRICT',
    'JUHSD': 'JOINT UNION HIGH SCHOOL DISTRICT',
    'ISD': 'INDEPENDENT SCHOOL DISTRICT',
    'CSD': 'CENTRAL SCHOOL DISTRICT',
    'UFSD': 'UNION FREE SCHOOL DISTRICT',
    'JTED': 'JOINT TECHNICAL EDUCATION DISTRICT',
    
    # Community Colleges
    'CC': 'COMMUNITY COLLEGE',
    'CCD': 'COMMUNITY COLLEGE DISTRICT',
    
    # Government
    'CO': 'COUNTY',
    'CTY': 'CITY',
    'TWP': 'TOWNSHIP',
    'BORO': 'BOROUGH',
    'MUN': 'MUNICIPAL',
    'GOVT': 'GOVERNMENT',
    'DIST': 'DISTRICT',
    'AUTH': 'AUTHORITY',
    'DEPT': 'DEPARTMENT',
    'BD': 'BOARD',
    'CTR': 'CENTER',
    'HOSP': 'HOSPITAL',
    'UNIV': 'UNIVERSITY',
    'COLL': 'COLLEGE',
    'ACAD': 'ACADEMY',
    'INST': 'INSTITUTE',
    'ASSN': 'ASSOCIATION',
    'ASSOC': 'ASSOCIATION',
    
    # Common
    'NO': 'NUMBER',
    '#': 'NUMBER',
    'N': 'NORTH',
    'S': 'SOUTH',
    'E': 'EAST',
    'W': 'WEST',
    'MT': 'MOUNT',
    'FT': 'FORT',
    'ST': 'SAINT',
    'VLG': 'VILLAGE',
    'HTS': 'HEIGHTS',
    'SPGS': 'SPRINGS',
}

# Known US cities for context validation (major cities)
KNOWN_CITIES = {
    'SAN DIEGO', 'SAN FRANCISCO', 'SAN JOSE', 'SAN MATEO', 'SAN ANTONIO',
    'SAN BERNARDINO', 'SAN MARCOS', 'SANTA MONICA', 'SANTA BARBARA',
    'SANTA CRUZ', 'SANTA ANA', 'SANTA CLARA', 'SANTA FE', 'SANTA ROSA',
    'LOS ANGELES', 'NEW YORK', 'CHICAGO', 'HOUSTON', 'PHOENIX',
    'PHILADELPHIA', 'DALLAS', 'AUSTIN', 'JACKSONVILLE', 'COLUMBUS',
    'CHARLOTTE', 'INDIANAPOLIS', 'SEATTLE', 'DENVER', 'BOSTON',
    'DETROIT', 'NASHVILLE', 'PORTLAND', 'MEMPHIS', 'OKLAHOMA CITY',
    'LAS VEGAS', 'LOUISVILLE', 'BALTIMORE', 'MILWAUKEE', 'ALBUQUERQUE',
    'TUCSON', 'FRESNO', 'SACRAMENTO', 'LONG BEACH', 'KANSAS CITY',
    'MESA', 'ATLANTA', 'COLORADO SPRINGS', 'RALEIGH', 'OMAHA',
    'MIAMI', 'OAKLAND', 'MINNEAPOLIS', 'TULSA', 'WICHITA',
    'NEW ORLEANS', 'ARLINGTON', 'CLEVELAND', 'BAKERSFIELD', 'TAMPA',
    'AURORA', 'ANAHEIM', 'HONOLULU', 'RIVERSIDE', 'STOCKTON',
    'CORPUS CHRISTI', 'IRVINE', 'CINCINNATI', 'ORLANDO', 'PITTSBURGH',
    'ST LOUIS', 'GREENSBORO', 'JERSEY CITY', 'ANCHORAGE', 'LINCOLN',
    'PLANO', 'BUFFALO', 'HENDERSON', 'FORT WORTH', 'LEXINGTON',
}

# Entity type keywords for context matching
ENTITY_TYPES = {
    'SCHOOL': ['SCHOOL', 'SCHOOLS', 'USD', 'SD', 'HSD', 'ESD', 'ISD', 'ACADEMY', 'EDUCATION'],
    'COLLEGE': ['COLLEGE', 'COMMUNITY COLLEGE', 'CC', 'CCD', 'UNIVERSITY', 'UNIV'],
    'CITY': ['CITY OF', 'CITY', 'TOWN OF', 'TOWN', 'VILLAGE OF', 'VILLAGE', 'BOROUGH'],
    'COUNTY': ['COUNTY OF', 'COUNTY', 'PARISH'],
    'DISTRICT': ['DISTRICT', 'FIRE DISTRICT', 'WATER DISTRICT', 'UTILITY'],
    'HOSPITAL': ['HOSPITAL', 'MEDICAL', 'HEALTH', 'HEALTHCARE'],
    'GOVERNMENT': ['GOVERNMENT', 'FEDERAL', 'STATE', 'MUNICIPAL'],
}

US_STATES = {
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP'
}


class ContextExtractor:
    """Extract context from entity names (city, entity type, etc.)"""
    
    @staticmethod
    def extract_city(name: str) -> Optional[str]:
        """Extract city name from entity name"""
        name_upper = name.upper()
        
        # Check for known cities
        for city in KNOWN_CITIES:
            if city in name_upper:
                return city
        
        # Try to extract city from "CITY OF X" pattern
        match = re.search(r'CITY\s+OF\s+(\w+(?:\s+\w+)?)', name_upper)
        if match:
            return match.group(1).strip()
        
        # Try pattern: X CITY
        match = re.search(r'(\w+(?:\s+\w+)?)\s+CITY(?:\s|$)', name_upper)
        if match:
            return match.group(1).strip()
        
        return None
    
    @staticmethod
    def extract_entity_type(name: str) -> str:
        """Extract entity type from name"""
        name_upper = name.upper()
        
        # Check each entity type
        for etype, keywords in ENTITY_TYPES.items():
            for keyword in keywords:
                if keyword in name_upper:
                    return etype
        
        return 'OTHER'
    
    @staticmethod
    def extract_context(name: str) -> Dict:
        """Extract all context from a name"""
        return {
            'city': ContextExtractor.extract_city(name),
            'entity_type': ContextExtractor.extract_entity_type(name),
        }


class EntityNormalizer:
    """Handles entity name normalization"""
    
    def __init__(self, abbreviations: Dict[str, str] = None):
        self.abbreviations = abbreviations or DEFAULT_ABBREVIATIONS
        # Build reverse lookup (full name -> abbreviation)
        self.reverse_abbrev = {v: k for k, v in self.abbreviations.items()}
    
    def extract_state_and_name(self, full_name: str) -> Tuple[str, str]:
        """Extract state prefix and core entity name"""
        if not full_name:
            return '', ''
        
        full_name = full_name.strip().upper()
        
        match = re.match(r'^([A-Z]{2})\s*[-–—]\s*(.+)$', full_name)
        if match:
            state = match.group(1)
            name = match.group(2).strip()
            if state in US_STATES:
                return state, name
        
        return '', full_name
    
    def normalize_name(self, name: str, expand_abbrev: bool = True) -> str:
        """Normalize entity name with special character handling"""
        if not name:
            return ''
        
        name = name.upper().strip()
        
        # Replace special characters
        name = name.replace('&', ' AND ')
        name = name.replace('#', ' NUMBER ')
        for char in '.,"\'()[]{}/:;\\':
            name = name.replace(char, ' ')
        name = name.replace('-', ' ')
        
        name = ' '.join(name.split())
        
        if expand_abbrev:
            words = name.split()
            expanded = []
            for word in words:
                expanded.append(self.abbreviations.get(word, word))
            name = ' '.join(expanded)
            name = ' '.join(name.split())
        
        return name
    
    def create_abbreviation(self, name: str) -> str:
        """Create abbreviation from full name (for 6c feature)"""
        words = name.upper().split()
        
        # Try to match known full forms
        for full, abbrev in self.reverse_abbrev.items():
            if full in name.upper():
                name = name.upper().replace(full, abbrev)
        
        # Create acronym from remaining words > 3 chars
        abbrev_parts = []
        for word in name.split():
            if word in self.abbreviations.values():
                # Find the abbreviation
                for abbr, full in self.abbreviations.items():
                    if full == word:
                        abbrev_parts.append(abbr)
                        break
            elif len(word) > 3 and word not in ['AND', 'THE', 'FOR', 'OF']:
                abbrev_parts.append(word[0])
            else:
                abbrev_parts.append(word)
        
        return ' '.join(abbrev_parts)
    
    def get_sorted_tokens(self, name: str) -> str:
        """Get alphabetically sorted tokens for word-order-independent matching"""
        tokens = sorted(name.split())
        return ' '.join(tokens)


class MultiStageEntityMatcher:
    """
    Multi-stage entity matching with context awareness
    
    Stages:
    0. Exact match (after normalization)
    1. High confidence (≥95%)
    2. Enhanced matching with context validation
    3. Top-3 candidates for review
    """
    
    def __init__(self, 
                 abbreviations: Dict[str, str] = None,
                 use_state_blocking: bool = True,
                 use_context_validation: bool = True,
                 context_config: Dict = None):
        
        self.normalizer = EntityNormalizer(abbreviations)
        self.use_state_blocking = use_state_blocking
        self.use_context_validation = use_context_validation
        self.context_config = context_config or {}
        
        # Stage thresholds
        self.exact_match_threshold = 1.0
        self.high_confidence_threshold = 0.95
        self.confident_threshold = 0.85
        self.probable_threshold = 0.70
        
        # Adjusted weights: Higher emphasis on token-based for word order tolerance
        self.similarity_weights = {
            'token_sort': 0.30,    # Increased for word order tolerance
            'token_set': 0.25,     # Good for partial matches
            'jaro_winkler': 0.20,  # Good for typos
            'levenshtein': 0.15,   # Character-level
            'sorted_tokens': 0.10, # Exact match with sorted tokens
        }
    
    def preprocess_entity(self, full_name: str) -> Dict:
        """Preprocess a single entity"""
        state, core_name = self.normalizer.extract_state_and_name(full_name)
        normalized = self.normalizer.normalize_name(core_name, expand_abbrev=True)
        context = ContextExtractor.extract_context(core_name)
        
        return {
            'original': full_name,
            'state': state,
            'core_name': core_name,
            'normalized': normalized,
            'sorted_tokens': self.normalizer.get_sorted_tokens(normalized),
            'context': context,
            'abbreviated': self.normalizer.create_abbreviation(core_name),
        }
    
    def preprocess_datasets(self, internal_df: pd.DataFrame, external_df: pd.DataFrame,
                           internal_col: str, external_col: str) -> Tuple[Dict, Dict, Dict]:
        """Preprocess both datasets"""
        
        internal_data = {}
        for idx, row in internal_df.iterrows():
            full_name = str(row[internal_col]) if pd.notna(row[internal_col]) else ''
            internal_data[idx] = self.preprocess_entity(full_name)
        
        external_data = {}
        external_by_state = {}
        
        for idx, row in external_df.iterrows():
            full_name = str(row[external_col]) if pd.notna(row[external_col]) else ''
            entity = self.preprocess_entity(full_name)
            external_data[idx] = entity
            
            state = entity['state']
            if state not in external_by_state:
                external_by_state[state] = []
            external_by_state[state].append(idx)
        
        return internal_data, external_data, external_by_state
    
    def calculate_similarity(self, data1: Dict, data2: Dict) -> Tuple[float, Dict]:
        """
        Calculate comprehensive similarity with context validation
        Returns: (score, details)
        """
        name1 = data1['normalized']
        name2 = data2['normalized']
        
        if not name1 or not name2:
            return 0.0, {'reason': 'empty'}
        
        # Quick exact match check
        if name1 == name2:
            return 1.0, {'reason': 'exact_normalized', 'components': {}}
        
        # Sorted tokens exact match (word order independent)
        if data1['sorted_tokens'] == data2['sorted_tokens']:
            return 0.98, {'reason': 'exact_sorted', 'components': {}}
        
        # Calculate component scores
        components = {}
        
        # Token sort ratio (handles word reordering like ISANTI COUNTY vs COUNTY OF ISANTI)
        components['token_sort'] = fuzz.token_sort_ratio(name1, name2) / 100.0
        
        # Token set ratio (handles subsets)
        components['token_set'] = fuzz.token_set_ratio(name1, name2) / 100.0
        
        # Jaro-Winkler (good for typos and prefixes)
        components['jaro_winkler'] = jellyfish.jaro_winkler_similarity(name1, name2)
        
        # Levenshtein ratio
        components['levenshtein'] = Levenshtein.ratio(name1, name2)
        
        # Sorted tokens similarity
        components['sorted_tokens'] = Levenshtein.ratio(
            data1['sorted_tokens'], 
            data2['sorted_tokens']
        )
        
        # Weighted sum
        score = sum(
            self.similarity_weights[k] * v 
            for k, v in components.items()
        )
        
        # Context validation penalty
        context_penalty = 0
        context_details = {}
        
        if self.use_context_validation:
            ctx1 = data1['context']
            ctx2 = data2['context']
            
            # City mismatch penalty (San Mateo vs San Diego issue)
            if ctx1['city'] and ctx2['city']:
                if ctx1['city'] != ctx2['city']:
                    # Different cities - apply penalty
                    context_penalty = 0.15
                    context_details['city_mismatch'] = f"{ctx1['city']} vs {ctx2['city']}"
                else:
                    # Same city - small bonus
                    score = min(1.0, score + 0.05)
                    context_details['city_match'] = ctx1['city']
            
            # Entity type mismatch penalty
            if ctx1['entity_type'] != ctx2['entity_type']:
                if ctx1['entity_type'] != 'OTHER' and ctx2['entity_type'] != 'OTHER':
                    context_penalty += 0.05
                    context_details['type_mismatch'] = f"{ctx1['entity_type']} vs {ctx2['entity_type']}"
        
        final_score = max(0, score - context_penalty)
        
        return final_score, {
            'components': components,
            'context_penalty': context_penalty,
            'context_details': context_details
        }
    
    def get_candidates(self, int_record: Dict, external_data: Dict, 
                      external_by_state: Dict) -> List[int]:
        """Get candidate external records for matching"""
        state = int_record['state']
        
        if self.use_state_blocking and state:
            return external_by_state.get(state, [])
        else:
            return list(external_data.keys())
    
    def find_matches_for_entity(self, int_idx: int, int_record: Dict,
                               external_data: Dict, candidates: List[int],
                               min_threshold: float = 0.60) -> List[Dict]:
        """Find all matches for a single entity above threshold"""
        matches = []
        
        for ext_idx in candidates:
            ext_record = external_data[ext_idx]
            score, details = self.calculate_similarity(int_record, ext_record)
            
            if score >= min_threshold:
                matches.append({
                    'internal_idx': int_idx,
                    'external_idx': ext_idx,
                    'score': score,
                    'details': details,
                    'external_name': ext_record['original']
                })
        
        # Sort by score descending
        matches.sort(key=lambda x: x['score'], reverse=True)
        return matches
    
    def match_entities(self, internal_df: pd.DataFrame, external_df: pd.DataFrame,
                      internal_col: str, external_col: str,
                      progress_callback=None) -> Tuple[pd.DataFrame, Dict]:
        """
        Main matching function with multi-stage processing
        """
        start_time = time.time()
        
        # Preprocess
        if progress_callback:
            progress_callback("Preprocessing datasets...", 0.1)
        
        internal_data, external_data, external_by_state = self.preprocess_datasets(
            internal_df, external_df, internal_col, external_col
        )
        
        # Initialize results
        results = {
            'stage_0_exact': [],
            'stage_1_high_confidence': [],
            'stage_2_confident': [],
            'stage_3_probable': [],
            'stage_4_review': [],
            'unmatched': []
        }
        
        matched_internal = set()
        matched_external = set()
        
        total = len(internal_data)
        
        # ===== STAGE 0: Exact Matches =====
        if progress_callback:
            progress_callback("Stage 0: Finding exact matches...", 0.2)
        
        for int_idx, int_record in internal_data.items():
            candidates = self.get_candidates(int_record, external_data, external_by_state)
            
            for ext_idx in candidates:
                ext_record = external_data[ext_idx]
                
                # Check for exact normalized match
                if int_record['normalized'] == ext_record['normalized']:
                    results['stage_0_exact'].append({
                        'internal_idx': int_idx,
                        'external_idx': ext_idx,
                        'score': 1.0,
                        'stage': 'exact',
                        'external_name': ext_record['original']
                    })
                    matched_internal.add(int_idx)
                    matched_external.add(ext_idx)
                    break
        
        # ===== STAGE 1-3: Similarity Matching =====
        if progress_callback:
            progress_callback("Stage 1-3: Calculating similarities...", 0.3)
        
        remaining_internal = [idx for idx in internal_data if idx not in matched_internal]
        
        for i, int_idx in enumerate(remaining_internal):
            if i % 50 == 0 and progress_callback:
                progress = 0.3 + (0.5 * i / len(remaining_internal))
                progress_callback(f"Processing {i}/{len(remaining_internal)}...", progress)
            
            int_record = internal_data[int_idx]
            candidates = self.get_candidates(int_record, external_data, external_by_state)
            
            # Filter out already matched external
            candidates = [c for c in candidates if c not in matched_external]
            
            if not candidates:
                results['unmatched'].append({
                    'internal_idx': int_idx,
                    'reason': f"No candidates in state {int_record['state']}"
                })
                continue
            
            # Find all matches
            matches = self.find_matches_for_entity(
                int_idx, int_record, external_data, candidates, min_threshold=0.60
            )
            
            if not matches:
                results['unmatched'].append({
                    'internal_idx': int_idx,
                    'reason': "No matches above 60% threshold"
                })
                continue
            
            best = matches[0]
            score = best['score']
            
            # Categorize by confidence
            if score >= self.high_confidence_threshold:
                best['stage'] = 'high_confidence'
                results['stage_1_high_confidence'].append(best)
                matched_internal.add(int_idx)
                matched_external.add(best['external_idx'])
            
            elif score >= self.confident_threshold:
                best['stage'] = 'confident'
                results['stage_2_confident'].append(best)
                matched_internal.add(int_idx)
                matched_external.add(best['external_idx'])
            
            elif score >= self.probable_threshold:
                # Check for context issues
                if best['details'].get('context_penalty', 0) > 0:
                    # Has context issues - send to review with top 3
                    best['stage'] = 'review'
                    best['top_3'] = matches[:3]
                    results['stage_4_review'].append(best)
                else:
                    best['stage'] = 'probable'
                    results['stage_3_probable'].append(best)
                    matched_internal.add(int_idx)
                    matched_external.add(best['external_idx'])
            
            else:
                # Below probable threshold - add to review with top 3
                best['stage'] = 'review'
                best['top_3'] = matches[:3]
                results['stage_4_review'].append(best)
        
        # ===== Build Result DataFrame =====
        if progress_callback:
            progress_callback("Building results...", 0.9)
        
        result_df = internal_df.copy()
        result_df['Match_Status'] = 'No Match'
        result_df['Matched_Name'] = ''
        result_df['Confidence_Score'] = 0.0
        result_df['Match_Stage'] = ''
        result_df['State'] = ''
        result_df['Context_Notes'] = ''
        result_df['Top_3_Candidates'] = ''
        
        for col in external_df.columns:
            result_df[f'External_{col}'] = ''
        
        # Fill in matches from all stages
        all_matches = (
            results['stage_0_exact'] +
            results['stage_1_high_confidence'] +
            results['stage_2_confident'] +
            results['stage_3_probable'] +
            results['stage_4_review']
        )
        
        for match in all_matches:
            idx = match['internal_idx']
            ext_idx = match['external_idx']
            
            result_df.loc[idx, 'Match_Status'] = 'Matched'
            result_df.loc[idx, 'Matched_Name'] = match['external_name']
            result_df.loc[idx, 'Confidence_Score'] = round(match['score'], 4)
            result_df.loc[idx, 'Match_Stage'] = match['stage']
            result_df.loc[idx, 'State'] = internal_data[idx]['state']
            
            # Context notes
            if 'details' in match and match['details'].get('context_details'):
                notes = '; '.join(f"{k}: {v}" for k, v in match['details']['context_details'].items())
                result_df.loc[idx, 'Context_Notes'] = notes
            
            # Top 3 for review
            if 'top_3' in match:
                top3 = ' | '.join([
                    f"{m['external_name']} ({m['score']:.3f})"
                    for m in match['top_3']
                ])
                result_df.loc[idx, 'Top_3_Candidates'] = top3
            
            for col in external_df.columns:
                result_df.loc[idx, f'External_{col}'] = external_df.loc[ext_idx, col]
        
        # Fill state for unmatched
        for item in results['unmatched']:
            idx = item['internal_idx']
            result_df.loc[idx, 'State'] = internal_data[idx]['state']
            result_df.loc[idx, 'Context_Notes'] = item['reason']
        
        result_df = result_df.sort_values('Confidence_Score', ascending=False)
        
        # Statistics
        elapsed = time.time() - start_time
        stats = {
            'total_internal': len(internal_df),
            'total_external': len(external_df),
            'stage_0_exact': len(results['stage_0_exact']),
            'stage_1_high_confidence': len(results['stage_1_high_confidence']),
            'stage_2_confident': len(results['stage_2_confident']),
            'stage_3_probable': len(results['stage_3_probable']),
            'stage_4_review': len(results['stage_4_review']),
            'unmatched': len(results['unmatched']),
            'total_matched': len(all_matches),
            'match_rate': len(all_matches) / len(internal_df) * 100,
            'elapsed_time': elapsed
        }
        
        if progress_callback:
            progress_callback("Complete!", 1.0)
        
        return result_df, stats


def main():
    st.title("🎯 Entity Matcher Pro v4.0")
    st.markdown("""
    *Context-aware multi-stage matching with enhanced word-order tolerance*
    
    **v4.0 Features:**
    - ✅ Multi-stage matching (Exact → High Confidence → Enhanced → Review)
    - ✅ Context-aware validation (City & Entity Type checking)
    - ✅ Enhanced word-order tolerance (ISANTI COUNTY = COUNTY OF ISANTI)
    - ✅ User-configurable abbreviation dictionary
    - ✅ Top-3 candidates for ambiguous matches
    """)
    
    # Sidebar configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # State blocking
        use_state_blocking = st.checkbox(
            "State-based Blocking",
            value=True,
            help="Only match entities within the same state (RECOMMENDED)"
        )
        
        # Context validation
        use_context_validation = st.checkbox(
            "Context Validation",
            value=True,
            help="Validate city and entity type matches (prevents San Mateo/San Diego issue)"
        )
        
        st.markdown("---")
        
        # Abbreviation management
        st.subheader("📝 Abbreviation Dictionary")
        
        with st.expander("View/Edit Abbreviations"):
            # Show current abbreviations
            abbrev_text = st.text_area(
                "Abbreviations (one per line: ABBREV=FULL NAME)",
                value='\n'.join([f"{k}={v}" for k, v in DEFAULT_ABBREVIATIONS.items()]),
                height=300,
                help="Add your custom abbreviations"
            )
            
            if st.button("Update Abbreviations"):
                try:
                    new_abbrev = {}
                    for line in abbrev_text.strip().split('\n'):
                        if '=' in line:
                            parts = line.split('=', 1)
                            new_abbrev[parts[0].strip().upper()] = parts[1].strip().upper()
                    st.session_state.abbreviations = new_abbrev
                    st.success(f"Updated {len(new_abbrev)} abbreviations")
                except Exception as e:
                    st.error(f"Error parsing: {e}")
        
        st.markdown("---")
        
        st.subheader("📊 Stage Thresholds")
        st.caption("""
        - **Exact**: 100% (normalized match)
        - **High Confidence**: ≥95%
        - **Confident**: ≥85%
        - **Probable**: ≥70%
        - **Review**: <70% (shows top 3)
        """)
    
    # Main interface
    col1, col2 = st.columns(2)
    
    with col1:
        st.header("📁 Internal Data")
        internal_file = st.file_uploader(
            "Upload Internal CSV",
            type=['csv'],
            key='internal'
        )
        
    with col2:
        st.header("📁 External Data")
        external_file = st.file_uploader(
            "Upload External CSV",
            type=['csv'],
            key='external'
        )
    
    # Process files
    if internal_file and external_file:
        internal_df = pd.read_csv(internal_file)
        external_df = pd.read_csv(external_file)
        
        st.session_state.internal_df = internal_df
        st.session_state.external_df = external_df
        
        # Display info
        col1, col2 = st.columns(2)
        with col1:
            st.info(f"📊 Internal: {len(internal_df):,} records")
            st.dataframe(internal_df.head(3), use_container_width=True)
        with col2:
            st.info(f"📊 External: {len(external_df):,} records")
            st.dataframe(external_df.head(3), use_container_width=True)
        
        # Column selection
        st.header("🔗 Column Mapping")
        
        col1, col2 = st.columns(2)
        with col1:
            internal_name_col = st.selectbox(
                "Internal Name Column",
                internal_df.columns,
                index=list(internal_df.columns).index('Full_Entity_Name') 
                    if 'Full_Entity_Name' in internal_df.columns else 0
            )
        
        with col2:
            external_name_col = st.selectbox(
                "External Name Column",
                external_df.columns,
                index=list(external_df.columns).index('Company Name') 
                    if 'Company Name' in external_df.columns else 0
            )
        
        # Match button
        st.markdown("---")
        
        if st.button("🚀 Start Multi-Stage Matching", type='primary', use_container_width=True):
            
            progress_bar = st.progress(0)
            progress_text = st.empty()
            
            def update_progress(msg, pct):
                progress_text.text(msg)
                progress_bar.progress(pct)
            
            # Get abbreviations
            abbreviations = st.session_state.abbreviations or DEFAULT_ABBREVIATIONS
            
            # Initialize matcher
            matcher = MultiStageEntityMatcher(
                abbreviations=abbreviations,
                use_state_blocking=use_state_blocking,
                use_context_validation=use_context_validation
            )
            
            # Perform matching
            result_df, stats = matcher.match_entities(
                internal_df, external_df,
                internal_name_col, external_name_col,
                progress_callback=update_progress
            )
            
            st.session_state.matches = result_df
            
            # Display statistics
            st.success(f"✅ Matching complete in {stats['elapsed_time']:.2f} seconds!")
            
            # Stage breakdown
            st.subheader("📊 Match Breakdown by Stage")
            
            col1, col2, col3, col4, col5 = st.columns(5)
            with col1:
                st.metric("Stage 0: Exact", stats['stage_0_exact'])
            with col2:
                st.metric("Stage 1: High (≥95%)", stats['stage_1_high_confidence'])
            with col3:
                st.metric("Stage 2: Confident (≥85%)", stats['stage_2_confident'])
            with col4:
                st.metric("Stage 3: Probable (≥70%)", stats['stage_3_probable'])
            with col5:
                st.metric("Stage 4: Review", stats['stage_4_review'])
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Matched", stats['total_matched'], 
                         f"{stats['match_rate']:.1f}%")
            with col2:
                st.metric("Unmatched", stats['unmatched'])
            with col3:
                auto_matched = stats['stage_0_exact'] + stats['stage_1_high_confidence'] + stats['stage_2_confident']
                st.metric("Auto-Matched (≥85%)", auto_matched)
    
    # Display results
    if st.session_state.matches is not None:
        st.markdown("---")
        st.header("📊 Results")
        
        # Filter options
        col1, col2, col3 = st.columns(3)
        with col1:
            show_filter = st.selectbox(
                "Filter by Status",
                ["All Records", "Matched Only", "Unmatched Only", 
                 "Needs Review", "High Confidence Only"]
            )
        
        with col2:
            stage_filter = st.selectbox(
                "Filter by Stage",
                ["All Stages", "exact", "high_confidence", "confident", 
                 "probable", "review"]
            )
        
        with col3:
            all_states = sorted(st.session_state.matches['State'].dropna().unique())
            state_filter = st.selectbox(
                "Filter by State",
                ["All States"] + list(all_states)
            )
        
        # Apply filters
        display_df = st.session_state.matches.copy()
        
        if show_filter == "Matched Only":
            display_df = display_df[display_df['Match_Status'] == 'Matched']
        elif show_filter == "Unmatched Only":
            display_df = display_df[display_df['Match_Status'] == 'No Match']
        elif show_filter == "Needs Review":
            display_df = display_df[display_df['Match_Stage'] == 'review']
        elif show_filter == "High Confidence Only":
            display_df = display_df[display_df['Confidence_Score'] >= 0.95]
        
        if stage_filter != "All Stages":
            display_df = display_df[display_df['Match_Stage'] == stage_filter]
        
        if state_filter != "All States":
            display_df = display_df[display_df['State'] == state_filter]
        
        st.dataframe(display_df, use_container_width=True, height=400)
        
        # Review section
        with st.expander("🔍 Items Needing Review"):
            review_df = st.session_state.matches[
                st.session_state.matches['Match_Stage'] == 'review'
            ]
            if len(review_df) > 0:
                st.warning(f"{len(review_df)} items need manual review")
                st.dataframe(
                    review_df[['Full_Entity_Name' if 'Full_Entity_Name' in review_df.columns 
                              else review_df.columns[0], 
                              'Matched_Name', 'Confidence_Score', 
                              'Context_Notes', 'Top_3_Candidates']],
                    use_container_width=True
                )
            else:
                st.success("No items need review!")
        
        # Download button
        csv = display_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Results as CSV",
            data=csv,
            file_name=f"entity_matches_v4_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            use_container_width=True
        )


if __name__ == "__main__":
    main()
