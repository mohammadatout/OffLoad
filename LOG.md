# Change log

Append-only. New entries go at the bottom with date.

---

## 2026-05-09 — v6 normalization workspace UI and configuration

**Task / problem:** Improve readability and control layout on the workspace (cream theme): low-contrast switch and labels, word-frequency column control, exclusion list card, configuration section order, saved-config action button, and chart/stat colors.

**Solution / changes:**
- `components/ui/Switch.tsx`: Checked state uses `bg-app-text` (light) and `dark:bg-gray-200` with contrasting thumb so the knob is visible on cream/white surfaces; removed reliance on undefined `accent-blue` / `accent-cyan` Tailwind tokens for the track.
- `WordFrequencyAnalyzer.tsx`: Column selection via dropdown trigger + checklist (multi-select preserved); “Add” to exclusion list uses a darker border when the action is enabled.
- `LegalEntitiesManager.tsx`: Title “Exclusion List”; stronger text/chip contrast; add-button border when input is non-empty.
- `ConfigurationPanel.tsx`: Section order — Cleaning, Parsing, Deduplication, Dictionaries & Lists (Abbreviation + Exclusion managers), City & State, Phone/Website/Links.
- `app/workspace/page.tsx`: Removed duplicate Dictionaries accordion (content lives inside `ConfigurationPanel`).
- `ConfigurationManager.tsx`: “Save Current” as compact rounded pill.
- `lib/brandPalette.ts` (new): Shared score colors and spotlight bar fills; wired from `DataQualityScoreCard`, `StatsPanel`, `Badge`, and related UI.
- Misc: `globals.css`, `PreviewTable`, `AppShell`, `Accordion`, `Card`, `Badge` adjustments for contrast and theme consistency.
- Removed stale duplicate tree under `Handover/files/` (paths relocated to main `Normalization/` and `Matching_Engine/`).

**Verification:** `npm run build` in `Normalization/Cursor_Build_Norm` succeeds.

---

## 2026-05-09 — Git: v6 pushed, v7 created

**Task:** Publish work on branch `v6`, open `v7` for continued development.

**Solution:** Committed staged changes on `v6`, pushed to `origin/v6`, created branch `v7` from that commit, pushed `origin/v7` and set upstream. README “Last updated” line adjusted to point active work at `v7`.

---

## 2026-05-22 — v7 browser startup error and missing component resolved

**Task / problem:** Resolving compilation and loading issues when launching the OffLoad suite. The workspace page returned an HTTP 500 error because the `TopValuesSpotlight` component was imported but missing from the repository, and background servers on ports 3000, 8000, and 8501 were not started.

**Solution / changes:**
- Created `Normalization/Cursor_Build_Norm/components/TopValuesSpotlight.tsx` to handle visual spotlight bars and percentage breakdowns of the top 5 values in any selected column, supporting seamless column dropdown switching and integrating with the brand palette values (`getSpotlightBarFills()`).
- Configured and booted all dev servers (Next.js port 3000, FastAPI Matcher API port 8000, and Streamlit legacy port 8501).
- Safely cleaned up temporary debug instrumentation logging after client-side verification.

**Verification:** Next.js compiles cleanly without warnings or errors. HTTP requests to `/` and `/workspace` succeed on port 3000, and `/health` succeeds on port 8000.

---

## 2026-08-19 — Match library, Cisco account reference, and auth

**Task / problem:** Matching had no memory, so every run re-scored entities that had already been resolved by hand. There was also no user model, no audit trail, and no place to hold Cisco account or account-manager data.

**Solution / changes:**

