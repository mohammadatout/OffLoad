# OffLoad

A two-part data wrangling and entity matching suite. Both tools share a unified Obsidian dark theme.

## Components

### Normalization App (port 3000)

Next.js browser-based CSV cleaning tool. All processing happens client-side.

- Text normalization (uppercase, whitespace, punctuation)
- Company name cleaning (legal entity removal, abbreviation replacement)
- Address parsing and standardization
- City & state validation against reference data
- Phone, email, and website normalization
- Duplicate detection and grouping
- Word frequency analysis and column profiling
- Data quality scoring
- Export cleaned CSV + original-vs-cleaned audit file

**Tech:** Next.js 14, TypeScript, Tailwind CSS, PapaParse

### Matching Engine (port 8501)

Python Streamlit app for entity/company name matching between two CSV datasets.

- Multi-stage matching (Exact > High Confidence > Confident > Probable > Review)
- State-based blocking (prevents cross-state false matches)
- Context-aware validation (city and entity type mismatch penalties)
- Word-order tolerance (sorted token matching)
- 80+ abbreviation expansions for government/education entities
- Weighted similarity ensemble (token sort, token set, Jaro-Winkler, Levenshtein)
- Top-3 candidate review for ambiguous matches
- Configurable abbreviation dictionary

**Tech:** Python, Streamlit, pandas, jellyfish, python-Levenshtein, fuzzywuzzy, scikit-learn

**Research basis:** UMC + EXC algorithms from Papadakis et al. (2023), VLDB Journal

## Quick Start

**First time:** Run `setup_offload.bat` — installs all dependencies and launches both apps.

**After setup:** Run `launch_offload.bat` — starts both servers and opens browser tabs.

### Manual Start

```bash
# Normalization
cd Normalization/Cursor_Build_Norm
npm install
npm run dev

# Matching Engine
cd Matching_Engine
pip install -r requirements.txt
streamlit run entity_matcher_v4.py
```

## Requirements

- Node.js 18+
- Python 3.8+
