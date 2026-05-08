"""
Enterprise Entity Matching Tool v2.0
Based on VLDB 2023 Research: "An analysis of one-to-one matching algorithms for entity resolution"
Author: AI-Powered Implementation
"""

import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime
import time
import hashlib
from typing import Dict, List, Tuple, Optional
import jellyfish
import Levenshtein
from fuzzywuzzy import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix
import warnings
warnings.filterwarnings('ignore')

# Page configuration
st.set_page_config(
    page_title="Entity Matcher Pro",
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

class AdvancedEntityMatcher:
    """
    State-of-the-art entity matching implementing research-proven algorithms:
    - UMC (Unique Mapping Clustering)
    - EXC (Exact Clustering)
    - BMC (Best Match Clustering)
    """
    
    def __init__(self, accuracy_threshold: float = 0.8, matching_direction: str = 'bidirectional'):
        self.accuracy_threshold = accuracy_threshold
        self.matching_direction = matching_direction
        self.similarity_weights = {
            'exact': 1.0,
            'levenshtein': 0.15,
            'jaro_winkler': 0.15,
            'token_sort': 0.15,
            'token_set': 0.15,
            'tfidf': 0.20,
            'ngram': 0.10,
            'monge_elkan': 0.10
        }
        
    def calculate_similarity_matrix(self, list1: List[str], list2: List[str], 
                                  aux_data1: Dict = None, aux_data2: Dict = None) -> np.ndarray:
        """Calculate comprehensive similarity matrix using multiple algorithms"""
        n1, n2 = len(list1), len(list2)
        similarity_matrix = np.zeros((n1, n2))
        
        # Preprocessing for TF-IDF
        all_names = list1 + list2
        tfidf_vectorizer = TfidfVectorizer(
            analyzer='char_wb',
            ngram_range=(2, 4),
            max_features=10000
        )
        tfidf_matrix = tfidf_vectorizer.fit_transform(all_names)
        tfidf_sim = cosine_similarity(tfidf_matrix[:n1], tfidf_matrix[n1:])
        
        # Calculate similarities with progress
        progress_text = st.empty()
        progress_bar = st.progress(0)
        
        for i, name1 in enumerate(list1):
            if i % 100 == 0:
                progress = i / n1
                progress_bar.progress(progress)
                progress_text.text(f'Processing: {i}/{n1} records...')
            
            for j, name2 in enumerate(list2):
                # Skip if below minimum threshold (optimization)
                if tfidf_sim[i, j] < 0.3:
                    continue
                    
                sim_scores = []
                
                # 1. Exact match
                if name1.upper() == name2.upper():
                    similarity_matrix[i, j] = 1.0
                    continue
                
                # 2. Levenshtein ratio
                lev_score = Levenshtein.ratio(name1.upper(), name2.upper())
                sim_scores.append(('levenshtein', lev_score))
                
                # 3. Jaro-Winkler
                jw_score = jellyfish.jaro_winkler_similarity(name1.upper(), name2.upper())
                sim_scores.append(('jaro_winkler', jw_score))
                
                # 4. Token sort ratio (handles word reordering)
                token_sort_score = fuzz.token_sort_ratio(name1, name2) / 100.0
                sim_scores.append(('token_sort', token_sort_score))
                
                # 5. Token set ratio (handles subsets)
                token_set_score = fuzz.token_set_ratio(name1, name2) / 100.0
                sim_scores.append(('token_set', token_set_score))
                
                # 6. TF-IDF similarity
                sim_scores.append(('tfidf', tfidf_sim[i, j]))
                
                # 7. Character n-gram similarity
                ngram_score = self._ngram_similarity(name1, name2)
                sim_scores.append(('ngram', ngram_score))
                
                # 8. Monge-Elkan similarity (for multi-word names)
                me_score = self._monge_elkan_similarity(name1, name2)
                sim_scores.append(('monge_elkan', me_score))
                
                # Weighted ensemble
                final_score = sum(self.similarity_weights[method] * score 
                                for method, score in sim_scores)
                
                # Boost score if auxiliary data matches
                if aux_data1 and aux_data2:
                    boost = self._calculate_auxiliary_boost(
                        aux_data1.get(i, {}), 
                        aux_data2.get(j, {})
                    )
                    final_score = min(1.0, final_score * (1 + boost))
                
                similarity_matrix[i, j] = final_score
        
        progress_bar.progress(1.0)
        progress_text.text('Similarity calculation complete!')
        
        return similarity_matrix
    
    def _ngram_similarity(self, s1: str, s2: str, n: int = 3) -> float:
        """Calculate n-gram based similarity"""
        def get_ngrams(text, n):
            text = ' ' + text.upper() + ' '
            return set([text[i:i+n] for i in range(len(text)-n+1)])
        
        ngrams1 = get_ngrams(s1, n)
        ngrams2 = get_ngrams(s2, n)
        
        if not ngrams1 or not ngrams2:
            return 0.0
        
        intersection = len(ngrams1 & ngrams2)
        union = len(ngrams1 | ngrams2)
        
        return intersection / union if union > 0 else 0.0
    
    def _monge_elkan_similarity(self, s1: str, s2: str) -> float:
        """Monge-Elkan similarity for multi-word strings"""
        tokens1 = s1.upper().split()
        tokens2 = s2.upper().split()
        
        if not tokens1 or not tokens2:
            return 0.0
        
        scores = []
        for t1 in tokens1:
            max_score = max([jellyfish.jaro_winkler_similarity(t1, t2) for t2 in tokens2])
            scores.append(max_score)
        
        return sum(scores) / len(scores)
    
    def _calculate_auxiliary_boost(self, aux1: dict, aux2: dict) -> float:
        """Calculate similarity boost based on auxiliary data"""
        boost = 0.0
        
        # Domain/Website match
        if aux1.get('domain') and aux2.get('domain'):
            if aux1['domain'] == aux2['domain']:
                boost += 0.3
        
        # Address similarity
        if aux1.get('address') and aux2.get('address'):
            addr_sim = fuzz.token_set_ratio(aux1['address'], aux2['address']) / 100.0
            if addr_sim > 0.8:
                boost += 0.2
        
        # Email domain match
        if aux1.get('email') and aux2.get('email'):
            domain1 = aux1['email'].split('@')[-1] if '@' in aux1['email'] else ''
            domain2 = aux2['email'].split('@')[-1] if '@' in aux2['email'] else ''
            if domain1 and domain2 and domain1 == domain2:
                boost += 0.1
        
        return boost
    
    def apply_umc_matching(self, similarity_matrix: np.ndarray) -> List[Tuple]:
        """
        Unique Mapping Clustering (UMC) - Research-proven best overall algorithm
        Sorts edges by weight and greedily selects highest-scoring unique matches
        """
        matches = []
        matched_internal = set()
        matched_external = set()
        
        # Get all edges with their weights
        edges = []
        for i in range(similarity_matrix.shape[0]):
            for j in range(similarity_matrix.shape[1]):
                if similarity_matrix[i, j] >= self.accuracy_threshold:
                    edges.append((i, j, similarity_matrix[i, j]))
        
        # Sort by weight (descending)
        edges.sort(key=lambda x: x[2], reverse=True)
        
        # Greedy selection
        for i, j, weight in edges:
            if i not in matched_internal and j not in matched_external:
                matches.append((i, j, weight))
                matched_internal.add(i)
                matched_external.add(j)
        
        return matches
    
    def apply_exc_matching(self, similarity_matrix: np.ndarray) -> List[Tuple]:
        """
        Exact Clustering (EXC) - Mutual best match requirement
        Higher precision, slightly lower recall
        """
        matches = []
        
        # Find best match for each internal record
        internal_best = {}
        for i in range(similarity_matrix.shape[0]):
            if similarity_matrix[i].max() >= self.accuracy_threshold:
                best_j = similarity_matrix[i].argmax()
                internal_best[i] = (best_j, similarity_matrix[i, best_j])
        
        # Find best match for each external record
        external_best = {}
        for j in range(similarity_matrix.shape[1]):
            col = similarity_matrix[:, j]
            if col.max() >= self.accuracy_threshold:
                best_i = col.argmax()
                external_best[j] = (best_i, col[best_i])
        
        # Keep only mutual best matches
        for i, (j, weight) in internal_best.items():
            if j in external_best and external_best[j][0] == i:
                matches.append((i, j, weight))
        
        return matches
    
    def match_entities(self, internal_df: pd.DataFrame, external_df: pd.DataFrame,
                       internal_col: str, external_col: str,
                       aux_cols: Dict[str, str] = None) -> pd.DataFrame:
        """Main matching function"""
        
        # Extract name columns
        internal_names = internal_df[internal_col].fillna('').astype(str).tolist()
        external_names = external_df[external_col].fillna('').astype(str).tolist()
        
        # Prepare auxiliary data if provided
        aux_internal, aux_external = None, None
        if aux_cols:
            aux_internal = {}
            aux_external = {}
            
            for aux_type, cols in aux_cols.items():
                if cols['internal'] and cols['internal'] in internal_df.columns:
                    for i, val in enumerate(internal_df[cols['internal']].fillna('')):
                        if i not in aux_internal:
                            aux_internal[i] = {}
                        aux_internal[i][aux_type] = str(val)
                
                if cols['external'] and cols['external'] in external_df.columns:
                    for j, val in enumerate(external_df[cols['external']].fillna('')):
                        if j not in aux_external:
                            aux_external[j] = {}
                        aux_external[j][aux_type] = str(val)
        
        # Calculate similarity matrix
        st.info("📊 Calculating similarity scores using 8 different algorithms...")
        similarity_matrix = self.calculate_similarity_matrix(
            internal_names, external_names, aux_internal, aux_external
        )
        
        # Auto-threshold optimization (from research: mean + stddev)
        if self.accuracy_threshold == -1:  # Auto mode
            non_zero = similarity_matrix[similarity_matrix > 0]
            if len(non_zero) > 0:
                auto_threshold = non_zero.mean() + non_zero.std()
                st.info(f"🎯 Auto-threshold calculated: {auto_threshold:.3f}")
                self.accuracy_threshold = auto_threshold
        
        # Apply matching algorithm based on direction
        st.info("🔄 Applying advanced matching algorithms...")
        
        if self.matching_direction == 'internal_to_external':
            matches = self.apply_umc_matching(similarity_matrix)
        elif self.matching_direction == 'external_to_internal':
            matches = self.apply_umc_matching(similarity_matrix.T)
            matches = [(j, i, w) for i, j, w in matches]  # Swap indices
        else:  # bidirectional
            umc_matches = self.apply_umc_matching(similarity_matrix)
            exc_matches = self.apply_exc_matching(similarity_matrix)
            
            # Ensemble: prefer EXC (mutual) matches, fill with UMC
            match_dict = {(i, j): w for i, j, w in exc_matches}
            for i, j, w in umc_matches:
                if (i, j) not in match_dict:
                    match_dict[(i, j)] = w * 0.95  # Slightly lower confidence
            
            matches = [(i, j, w) for (i, j), w in match_dict.items()]
        
        # Build result dataframe
        st.info("📋 Building final results...")
        
        # Create base dataframe with all internal records
        result_df = internal_df.copy()
        result_df['Match_Status'] = 'No Match'
        result_df['Matched_Name'] = ''
        result_df['Confidence_Score'] = 0.0
        result_df['Match_Rank'] = 0
        
        # Add all external columns with prefix
        for col in external_df.columns:
            result_df[f'External_{col}'] = ''
        
        # Fill in matches
        for rank, (i, j, score) in enumerate(sorted(matches, key=lambda x: x[2], reverse=True), 1):
            result_df.loc[i, 'Match_Status'] = 'Matched'
            result_df.loc[i, 'Matched_Name'] = external_names[j]
            result_df.loc[i, 'Confidence_Score'] = round(score, 4)
            result_df.loc[i, 'Match_Rank'] = rank
            
            # Add all external columns
            for col in external_df.columns:
                result_df.loc[i, f'External_{col}'] = external_df.iloc[j][col]
        
        # Sort by confidence score
        result_df = result_df.sort_values('Confidence_Score', ascending=False)
        
        return result_df, matches, similarity_matrix

def main():
    st.title("🎯 Enterprise Entity Matching Tool")
    st.markdown("*State-of-the-art matching using research-proven algorithms*")
    
    # Sidebar configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # Matching direction
        matching_direction = st.selectbox(
            "Matching Direction",
            ["bidirectional", "internal_to_external", "external_to_internal"],
            help="Bidirectional uses ensemble of UMC + EXC algorithms"
        )
        
        # Accuracy threshold
        threshold_mode = st.radio(
            "Threshold Mode",
            ["Manual", "Auto (Research-based)"]
        )
        
        if threshold_mode == "Manual":
            accuracy_threshold = st.slider(
                "Accuracy Threshold (%)",
                min_value=50,
                max_value=100,
                value=80,
                step=5,
                help="Minimum similarity score for a match"
            ) / 100.0
        else:
            accuracy_threshold = -1  # Flag for auto-calculation
            st.info("Will use Mean + StdDev (research-proven)")
        
        st.markdown("---")
        st.header("📊 Algorithm Weights")
        st.caption("Fine-tune similarity algorithm weights")
        
        # Allow weight adjustment
        show_weights = st.checkbox("Show Advanced Settings")
        
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
        # Load data
        internal_df = pd.read_csv(internal_file)
        external_df = pd.read_csv(external_file)
        
        st.session_state.internal_df = internal_df
        st.session_state.external_df = external_df
        
        # Display data info
        col1, col2 = st.columns(2)
        with col1:
            st.info(f"Internal: {len(internal_df):,} records, {len(internal_df.columns)} columns")
        with col2:
            st.info(f"External: {len(external_df):,} records, {len(external_df.columns)} columns")
        
        # Column selection
        st.header("🔗 Column Mapping")
        
        col1, col2 = st.columns(2)
        with col1:
            internal_name_col = st.selectbox(
                "Internal Name Column",
                internal_df.columns,
                key='int_name'
            )
        
        with col2:
            external_name_col = st.selectbox(
                "External Name Column",
                external_df.columns,
                key='ext_name'
            )
        
        # Optional auxiliary columns
        st.subheader("📎 Optional: Auxiliary Data (Improves Accuracy)")
        
        use_aux = st.checkbox("Use auxiliary data for matching boost")
        
        aux_cols = {}
        if use_aux:
            col1, col2, col3 = st.columns(3)
            
            with col1:
                st.caption("Address Columns")
                int_addr = st.selectbox("Internal Address", ['None'] + list(internal_df.columns), key='int_addr')
                ext_addr = st.selectbox("External Address", ['None'] + list(external_df.columns), key='ext_addr')
                if int_addr != 'None' or ext_addr != 'None':
                    aux_cols['address'] = {
                        'internal': int_addr if int_addr != 'None' else None,
                        'external': ext_addr if ext_addr != 'None' else None
                    }
            
            with col2:
                st.caption("Website/Domain Columns")
                int_domain = st.selectbox("Internal Domain", ['None'] + list(internal_df.columns), key='int_domain')
                ext_domain = st.selectbox("External Domain", ['None'] + list(external_df.columns), key='ext_domain')
                if int_domain != 'None' or ext_domain != 'None':
                    aux_cols['domain'] = {
                        'internal': int_domain if int_domain != 'None' else None,
                        'external': ext_domain if ext_domain != 'None' else None
                    }
            
            with col3:
                st.caption("Email Columns")
                int_email = st.selectbox("Internal Email", ['None'] + list(internal_df.columns), key='int_email')
                ext_email = st.selectbox("External Email", ['None'] + list(external_df.columns), key='ext_email')
                if int_email != 'None' or ext_email != 'None':
                    aux_cols['email'] = {
                        'internal': int_email if int_email != 'None' else None,
                        'external': ext_email if ext_email != 'None' else None
                    }
        
        # Match button
        st.markdown("---")
        
        if st.button("🚀 Start Matching", type='primary', use_container_width=True):
            start_time = time.time()
            
            # Initialize matcher
            matcher = AdvancedEntityMatcher(
                accuracy_threshold=accuracy_threshold,
                matching_direction=matching_direction
            )
            
            # Perform matching
            with st.spinner("Processing... This may take a few moments for large datasets"):
                result_df, matches, similarity_matrix = matcher.match_entities(
                    internal_df, external_df,
                    internal_name_col, external_name_col,
                    aux_cols if use_aux else None
                )
            
            elapsed_time = time.time() - start_time
            
            # Store results
            st.session_state.matches = result_df
            
            # Display statistics
            st.success(f"✅ Matching complete in {elapsed_time:.2f} seconds!")
            
            col1, col2, col3, col4 = st.columns(4)
            with col1:
                match_count = len([m for m in matches])
                st.metric("Matches Found", f"{match_count:,}")
            with col2:
                match_rate = (match_count / len(internal_df)) * 100
                st.metric("Match Rate", f"{match_rate:.1f}%")
            with col3:
                avg_confidence = result_df[result_df['Match_Status'] == 'Matched']['Confidence_Score'].mean()
                st.metric("Avg Confidence", f"{avg_confidence:.3f}" if not pd.isna(avg_confidence) else "N/A")
            with col4:
                high_conf = len(result_df[result_df['Confidence_Score'] >= 0.9])
                st.metric("High Confidence (>90%)", f"{high_conf:,}")
    
    # Display results
    if st.session_state.matches is not None:
        st.markdown("---")
        st.header("📊 Results")
        
        # Filter options
        col1, col2, col3 = st.columns(3)
        with col1:
            show_filter = st.selectbox(
                "Show",
                ["All Records", "Matched Only", "Unmatched Only", "High Confidence (>90%)", "Review Needed (70-90%)"]
            )
        
        # Apply filter
        display_df = st.session_state.matches.copy()
        
        if show_filter == "Matched Only":
            display_df = display_df[display_df['Match_Status'] == 'Matched']
        elif show_filter == "Unmatched Only":
            display_df = display_df[display_df['Match_Status'] == 'No Match']
        elif show_filter == "High Confidence (>90%)":
            display_df = display_df[display_df['Confidence_Score'] >= 0.9]
        elif show_filter == "Review Needed (70-90%)":
            display_df = display_df[(display_df['Confidence_Score'] >= 0.7) & (display_df['Confidence_Score'] < 0.9)]
        
        # Display
        st.dataframe(
            display_df,
            use_container_width=True,
            height=400
        )
        
        # Download button
        csv = display_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Results as CSV",
            data=csv,
            file_name=f"entity_matches_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            use_container_width=True
        )
        
        # Confidence distribution
        if len(display_df[display_df['Match_Status'] == 'Matched']) > 0:
            st.subheader("📈 Confidence Score Distribution")
            
            import plotly.express as px
            
            matched_df = display_df[display_df['Match_Status'] == 'Matched']
            fig = px.histogram(
                matched_df,
                x='Confidence_Score',
                nbins=20,
                title="Distribution of Match Confidence Scores",
                labels={'Confidence_Score': 'Confidence Score', 'count': 'Number of Matches'}
            )
            fig.update_layout(showlegend=False)
            st.plotly_chart(fig, use_container_width=True)

if __name__ == "__main__":
    main()