Backend (`Matching_Engine/`, new modules; `entity_matcher_v4.py` untouched):
- `db.py`: SQLite foundation — WAL, foreign keys, transaction helper, and the full schema (`users`, `sessions`, `cisco_accounts`, `matches`, `match_history`, `import_batches`).
- `auth.py`: Argon2id password hashing, users, and server-side sessions. Only a SHA-256 hash of each session token is stored. Failed logins burn comparable time so a missing username cannot be distinguished from a wrong password.
- `seed_admin.py`: CLI that creates the first admin from environment variables.
- `cisco_store.py`: streaming importer for the 35-column SQL export, keyed on `(savm_group_id, sfdc_account_name, state)`. Skips the export's trailing blank rows, replaces the table wholesale, and flags orphaned matches as `unlinked` instead of deleting them.
- `match_store.py`: match creation, approval workflow, status transitions, snapshots, drift detection, audit history, and bulk match/deletion imports.
- `matcher_service.py`: rewritten around the library. Adds auth, users, `/accounts/*`, `/matches/*`, `/match/run`, export, and `/admin/backup`. The original stateless `POST /match` is unchanged.

Frontend (`Normalization/Cursor_Build_Norm/`):
- Login page, `middleware.ts` route guard, and session-aware `AppShell` with Match Library and Admin tabs.
- Match Library page: server-side filters, notes editing, approve/reject/delete with a notes modal, bulk approve, audit-history drawer, drift and unlinked badges, CSV export, pagination.
- Admin page: high-confidence approval queue, reference import, historical-match import, deletion import, user management, and database backup.
- API clients now target the `/api/matcher` rewrite with credentials, so session cookies stay same-origin.

**Notable decisions:**
- `argon2-cffi` directly instead of `passlib`, which adds a layer and is effectively unmaintained.
- `check_same_thread=False` on connections: FastAPI runs sync dependencies on a worker thread while async endpoints run on the event loop. Safe because every request gets its own connection.
- `/match/run` detects which uploaded file carries the SAVM group id and treats that as the Cisco reference, rather than trusting the internal/external labels. The workspace sends them swapped, which would otherwise store Cisco accounts as entities.

**Verification:** `pytest Matching_Engine/tests/` — 146 passing. `npm run build` succeeds. The real 224k-row export imports in 2.3s (18 data rows, 224,288 blank rows skipped, all 35 headers recognised).

---

## 2026-08-27 — Phase 1 roadmap implementation (1.1, 1.2, 1.3)

**Task / problem:** Implement Phase 1 of the three-phase roadmap: default scoped AE Allocation filters and hierarchy controls, a declared skippable stage ladder with progress and run summary, and a workbook-based output contract with configurable primary columns.

**Solution / changes:**

Backend (`Matching_Engine/`):
- `cisco_store.py`: added `sl2`–`sl6` filtering in `list_accounts`, expanded facets for hierarchy-aware cascades, and implemented server-side `sl6` type-ahead (`sl6_search`, min chars, option cap).
- `matcher_service.py`: added one declared ladder (`MATCH_STAGE_LADDER`) and exposed it via `GET /match/stages`; added run progress cache/endpoint (`GET /match/progress/{run_id}`); extended `/match/run` for stage skips, stage-aware summaries, and state-mismatch flag behavior instead of zero-result collapse when reference state is missing.
- Added API/query support for hierarchy filters on `/accounts` and `/accounts/facets`.
- Preserved orientation detection behavior (`_orient_frames`) and left `entity_matcher_v4.py` untouched.

Frontend (`Normalization/Cursor_Build_Norm/`):
- `AllocationBrowser.tsx`: default preset now `source=SAV+SFDC` + `sl2=US PS Market Segment`, with reset-to-default and clear-all actions.
- Added selectable filters for source/state/vertical/sub-segment (`tier`) and sales hierarchy `sl2`–`sl6` (no `sl1` filter), including parent cascade reset logic and `sl6` type-ahead.
- Added URL round-trip for allocation filters and page index so share/reload preserves view state.
- Added state column display in AE Allocation rows.
- Matching tab now loads stage ladder, exposes per-stage skip toggles, polls direct `:8010` progress updates, and surfaces skipped-stage summary with explicit Stage 1 warning.
- Replaced matching CSV export with Excel workbook export (`Primary`, `Detail`, `Unmatched`) in `MatchingExport.tsx` + `matchingOutput.ts`.
- Primary-sheet columns are selectable/reorderable, persisted via `storage.ts`, with reset-to-default.
- Detail sheet always keeps full data; unmatched sheet carries reason.
- Updated naming to prefix conventions (`CLEANED_...` / `MATCHED_...`).

