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

---

## Match Library (persistent memory)

The FastAPI service adds a SQLite-backed match library so approved matches are
remembered. On a later run, a known entity is returned instantly with stage
`verified_library` and no fuzzy scoring at all.

### Modules

| File | Purpose |
|------|---------|
| `db.py` | Connection setup, schema creation, transaction helper |
| `auth.py` | Users, sessions, Argon2id password hashing |
| `cisco_store.py` | Cisco account reference import, lookups, AM resolution |
| `match_store.py` | Match workflow, audit history, bulk import |
| `matcher_service.py` | FastAPI app on port 8000 |
| `seed_admin.py` | One-off CLI to create the first admin |

### First-time setup

```bash
pip install -r requirements.txt

# Create the first admin. Credentials come from the environment, never a flag.
set OFFLOAD_ADMIN_USER=your.name
set OFFLOAD_ADMIN_PASSWORD=<a strong password of 8+ characters>
python seed_admin.py

# Clear them once the account exists.
set OFFLOAD_ADMIN_USER=
set OFFLOAD_ADMIN_PASSWORD=
```

The schema is created automatically on service startup, so there is no separate
migration step. See `.env.example` for every supported variable.

### Run the API

```bash
uvicorn matcher_service:app --host 0.0.0.0 --port 8000
# or: python matcher_service.py
```

The browser reaches it through the Next.js rewrite at `/api/matcher/*`, which
keeps requests same-origin so the `HttpOnly` session cookie works.

### Data model

Two tables joined on **SAVM group id**:

- **`cisco_accounts`** — the reference list, one row per SFDC account, imported
  wholesale from the SQL export. Key: `(savm_group_id, sfdc_account_name, state)`.
  State belongs in the key because the same account name appears under one group
  in more than one state.
- **`matches`** — the memory. Stores the entity, its Cisco link, the decision,
  and a snapshot of the account and AM as they were at approval time.

Account details are always read live from `cisco_accounts`. The snapshot exists
so history stays truthful after a re-import; when the two disagree the match is
flagged **drifted** in the UI.

If a SAVM group disappears from a new import, its matches are flagged
**unlinked** rather than deleted, and re-link automatically if the group returns.

### Account manager selection

`NOMINATION_PRIORITY` is already an ordinal rank, and lower wins.

| Match level | AM comes from |
|---|---|
| `SFDC` | That exact account row, with no ranking, even if a sibling ranks higher |
| `SAVM` | The group's child row with the lowest `am_priority`; ties break alphabetically |

If no child in the group carries an AM email, no AM is returned rather than a guess.

### Approval workflow

| Score | Initial status | Who resolves |
|---|---|---|
| ≥ 95% | `pending_admin_approval` | admin only |
| < 95% | `pending_review` | reviewer or admin |
| any | `rejected` (notes required) | reviewer or admin |

Rejections are remembered per account reference, so a refused pairing is never
suggested again. Deletes are soft and restorable. Every state change writes a
row to `match_history` with the actor and timestamp.

### Tests

```bash
python -m pytest tests/ -q
```

## Research Basis

UMC + EXC algorithms from: Papadakis, G., et al. (2023). "An analysis of one-to-one matching algorithms for entity resolution." The VLDB Journal, 32, 1369-1400.

## Version History

| Version | File | Status | Key Changes |
|---------|------|--------|-------------|
| v1 | `entity_matcher.py` | Archived (`/Archive/Matching_Engine/`) | Full similarity matrix, UMC+EXC, TF-IDF |
| v3 | `entity_matcher_v3.py` | Archived (`/Archive/Matching_Engine/`) | State blocking, abbreviation expansion, phonetic matching (95.7% match rate) |
| v4 | `entity_matcher_v4.py` | **Active** | Multi-stage matching, context validation, word-order tolerance |

Older test scripts (`test_matcher.py`, `test_matcher_v2.py`, `test_matcher_v4.py`), prior result CSVs, and the v3 design dump (`Opus 4.1.txt`, `IMPROVEMENTS_SUMMARY.md`, `README_V3.md`) were also moved to `/Archive/Matching_Engine/` to keep this folder focused on the active engine.
