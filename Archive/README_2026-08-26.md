# OffLoad

A unified browser-based data suite for CSV normalization and entity matching. One window, one URL, cream editorial theme throughout.

**Last updated:** 2026-05-09 (snapshot merged on **v6**; active line of work: branch **v7**. Workspace UI, configuration order, `brandPalette`; details in `LOG.md`).

---

## Chapter 1 — Functionality and Features

### What it does

OffLoad takes messy CSV data and produces clean, matched entity records. The workflow is:

1. **Normalize** your internal data (clean text, standardize formats, deduplicate)
2. **Match** your entities against the Cisco account reference using fuzzy multi-stage matching
3. **Review** ambiguous matches, approve them, and export final results
4. **Remember** — approved matches go into the match library, so later runs resolve them instantly

The tools live inside a single Next.js app at `http://localhost:3000`. Switch between them using tabs.

**Sign-in is required.** Create the first admin with `Matching_Engine/seed_admin.py`; see
`Matching_Engine/README.md`. Tabs are Normalization, Matching Engine, Match Library, and
Admin (admins only).

### Match Library

- Persistent memory of approved entity → Cisco account matches
- Stage 1 is a library lookup: a known entity skips fuzzy scoring entirely
- Approval workflow — 95%+ waits for an admin, below that for a reviewer, rejections require a reason
- Rejections are remembered, so a refused pairing is never suggested again
- Full audit history per match, with actor and timestamp
- Cisco account reference with nominated account managers, refreshed by wholesale import
- Soft deletes with restore; groups missing from a new import are flagged, never deleted

### Normalization

- Text normalization (uppercase, whitespace, punctuation)
- Company name cleaning (legal entity removal, abbreviation replacement)
- Address parsing and standardization
- City & state validation against reference data
- Phone, email, and website normalization
- Duplicate detection and grouping
- Word frequency analysis and column profiling (dropdown multi-select for analysis columns)
- Data quality scoring (shared palette for score bands and spotlight charts)
- Exclusion list management for legal-entity stripping (readable chips and labels)
- Export cleaned CSV + original-vs-cleaned audit file

### Matching Engine

- Multi-stage matching (Exact > High Confidence > Confident > Probable > Review)
- State-based blocking (prevents cross-state false matches)
- Context-aware validation (city and entity type mismatch penalties)
- Word-order tolerance (sorted token matching)
- 80+ abbreviation expansions for government/education entities
- Weighted similarity ensemble (token sort, token set, Jaro-Winkler, Levenshtein)
- Top-3 candidate review queue for ambiguous matches
- Configurable abbreviation dictionary
- CSV export with review decisions included

**Research basis:** UMC + EXC algorithms from Papadakis et al. (2023), VLDB Journal

### Intended use

Enterprise entity resolution — matching internal company/organization lists against external vendor or reference databases. Built for datasets ranging from hundreds to hundreds of thousands of rows.

### Quick Start

**First time:** Run `setup_offload.bat` — installs all dependencies and launches the suite.

**After setup:** Run `launch_offload.bat` — starts all servers and opens the browser.

---

## Chapter 2 — Technologies

### Frontend (port 3000)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 |
| Animation | Framer Motion |
| Icons | Lucide React |
| Charts | Recharts |
| CSV parsing | PapaParse |
| Design | Cream editorial theme (`#F4F3EE` / `#0A0A0A` / Inter + JetBrains Mono) |
| Theme tokens | `lib/brandPalette.ts` — quality score colors, spotlight bar fills |

### Backend (port 8000)

| Layer | Technology |
|-------|-----------|
| API framework | FastAPI |
| Server | Uvicorn |
| Matching engine | Custom multi-stage matcher (`entity_matcher_v4.py`) |
| Data processing | pandas, NumPy |
| String similarity | jellyfish, python-Levenshtein, fuzzywuzzy |
| ML utilities | scikit-learn (TF-IDF vectorizer) |

### Legacy (port 8501)

Streamlit UI for direct access to the matching engine. Still launches alongside but is no longer the primary interface.

### Requirements

- Node.js 18+
- Python 3.10+