Dependencies:
- Added pinned Excel dependency in `Normalization/Cursor_Build_Norm/package.json`: `xlsx@0.18.5` (lockfile updated).

Tests:
- `tests/test_cisco_store.py`: added hierarchy filter, facet cascade, `sl6` search, and sub-segment (`tier`) mapping coverage.
- `tests/test_service_api.py`: added stage ladder, skip behavior, progress endpoint, state-mismatch flag, and hierarchy/facet API tests.

**Verification:**
- `python -m pytest tests/` in `Matching_Engine` — 163 passed.
- `npm run build` in `Normalization/Cursor_Build_Norm` — passed.

---

## 2026-08-27 — Phase 1 hardening pass after critic re-evaluation

**Task / problem:** Address structural risks raised in postmortem review: stage-ladder truthfulness, missing frontend contract tests, and weak release-time data contract checks.

**Solution / changes:**
- Backend stage-ladder hardening in `Matching_Engine/matcher_service.py`:
  - Added explicit `implemented` flags to ladder entries.
  - Exposed only implemented stages by default from `GET /match/stages` (optional `include_unimplemented=true` for audit/debug).
  - Restricted `skipped_stages` to implemented stage IDs; non-implemented stage skips now fail validation.
  - Progress/stage accounting now uses implemented stages only.
  - Added startup ladder validation (`_validate_stage_ladder`) to catch duplicate IDs/orders and ensure Stage 1 is implemented.
  - `match/run` response now returns implemented stage ladder only.
- Added production contract check script `Matching_Engine/phase1_contracts.py`:
  - Validates default-slice and hierarchy invariants from a live DB.
  - Supports strict expected-count assertions through env vars.
- Frontend URL contract hardening:
  - Extracted allocation URL parsing/building into `Normalization/Cursor_Build_Norm/lib/allocationFilters.ts`.
  - Refactored `AllocationBrowser.tsx` to use the shared helpers.
- Frontend automated contract tests:
  - Added Vitest config `Normalization/Cursor_Build_Norm/vitest.config.ts`.
  - Added tests:
    - `tests/allocationFilters.test.ts` (URL round-trip/default behavior)
    - `tests/matchingOutput.test.ts` (primary/detail/unmatched export contracts)
    - `tests/matchingWorkbook.test.ts` (workbook sheet/filename/header contracts)
  - Added `npm test` script in `Normalization/Cursor_Build_Norm/package.json`.
- Added workbook builder helper `Normalization/Cursor_Build_Norm/lib/matchingWorkbook.ts` and routed export through it so workbook contract assertions are testable.
- Updated backend test coverage in `Matching_Engine/tests/test_service_api.py`:
  - Assert stage endpoint returns implemented stages.
  - Added rejection test for skipping non-implemented stage IDs.
  - Made skip-all-non-library test derive stage IDs from endpoint response.
- Added backend gate tests in `Matching_Engine/tests/test_phase1_contracts.py` so Phase 1 contract checks become part of required pytest execution.

**Verification:**
- `python -m pytest tests/` in `Matching_Engine` — 166 passed.
- `npm run test` in `Normalization/Cursor_Build_Norm` — 8 passed.
- `npm run build` in `Normalization/Cursor_Build_Norm` — passed.
- `python phase1_contracts.py` in `Matching_Engine` — passed (`ok: true` with live metrics).

---

## 2026-08-27 — AE Allocation retuned to the current reference template

**Task / problem:** Retune AE Allocation to the reference export's headers and
data, add an admin-controlled column picker, a download, and a way to empty the
reference table, and rework the filter row.

