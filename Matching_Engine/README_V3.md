# Entity Matcher v3.0 - Enhanced Entity/Company Name Matching Tool

## Overview

This enhanced entity matching tool provides intelligent company/entity name matching using advanced algorithms and domain-specific optimizations for government and education entities.

## Performance Results

| Metric | Baseline (v2) | Enhanced (v3) | Improvement |
|--------|---------------|---------------|-------------|
| **Matches Found** | 567/605 | 579/605 | **+12 matches** |
| **Match Rate** | 93.7% | 95.7% | **+2.0%** |
| **False Cross-State Matches** | Possible | 0 | **Eliminated** |
| **Processing Speed** | ~30s | ~25s | **Faster** |

## Key Improvements

### 1. State-Based Blocking
- **Prevents cross-state false matches** (e.g., "San Diego" ≠ "San Antonio")
- Entities are only compared within the same state
- Dramatically reduces comparison space (47M → 1.2M comparisons)

### 2. Abbreviation Expansion
Automatically expands common abbreviations:
- `USD` → Unified School District
- `SD` → School District
- `HSD` → High School District
- `CC` → Community College
- `CO` → County
- `#` → Number
- And 80+ more abbreviations

### 3. Special Character Normalization
- `#` → `Number`
- `&` → `AND`
- Removes punctuation for cleaner matching

### 4. Phonetic Matching
- Uses Metaphone algorithm
- Catches spelling variations and typos

### 5. Multi-Algorithm Ensemble
Combines 7 similarity algorithms:
1. Levenshtein distance (18%)
2. Jaro-Winkler similarity (18%)
3. Token sort ratio (16%)
4. Token set ratio (18%)
5. N-gram Jaccard (12%)
6. Monge-Elkan (10%)
7. Phonetic similarity (8%)

### 6. UMC + EXC Matching Algorithms
Based on VLDB 2023 research paper:
- **UMC (Unique Mapping Clustering)**: Greedy best-match assignment
- **EXC (Exact Clustering)**: Mutual best-match requirement
- Ensemble approach for highest accuracy

## Files

| File | Description |
|------|-------------|
| `entity_matcher_v3.py` | Streamlit web application |
| `test_matcher.py` | Diagnostic and test script |
| `matching_results_diagnostic.csv` | Output with all matches |
| `unmatched_analysis.csv` | Analysis of unmatched entities |

## Installation

```bash
pip install streamlit pandas numpy scipy scikit-learn python-Levenshtein jellyfish fuzzywuzzy plotly
```

## Usage

### Web Application
```bash
streamlit run entity_matcher_v3.py
```

### Command-Line Testing
```bash
python test_matcher.py
```

## Unmatched Entity Analysis

Of the 26 unmatched entities at 70% threshold:

### Cannot be matched (23 entities)
States AK, CO, SD, ND are not present in the external dataset:
- AK: 2 entities
- CO: 16 entities  
- SD: 4 entities
- ND: 1 entity

**Solution**: These require adding the missing state data to the external dataset.

### Genuinely low similarity (3 entities)
- `IL-TRI-STATE FIRE PROTECTION DISTRICT` → Best match score: 0.696
- `FL-CAPTIVA ISLAND FIRE CONTROL DISTRICT` → Best match score: 0.665
- `SC-NORMANDY SCHOOLS COLLABORATIVE` → Best match score: 0.613

**Solution**: These may need manual review or threshold adjustment.

## Recommended Configuration

| Setting | Recommended Value | Reason |
|---------|-------------------|--------|
| Threshold | 70% | Best balance of precision/recall |
| State Blocking | Enabled | Prevents cross-state errors |
| Abbreviation Expansion | Enabled | Handles common variations |
| Phonetic Matching | Enabled | Catches spelling variations |
| Matching Direction | Bidirectional | Uses UMC + EXC ensemble |

## Research Reference

Based on: Papadakis, G., et al. (2023). "An analysis of one-to-one matching algorithms for entity resolution." The VLDB Journal, 32, 1369–1400.
