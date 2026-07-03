# OffLoad — Project Overview

A data suite for **entity resolution**: take messy internal CSV data, clean it, and match it against an external reference list. Two parts work together — a Normalization tool and the Matching Engine (the core).

Workflow: **Normalize → Match → Review → Export.**

---

## 1. Normalization

Cleans internal data before matching.

**Features**
- Text normalization (case, whitespace, punctuation)
- Company name cleaning (strips legal entities, expands abbreviations)
- Address parsing and standardization
- City/state validation against reference data
- Phone, email, website normalization
- Duplicate detection and grouping
- Word-frequency analysis and column profiling
- Data quality scoring
- Editable exclusion list for legal-entity stripping
- Exports cleaned CSV plus an original-vs-cleaned audit file

**Capabilities** — handles hundreds to hundreds of thousands of rows.

---

## 2. Matching Engine (The Core)

Matches each internal entity against an external list using a staged, context-aware fuzzy approach. Research basis: UMC + EXC algorithms, Papadakis et al. (2023), *The VLDB Journal*.

### 2.1 Logic — How a Match Is Decided

**Preprocessing (every entity)**
1. **State extraction** — `ST-Entity Name` is split into a state code + core name (e.g. `CA-SAN DIEGO USD`).
2. **Normalization** — uppercase, strip punctuation, expand 80+ abbreviations (`USD → UNIFIED SCHOOL DISTRICT`, `CO → COUNTY`, …).
3. **Sorted tokens** — an alphabetized token string so word order doesn't matter (`ISANTI COUNTY` = `COUNTY OF ISANTI`).
4. **Context extraction** — guesses the city and entity type (SCHOOL, COLLEGE, CITY, COUNTY, …).

**Blocking** — with state blocking on, an internal entity is only compared against external entities in the *same state*. This kills cross-state false matches and shrinks the search space.

**Similarity score** — a weighted ensemble of five string metrics:

| Metric | Weight | Catches |
|--------|--------|---------|
| Token sort ratio | 30% | reordered words |
| Token set ratio | 25% | subsets / partials |
| Jaro-Winkler | 20% | typos, shared prefixes |
| Levenshtein ratio | 15% | character-level edits |
| Sorted-token ratio | 10% | order-independent exactness |

**Context validation** — adjusts the raw score:
- Different cities (San Mateo vs San Diego) → −0.15 penalty
- Same city → +0.05 bonus
- Different entity type (school vs county) → −0.05 penalty

**Multi-stage bucketing** — the best candidate per entity is filed by final score:

| Stage | Threshold | Outcome |
|-------|-----------|---------|
| 0 — Exact | normalized strings identical | auto-matched |
| 1 — High confidence | ≥ 95% | auto-matched |
| 2 — Confident | ≥ 85% | auto-matched |
| 3 — Probable | ≥ 70%, no context flag | auto-matched |
| 4 — Review | < 70% **or** context flag | top-3 candidates shown for manual review |

Once an external record is matched it is removed from the candidate pool (one-to-one matching).

### 2.2 Capabilities
- Multi-stage matching with transparent confidence buckets
- State-based blocking to prevent cross-state false positives
- Word-order tolerance via sorted tokens
- 80+ abbreviation expansions for government/education entities, editable at runtime
- Context-aware penalties for city/type mismatches
- Top-3 review queue for ambiguous cases
- Filtering of results by status, stage, and state
- CSV export with confidence, stage, context notes, and matched external columns
- Scales from hundreds to hundreds of thousands of rows

### 2.3 Inputs / Outputs
- **Internal CSV** — names as `ST-Entity Name`; default column `Full_Entity_Name`.
- **External CSV** — names to match against; default column `Company Name`.
- **Output** — a copy of the internal table plus `Match_Status`, `Matched_Name`, `Confidence_Score`, `Match_Stage`, `State`, `Context_Notes`, `Top_3_Candidates`, and all external columns.

### 2.4 Public API
```python
from entity_matcher_v4 import MultiStageEntityMatcher

matcher = MultiStageEntityMatcher(
    abbreviations=None,            # dict[str,str] | None
    use_state_blocking=True,
    use_context_validation=True,
)
results_df, stats = matcher.match_entities(
    internal_df, external_df, internal_col, external_col,
    progress_callback=None,
)
```

> **Gotcha:** with `use_state_blocking=True` and an external file lacking state info, every entity returns zero matches (`"No candidates in state X"`). Turn blocking off when the external list has no state prefixes.

---

## 2.5 Detailed Function Reference

Every class, method, and module-level constant in `entity_matcher_v4.py`, with behavior notes and small examples. This is the canonical record of how the engine works.

### Module-level data

#### `DEFAULT_ABBREVIATIONS : dict[str, str]`
Maps a short token to its full expansion, used during normalization so that abbreviated and spelled-out names collapse to the same string. ~80 entries across school districts, community colleges, government bodies, and common directional/place words.