**Context worth knowing:** the reference export on disk is now an 18-row sample
with ~224k blank trailing rows, and importing it deactivated the earlier 223,975
rows. Its Sales Level 2 values are `US COMMERCIAL`, `GLOBAL ENTERPRISE SEGMENT`,
and `AMERICAS_SP` — so the previous default preset (`sl2='US PS Market Segment'`)
matched zero rows and AE Allocation opened empty. All 35 template headers
already mapped through `COLUMN_ALIASES`; no import change was needed.

**Solution / changes:**
- Default view: AE Allocation now opens **unfiltered**. `DEFAULT_ALLOCATION_FILTERS`
  is `{}`, `Reset` clears every filter, and the separate "Show all sources"
  button is gone since Reset now does that job.
- Filters reordered and relabelled to the business names: Theater-SL2, Area-SL3,
  Operation-SL4, Region-SL5, Account-SL6, SAV ID, Unified Acc. Name, State,
  Source, Tier, SAV Vertical. Segment removed from the UI and from
  `FACET_COLUMNS`.
- Two new filters, `savm_group_id` and `unified_account_name`, plumbed through
  `list_accounts`, `get_account_facets`, `GET /accounts`, and `/accounts/facets`.
- `SearchableSelect.tsx` (new): dropdown with an inline search box. Small option
  lists filter in the browser; SAV ID, Unified Acc. Name, and Account-SL6 query
  `GET /accounts/options` as the user types, so a column with ~185k distinct
  values never ships to the client. Column names come from a server-side
  allow-list (`SEARCHABLE_OPTION_COLUMNS`), never from the request.
- Table columns are now driven by a **global** setting. `app_settings` table,
  `settings_store.py` with the column catalogue and labels,
  `GET/PUT /settings/allocation-columns` plus a reset. Admin-only to write, any
  reviewer can read. New `AllocationColumnPicker` panel in Admin with reorder.
- Default table columns keep the previous nine but use **Unified Acc. Name** in
  place of the separate SAV Name and SFDC Name columns. Both moved into the
  Group Drawer: SAV Name into group attributes, SFDC Name and Unified Acc. Name
  as columns of the accounts table there.
- Download button on AE Allocation: `GET /accounts/export` streams every row
  matching the filters (not just the page), and `lib/allocationWorkbook.ts`
  builds a two-sheet `.xlsx` following the Phase 1.3 contract — front sheet with
  exactly the visible columns, Detail sheet with everything.
- Empty-the-table control in Admin (`AccountsPurgePanel`): downloads a
  full-fidelity workbook first, then requires the word `DELETE` typed before
  calling `DELETE /accounts`. `purge_accounts` hard-deletes, `VACUUM`s to reclaim
  the space, and flags affected matches `unlinked` rather than deleting them, so
  approved decisions survive and re-link on the next import.
- Removed the duplicate mount-time facet call: `allocation/page.tsx` no longer
  fetches facets itself and receives totals from the browser component. Facets
  now follow applied filters instead of the draft, so typing in the search box
  no longer re-derives every dropdown, and both the list and facet calls abort
  superseded requests.
- Dropped the dead `sl2`-`sl5` facet loop. `FACET_COLUMNS` held those levels and
  the hierarchy cascade recomputed and overwrote them, so roughly half the facet
  work was discarded; behaviour is unchanged.
- Added `RETAIL` and `PROF_SRV` to the vertical label map, both present in the
  current data and previously rendering as raw codes.

**Verification:**
- `python -m pytest tests/` in `Matching_Engine` — 214 passed (48 new, including
  `tests/test_allocation_admin.py`).
- `npm run test` in `Normalization/Cursor_Build_Norm` — 29 passed.
- `npm run build` in `Normalization/Cursor_Build_Norm` — clean.
- 43 live end-to-end checks against a copy of the real `offload.db`, covering
  labels, the unfiltered default, option search and its allow-list, the new
  filters, full export fidelity, purge guard rails, role enforcement, and the
  global scope of the column setting. The live database was not modified.
