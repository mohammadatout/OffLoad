# OffLoad

**Agent handoff document. Last updated: 2026-08-26.**
Previous README archived as `README_2026-08-26.md`.

---

## 1. What this is

OffLoad matches a messy list of organization names against Cisco's account
reference, and **remembers every match a human approves** so it never has to
guess the same thing twice.

The workflow:

1. **Normalize** — clean a messy CSV (case, punctuation, legal suffixes, addresses, duplicates).
2. **Match** — score entity names against the Cisco reference with staged fuzzy matching.
3. **Review** — a human approves or rejects, with notes.
4. **Remember** — approved matches enter the match library. On the next run those entities are returned instantly with no scoring at all.

The point of the project is step 4. Before it existed, every run re-scored
entities that had already been resolved by hand.

---

## 2. Current state

| | |
|---|---|
| Branch | `Memory_and_SAVM_Allocation`, pushed, tracks `origin/Memory_and_SAVM_Allocation` |
| Latest commit | `2b211df` — "feat(matching): add persistent match library and AE allocation" |
| Position | 1 commit ahead of `main`; no PR opened yet |
| Backend tests | 152, all passing (`python -m pytest tests/` in `Matching_Engine/`) |
| Frontend build | `npm run build` clean |
| Local data | ~223,975 Cisco accounts across ~185,307 SAVM groups imported into `offload.db` |
| Matches | 0 — the match workflow has not been exercised on real data yet |

**The immediate next step a human has not yet done:** run a real match on the
Matching Engine tab and approve something, to confirm the library round-trip
works end to end outside the tests.

---

## 3. Architecture

```
Browser (Next.js :3000)
   ├── small JSON calls  → /api/matcher/*  → Next rewrite → FastAPI :8010
   └── uploads, match runs → FastAPI :8010 directly
                                  │
                                  ├── auth.py         users, sessions, Argon2id
                                  ├── db.py           schema, connections, transactions
                                  ├── cisco_store.py  reference import, AE resolution
                                  ├── match_store.py  match workflow, audit history
                                  └── entity_matcher_v4.py   ← DO NOT MODIFY
                                  │
                                  ▼
                          SQLite  Matching_Engine/offload.db
```

Normalization is the exception: it runs entirely in the browser
(`lib/dataProcessing.ts`) and never touches the API.

### Why two API base URLs

`lib/apiBase.ts` exports both. Short JSON calls go through the Next.js rewrite
so they are same-origin. Uploads and match runs go **directly** to `:8010`,
because the Next dev proxy hangs up with `ECONNRESET` on requests that take a
minute — which surfaced as a 500 even though the backend had finished
successfully. Cookies still work on the direct route: a different port is
cross-origin but same-site, so `SameSite=Lax` is sent, and CORS allows the
origin with credentials.

---

## 4. Data model

Two tables, joined on **SAVM group id**.

### `cisco_accounts` — the reference

One row per SFDC account, so one SAVM group spans many rows. Imported wholesale
from a SQL export; the whole table is replaced each time.

**Key: `(savm_group_id, sfdc_account_name, state)`.** State is in the key
because the same account name legitimately appears under one group in two
states.

Column mapping from the export's 35 headers is in `cisco_store.COLUMN_ALIASES`.
Group-level columns (`SAV_NAME`, `SALES LEVEL 1-6`, vertical, segment, tier,
source) are constant within a group; account-level columns (state, account name,
AE fields) vary.

### `matches` — the memory

Entity name, its Cisco link, the decision, plus `snap_*` columns holding the
account and AE **as they were at approval time**.

Live display always reads `cisco_accounts`. The snapshot exists so history stays
truthful after a re-import. When the two disagree the row is flagged
**drifted** in the UI.

Supporting tables: `users`, `sessions`, `match_history`, `import_batches`.

### Domain vocabulary

- **SAV / SFDC account** — an account-level record from SFDC.
- **SAVM group** — the parent of one or more SAV accounts. May contain just one.
- `source` on each row is `SAV+SFDC`, `SAV_ONLY`, or `SFDC_ONLY`, reflecting which feed it came from. The upstream SQL already resolved this; the app does not merge feeds.

---

## 5. Rules that are easy to get wrong

### Account executive resolution

`NOMINATION_PRIORITY` is already an ordinal rank and **lower wins**.

| Match level | AE comes from |
|---|---|
| `SFDC` | That exact account row. No ranking, no comparison, **even if a sibling ranks higher** |
| `SAVM` | The group's child row with the lowest `am_priority`; ties break alphabetically on account name |

If no child in the group has an AE email, return **no AE** rather than guessing.

### Approval workflow

| Score at creation | Status | Who resolves |
|---|---|---|
| ≥ 95% | `pending_admin_approval` | admin only |
| < 95% | `pending_review` | reviewer or admin |
| any | `rejected` — **notes mandatory** | reviewer or admin |

Rejections are remembered, keyed on the full account reference
`(entity, group, account name, account state)`. Rejecting one account in a group
must **not** suppress its siblings. Deletes are soft and restorable via
`prev_status`. Every mutation writes one `match_history` row.

### Orientation detection in `/match/run`