- Keys are uppercase tokens (`USD`, `CO`, `TWP`, `MT`).
- Values are uppercase full forms (`UNIFIED SCHOOL DISTRICT`, `COUNTY`).
- Replacement is **whole-token only** — `CO` matches the standalone word `CO`, not the `CO` inside `COLLEGE`.

Example effect:
```
"CA-SAN DIEGO USD"  → normalized → "SAN DIEGO UNIFIED SCHOOL DISTRICT"
"SAN DIEGO UNIFIED SCHOOL DISTRICT" → unchanged
# both collapse to the same normalized string → exact match
```

#### `KNOWN_CITIES : set[str]`
~75 major US cities used by context extraction. If any of these strings appears anywhere in an entity name, that city is attached as context and later used to penalize cross-city matches.

Example: `"SAN MATEO COUNTY OFFICE"` → city = `SAN MATEO`.

#### `ENTITY_TYPES : dict[str, list[str]]`
Maps a coarse type label (`SCHOOL`, `COLLEGE`, `CITY`, `COUNTY`, `DISTRICT`, `HOSPITAL`, `GOVERNMENT`) to keyword triggers. The first label whose keyword appears in the name wins; otherwise the type is `OTHER`. Used to penalize matching a school against a county, etc.

#### `US_STATES : set[str]`
All 50 states plus DC and territories (PR, VI, GU, AS, MP). Used to validate the two-letter prefix during state extraction so a random `XX-` prefix is not mistaken for a state.

---

### `class ContextExtractor`
Stateless helper (all `@staticmethod`) that derives soft context signals from a name. These signals never decide a match alone — they only adjust the score.

#### `extract_city(name) -> str | None`
Returns a city if found, else `None`. Resolution order:
1. Direct hit against `KNOWN_CITIES`.
2. Regex `CITY OF <X>` pattern.
3. Regex `<X> CITY` pattern.

```python
ContextExtractor.extract_city("CITY OF SAN MATEO")   # "SAN MATEO" (known city hit)
ContextExtractor.extract_city("CITY OF SPRINGFIELD") # "SPRINGFIELD" (pattern hit)
ContextExtractor.extract_city("ISANTI COUNTY")       # None
```

#### `extract_entity_type(name) -> str`
Scans `ENTITY_TYPES` keywords and returns the first matching label, else `OTHER`.

```python
ContextExtractor.extract_entity_type("AUSTIN INDEPENDENT SCHOOL DISTRICT")  # "SCHOOL"
ContextExtractor.extract_entity_type("ISANTI COUNTY")                       # "COUNTY"
ContextExtractor.extract_entity_type("ACME WIDGETS")                        # "OTHER"
```
> Note: keyword scanning is order-sensitive within the dict; `SCHOOL` is checked before `DISTRICT`, so "SCHOOL DISTRICT" classifies as `SCHOOL`.

#### `extract_context(name) -> dict`
Convenience wrapper returning `{'city': ..., 'entity_type': ...}`.

---

### `class EntityNormalizer`
Holds the abbreviation dictionary and all name-cleaning logic. One instance is created per matcher.

#### `__init__(abbreviations=None)`
Stores the supplied dictionary (or `DEFAULT_ABBREVIATIONS`) and builds `reverse_abbrev` (full form → abbreviation) for the reverse-abbreviation feature.

#### `extract_state_and_name(full_name) -> (state, core_name)`
Splits a `ST-Entity Name` string. Matches a two-letter prefix followed by a hyphen/en-dash/em-dash. The prefix is only accepted as a state if it is in `US_STATES`; otherwise the whole string is treated as the core name with an empty state.

```python
norm.extract_state_and_name("CA-SAN DIEGO USD")   # ("CA", "SAN DIEGO USD")
norm.extract_state_and_name("XX-FOO BAR")         # ("", "XX-FOO BAR")  # XX not a state
norm.extract_state_and_name("PLAIN NAME")         # ("", "PLAIN NAME")
```