- `git diff --stat -- Matching_Engine/entity_matcher_v4.py` is empty.

**Still open:** `phase1_contracts.py` asserts the retired
`sl2='US PS Market Segment'` default and will now fail against this data; it
needs retargeting or retiring. The performance findings from the earlier review
(composite indexes on the filter columns, connection reuse, FTS5 for search) are
not implemented.

---

## 2026-08-28 — AE Allocation export moved server-side

**Task / problem:** The Admin "download backup and empty table" button hung with
no download and a disabled button. Reported after the full reference export was
re-imported, taking `cisco_accounts` from 18 active rows to 223,975.

**Root cause:** the export shipped every row to the browser as JSON and built
the workbook in JavaScript. Measured over real HTTP: **331 MB in 132 seconds**
for 223,975 rows. Correct at 18 rows, unusable at scale. Not a hang — just far
longer than anyone would wait, with no progress shown.

**Solution / changes:**
- `Matching_Engine/account_export.py` (new): builds the workbook with XlsxWriter
  in `constant_memory` mode, so only the current row is held regardless of row
  count. Values are written with `write_string` to skip per-cell type detection,
  which matters across millions of cells.
- `GET /accounts/export.xlsx` (new): streams the finished workbook with a
  `Content-Disposition` filename. Accepts the same filters plus `columns` and
  `include_inactive`. `columns=*` asks for every field.
- `cisco_store.account_cursor` (new): raw cursor over the filtered rows so the
  export skips building a dict per row.
- The detail sheet is skipped when the selection already covers every field,
  since it would be a second copy. The pre-purge backup uses `columns=*` and so
  writes one sheet in a single pass.
- `GET /accounts/export` (JSON) kept for programmatic callers but now **capped**
  at 10,000 rows (`OFFLOAD_MAX_JSON_EXPORT_ROWS`), returning 413 with a pointer
  to the xlsx route, so nothing can stall on that path again.
- Frontend: `downloadAccountsWorkbook` fetches the file and triggers a browser
  download. Deleted `lib/allocationWorkbook.ts` and its test — the workbook is
  built in one place now, tested in `tests/test_account_export.py`. Kept the
  column-rendering helpers, now covered by `tests/allocationColumns.test.ts`.
- Both buttons now state what is happening and that a large export can take up
  to a minute, which was the missing half of the original complaint.
- The pre-purge backup passes `include_inactive=true`: the purge deletes every
  row, so a backup of only the active ones would not be one.
- `XlsxWriter>=3.1.0` added to `requirements.txt` (it was already installed
  transitively; now it is a declared direct dependency).

**Measured on the live 223,975 rows:**

| Path | Before | After |
|---|---|---|
| AE Allocation download | 331 MB / 132 s | 56.7 MB / 62 s |
| Pre-purge backup, all columns | 331 MB / 132 s | 43.6 MB / 47 s |
| Filtered download (`state=TX`) | — | 3.2 MB / 4 s |
| JSON export of the full set | 132 s | 413 in 0.05 s |

Route bundles shrank too, since `xlsx` no longer ships to them:
`/workspace/allocation` 192 kB to 97 kB, `/workspace/admin` 202 kB to 106 kB.

**Verification:**
- `python -m pytest tests/` — 235 passed (21 new in `tests/test_account_export.py`).
- `npm run test` — 31 passed. `npm run build` — clean.
- End-to-end over real HTTP against a copy of the live database: valid xlsx
  archives, correct sheet counts, filtered exports, the 413 cap, purge guard
  rails, and the successful purge. The live database was not modified.

**Note:** the export writes raw values rather than display forms, so `vertical`
reads `RETAIL` and not `RETAIL — Retail`, which keeps Excel filters and pivots
usable. Say so if the on-screen wording is wanted instead.