The workspace UI sends the reference file as `internal_file` and the entity file
as `external_file` — the opposite of what the matcher's own naming implies. The
library keys on the *entity*, so `/match/run` **detects** which uploaded frame
carries a SAVM group id and treats that side as the reference, ignoring the
labels. Do not "fix" the swap in `app/workspace/matching/page.tsx` without
updating `_orient_frames` in `matcher_service.py`. There is a test for both
orientations.

### Orphans, never deletions

If a SAVM group disappears from a new reference import, its matches are flagged
`link_status='unlinked'` and reported in the import summary. They are never
deleted or auto-rejected, and they re-link automatically if the group returns.

---

## 6. Running it

Ports: **3000** Next.js, **8010** FastAPI, 8501 legacy Streamlit (optional).

```powershell
# One-time: install and create the first admin
cd Matching_Engine
pip install -r requirements.txt
$env:OFFLOAD_ADMIN_USER="you"; $env:OFFLOAD_ADMIN_PASSWORD="<8+ chars>"
python seed_admin.py
$env:OFFLOAD_ADMIN_PASSWORD=""

# Every time — two windows
python matcher_service.py                      # window 1, from Matching_Engine
cd ..\Normalization\Cursor_Build_Norm; npm run dev   # window 2
```

Then `http://localhost:3000/login`.

The schema is created on startup, so there is no migration step. Every
environment variable is documented in `Matching_Engine/.env.example`.

### Tabs

| Tab | Purpose |
|---|---|
| Normalization | Clean a CSV, entirely client-side |
| Matching Engine | Upload two files, run matching, review, export |
| Match Library | The memory: filter, approve/reject, notes, audit history, drift and unlinked badges, export |
| AE Allocation | Browse the Cisco reference and its nominated AEs. Opens filtered to `SAV+SFDC`. Click a row for the whole SAVM group |
| Admin | Approval queue, reference/match/deletion imports, user management, DB backup. Admins only |

---

## 7. Known issues and traps

1. **`launch_offload.bat` is stale.** It starts the API on port **8000** and skips admin seeding, so it does not work. Start the servers manually per section 6, or fix the script.
2. **Port 8000 is occupied** on this machine by an unrelated `circuit_proxy.main` process. That is why the API moved to 8010. If you change the port, set `OFFLOAD_MATCHER_PORT` and `MATCHER_API_ORIGIN` (Next) together.
3. **An old `offload.db` will break startup.** `db.init_db` raises `IncompatibleSchema` with instructions if it finds a pre-relational `matches` or a leftover `savm_accounts` table. Delete the `offload.db*` files.
4. **State blocking defaults to off** in the matching UI for good reason: with a reference file that has no state column, leaving it on returns zero matches. The UI warns.
5. **Never modify `entity_matcher_v4.py`.** It is the sensitive scoring core and also hosts the legacy Streamlit UI. Wrap it.
6. **`matcher_service.py` uses `check_same_thread=False`** because FastAPI runs sync dependencies on a worker thread while async endpoints run on the event loop. Safe only because each request gets its own connection — do not start sharing connections.
7. **The reference export contains real employee names and emails.** `Cisco SAVM List.csv` and `SAV_w_AM_SFDC_w_Goal_*.csv` are gitignored deliberately. Test fixtures use synthetic values only; keep it that way.
8. **Blank rows.** The real export ships with ~224k fully empty trailing rows. The importer skips them and counts them separately as `skipped_blank`.

---

## 8. Where things live

| Path | What |
|---|---|
| `Matching_Engine/` | Python API, matcher, stores, 152 tests |
| `Normalization/Cursor_Build_Norm/` | Next.js 14 app (App Router, TypeScript, Tailwind) |
| `PLAN_Memory_and_SAVM_Allocation.md` | The plan this work implemented — schema, endpoints, phases |
| `LOG.md` | Append-only change log. Add a dated entry per change |
| `OffLoad_Overview.md` | Deep reference on the matching algorithm itself |
| `Kaizen.md` | Parked ideas and backlog |
| `Handover/HANDOFF.md` | **Stale** (Jul 01, pre-match-library). Prefer this README |
| `Archive/` | Superseded versions, prototypes, design explorations |

---

## 9. Technology

**Frontend** — Next.js 14 App Router, TypeScript, Tailwind 3, Framer Motion,
Lucide, Recharts, PapaParse. Cream editorial theme (`#F4F3EE` background,
`#080D44` navy text, `#E5E3DC` borders); components use inline styles in that
palette rather than a theme abstraction.

**Backend** — FastAPI, Uvicorn, SQLite, pandas/NumPy, argon2-cffi, and
jellyfish / python-Levenshtein / fuzzywuzzy for string similarity.

**Requirements** — Node 18+, Python 3.10+ (developed on 3.14).

**Research basis** — UMC + EXC algorithms, Papadakis et al. (2023), *The VLDB Journal*.

---

## 10. Conventions for the next agent

- Add a dated entry to `LOG.md` for every change.
- Every new Python module gets tests in `Matching_Engine/tests/`.
- Parameterize all SQL. No f-strings in queries.
- Soft delete only; nothing is hard-deleted from `matches`.
- Timestamps are UTC ISO-8601 strings via `db.utcnow()`.
- Secrets come from the environment. Never commit a `.env`.
- Run `python -m pytest tests/` and `npm run build` before declaring work done.