#### `normalize_name(name, expand_abbrev=True) -> str`
The core cleaning routine. Steps, in order:
1. Uppercase and trim.
2. `&` → ` AND `, `#` → ` NUMBER `.
3. Replace `. , " ' ( ) [ ] { } / : ; \` and `-` with spaces.
4. Collapse repeated whitespace.
5. If `expand_abbrev`, replace each token via the abbreviation dictionary and re-collapse whitespace.

```python
norm.normalize_name("St. Mary's Co. #2")
# "SAINT MARY S COUNTY NUMBER 2"
```

#### `create_abbreviation(name) -> str`
Produces a compressed/abbreviated form of a name (reverse of expansion). Replaces known full forms with their abbreviations, then reduces remaining long words (>3 chars, excluding `AND/THE/FOR/OF`) to their first letter. Stored on each entity as `abbreviated`.
> Currently computed for every entity but not used in the scoring path — it exists for future abbreviation-based matching. Safe to ignore when reasoning about scores.

#### `get_sorted_tokens(name) -> str`
Returns the name's tokens sorted alphabetically and rejoined. This is what makes word order irrelevant.

```python
norm.get_sorted_tokens("COUNTY OF ISANTI")  # "COUNTY ISANTI OF"
norm.get_sorted_tokens("ISANTI COUNTY")     # "COUNTY ISANTI"
# After abbreviation/stopword handling these converge, enabling the 0.98 "exact_sorted" match.
```

---

### `class MultiStageEntityMatcher`
The orchestrator. Owns thresholds, weights, and the full matching pipeline.

#### `__init__(abbreviations=None, use_state_blocking=True, use_context_validation=True, context_config=None)`
Sets up the normalizer and configuration. Fixed thresholds and weights live here:

| Field | Value |
|-------|-------|
| `high_confidence_threshold` | 0.95 |
| `confident_threshold` | 0.85 |
| `probable_threshold` | 0.70 |
| `similarity_weights` | token_sort 0.30, token_set 0.25, jaro_winkler 0.20, levenshtein 0.15, sorted_tokens 0.10 |

To change matching strictness or metric emphasis, change these — they are the engine's tuning knobs.

#### `preprocess_entity(full_name) -> dict`
Runs the full per-entity preparation once, returning a record with: `original`, `state`, `core_name`, `normalized`, `sorted_tokens`, `context`, `abbreviated`. Called for every internal and external row before any comparison.

#### `preprocess_datasets(internal_df, external_df, internal_col, external_col) -> (internal_data, external_data, external_by_state)`
Preprocesses both tables into index-keyed dicts and also builds `external_by_state` — a `{state: [external indices]}` map that powers blocking. Building this index once is what keeps blocking fast.

#### `calculate_similarity(data1, data2) -> (score, details)`
The heart of scoring. Logic:
1. Empty name on either side → `0.0`.
2. Identical normalized strings → `1.0` (`reason: exact_normalized`).
3. Identical sorted tokens → `0.98` (`reason: exact_sorted`).
4. Otherwise compute the five weighted metrics and sum them.
5. If context validation is on, apply city penalty (−0.15) or bonus (+0.05) and entity-type penalty (−0.05).
6. Final score floored at 0.

`details` carries the per-metric `components`, the `context_penalty`, and human-readable `context_details` (e.g. `{'city_mismatch': 'SAN MATEO vs SAN DIEGO'}`).

```python
# "SAN DIEGO USD" vs "SAN MATEO USD": high string overlap but different cities
# raw ~0.9, minus 0.15 city penalty → ~0.75, lands in Probable/Review instead of auto-match
```

#### `get_candidates(int_record, external_data, external_by_state) -> list[int]`
Returns the external indices to compare against. If blocking is on **and** the internal record has a state, returns only that state's bucket; otherwise returns all external indices.
> This is exactly where the zero-match gotcha originates: blocking on + external rows with no state → empty bucket.

#### `find_matches_for_entity(int_idx, int_record, external_data, candidates, min_threshold=0.60) -> list[dict]`
Scores the internal record against every candidate, keeps those at/above `min_threshold` (default 0.60), and returns them sorted best-first. The top of this list becomes the chosen match; the top 3 feed the review queue.

#### `match_entities(internal_df, external_df, internal_col, external_col, progress_callback=None) -> (result_df, stats)`
The public entry point and the full pipeline:

1. **Preprocess** both datasets.
2. **Stage 0 — Exact:** for each internal record, scan candidates; first identical normalized string is an exact match. Matched external indices are reserved (one-to-one).
3. **Stages 1–3 — Similarity:** for each still-unmatched internal record, drop already-used externals, score the rest, take the best, and bucket it:
   - ≥0.95 → high_confidence (auto)
   - ≥0.85 → confident (auto)
   - ≥0.70 → probable (auto) **unless** it carries a context penalty, in which case it goes to review with top-3
   - <0.70 → review with top-3
   - no candidates / nothing ≥0.60 → unmatched (with a reason string)
4. **Build output:** copy the internal frame and append `Match_Status`, `Matched_Name`, `Confidence_Score`, `Match_Stage`, `State`, `Context_Notes`, `Top_3_Candidates`, plus every external column prefixed `External_`. Sort by confidence descending.
5. **Stats:** per-stage counts, totals, `match_rate`, and `elapsed_time`.

`progress_callback(message, fraction)` is invoked at milestones (0.1 preprocess → 1.0 complete) so a caller can drive a progress bar.

End-to-end example:
```python
import pandas as pd
from entity_matcher_v4 import MultiStageEntityMatcher

internal = pd.DataFrame({'Full_Entity_Name': [
    'CA-SAN DIEGO USD',
    'TX-AUSTIN ISD',
]})
external = pd.DataFrame({'Company Name': [
    'SAN DIEGO UNIFIED SCHOOL DISTRICT',
    'AUSTIN INDEPENDENT SCHOOL DISTRICT',
]})

# External list has no ST- prefix, so turn blocking OFF
matcher = MultiStageEntityMatcher(use_state_blocking=False, use_context_validation=True)
result_df, stats = matcher.match_entities(
    internal, external, 'Full_Entity_Name', 'Company Name'
)
# Both resolve via abbreviation expansion → stage_0_exact, match_rate 100%
```

---

