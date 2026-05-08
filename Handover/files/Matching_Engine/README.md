# Matching Engine

Streamlit-based entity matching tool. Compares an internal entity list against an external list using multi-stage fuzzy matching with context awareness.

## Active Version

`entity_matcher_v4.py` — Context-aware multi-stage matching.

## Features

- **Multi-stage matching** — Stage 0 (exact) > Stage 1 (>=95%) > Stage 2 (>=85%) > Stage 3 (>=70%) > Stage 4 (review with top-3 candidates)
- **State-based blocking** — Only compares entities within the same US state, eliminating cross-state false matches
- **Context-aware validation** — City mismatch penalty (e.g., San Mateo vs San Diego), entity type mismatch penalty
- **Word-order tolerance** — Sorted token matching (ISANTI COUNTY = COUNTY OF ISANTI)
- **Abbreviation expansion** — 80+ abbreviations for government/education entities (USD, SD, HSD, CC, CO, etc.)
- **Configurable abbreviation dictionary** — Edit via sidebar
- **Similarity ensemble** — Token sort (30%), Token set (25%), Jaro-Winkler (20%), Levenshtein (15%), Sorted tokens (10%)
- **Filtering** — By status, stage, and state
- **CSV export** — Download results with timestamps

## Data Format

**Internal CSV:** Entity names in format `ST-Entity Name` (e.g., `CA-SAN DIEGO UNIFIED SCHOOL DISTRICT`). Default column: `Full_Entity_Name`.

**External CSV:** Entity names to match against. Default column: `Company Name`.

## Usage

```bash
pip install -r requirements.txt
streamlit run entity_matcher_v4.py
```

Open http://localhost:8501

## Research Basis

UMC + EXC algorithms from: Papadakis, G., et al. (2023). "An analysis of one-to-one matching algorithms for entity resolution." The VLDB Journal, 32, 1369-1400.

## Version History

| Version | File | Status | Key Changes |
|---------|------|--------|-------------|
| v1 | `entity_matcher.py` | Archived (`/Archive/Matching_Engine/`) | Full similarity matrix, UMC+EXC, TF-IDF |
| v3 | `entity_matcher_v3.py` | Archived (`/Archive/Matching_Engine/`) | State blocking, abbreviation expansion, phonetic matching (95.7% match rate) |
| v4 | `entity_matcher_v4.py` | **Active** | Multi-stage matching, context validation, word-order tolerance |

Older test scripts (`test_matcher.py`, `test_matcher_v2.py`, `test_matcher_v4.py`), prior result CSVs, and the v3 design dump (`Opus 4.1.txt`, `IMPROVEMENTS_SUMMARY.md`, `README_V3.md`) were also moved to `/Archive/Matching_Engine/` to keep this folder focused on the active engine.
