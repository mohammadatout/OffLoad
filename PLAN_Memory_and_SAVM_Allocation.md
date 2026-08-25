# PLAN — Memory & SAVM Allocation

**Branch:** `Memory_and_SAVM_Allocation`
**Goal:** Give OffLoad a persistent, governed match library so confirmed entity→Cisco-account matches are remembered across runs, plus a Cisco account reference table, user accounts, and an approval workflow.

**Core idea:** Stage 1 is a memory lookup. If an entity was matched before, return it instantly and skip fuzzy scoring entirely. Matches accumulate, get faster, stay consistent, and are audited by multiple people.

**Audience:** implementation agents. Every task lists exact file paths, contracts, and acceptance criteria. Do not improvise; if something is ambiguous, stop and ask.

---

## 0. Ground rules for every agent

1. **Never modify `Matching_Engine/entity_matcher_v4.py`.** It is the sensitive matching core. Wrap it, do not edit it. (See `Handover/HANDOFF.md`.)
2. **All SQL must be parameterized.** No f-strings or concatenation in queries.
3. **Never store plaintext passwords.** Argon2id via `passlib`. Never log passwords, tokens, or session IDs.
4. **No secrets in source.** Config from environment variables only. Add `.env.example`, never commit `.env`.
5. **One phase per PR.** Do not start a phase until the previous phase's tests pass.
6. **Every new Python module gets tests** in `Matching_Engine/tests/`.
7. **Soft delete only.** Nothing is ever hard-deleted from `matches`.
8. Timestamps are **UTC ISO-8601 strings** (`datetime.now(timezone.utc).isoformat()`).
9. Run `npm run build` in `Normalization/Cursor_Build_Norm` before declaring any frontend phase done.

---

## 1. Data model

Two tables, joined on **SAVM Group ID**.

| | Table | What it is | Who fills it |
|---|---|---|---|
| **B** | `cisco_accounts` | Reference list of all Cisco accounts + nominated AMs | One SQL export, re-imported wholesale |
| **A** | `matches` | The accumulated match memory | The app, as matches are approved |

**Output** = A joined to B on `savm_group_id`, plus the account key when the match was made at SFDC level.

**Why relational:** re-importing B refreshes every match's account data at once. A stays thin and owns only the decision.

### 1.1 Domain vocabulary

- **SAV / SFDC account** — an account-level record from SFDC.
- **SAVM group** — the parent of one or more SAV accounts. A group may contain a single SAV for very large accounts.
- The reference export is at **SFDC-account grain**, so one `SAVM_ID` appears on many rows.

### 1.2 Reference export

Source file: the SQL export, e.g. `SAV_w_AM_SFDC_w_Goal_2026-08-18-1220.csv` — 35 columns. The copy in the repo is an intentional 18-row sample with ~224k trailing blank rows.

---

## 2. Database schema (SQLite)

Location: `Matching_Engine/offload.db`, overridable with `OFFLOAD_DB_PATH`.
Add `offload.db*` and `Matching_Engine/backups/` to `.gitignore`.

Apply on every connection:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

### 2.1 `schema_version`
```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version     INTEGER NOT NULL,
  applied_at  TEXT    NOT NULL
);
```
Current target: **version 1**.

### 2.2 `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT    NOT NULL,
  role           TEXT    NOT NULL CHECK (role IN ('admin','reviewer')),
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT    NOT NULL,
  created_by     TEXT
);
```

### 2.3 `sessions`
```sql
CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT    PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT    NOT NULL,
  expires_at    TEXT    NOT NULL,
  last_seen_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```
Store only the **SHA-256 hash** of the session token, never the token itself.

### 2.4 `cisco_accounts` — Table B

Grain = one SFDC account row. Group attributes repeat; harmless because the table is replaced wholesale on import.

**Natural key:** `(savm_group_id, sfdc_account_name, state)`.
State is part of the key — in the sample, `GAMMA RESOURCES INC` appears twice under SAVM `700000008`, once `OK` and once `TX`.

```sql
CREATE TABLE IF NOT EXISTS cisco_accounts (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,

  -- group level (constant within a savm_group_id)
  savm_group_id         TEXT    NOT NULL,
  savm_group_name       TEXT,
  sl1                   TEXT,
  sl2                   TEXT,
  sl3                   TEXT,
  sl4                   TEXT,
  sl5                   TEXT,
  sl6                   TEXT,
  vertical              TEXT,
  segment               TEXT,
  tier                  TEXT,
  source                TEXT,
  node_id               TEXT,

  -- account level
  unified_account_name  TEXT,
  sfdc_account_name     TEXT    NOT NULL DEFAULT '',
  state                 TEXT    NOT NULL DEFAULT '',
  sfdc_savm_id          TEXT,
  sfdc_acc_owner_email  TEXT,
  exists_in_sav         TEXT,
  exists_in_sfdc        TEXT,

  -- AM nomination (account level)
  am_cec                TEXT,
  am_name               TEXT,
  am_email              TEXT,
  am_job_title          TEXT,
  am_confidence         TEXT,
  am_priority           INTEGER,
  am_reason             TEXT,
  am_candidate_rank     INTEGER,
  am_in_gs              TEXT,
  am_in_sfdc            TEXT,
  am_in_sav             TEXT,

  -- carried through, not used by the app
  sav_people            TEXT,
  gs_all_emails         TEXT,
  gs_max_end_date       TEXT,
  edwsf_update_dtm      TEXT,

  -- bookkeeping
  is_active             INTEGER NOT NULL DEFAULT 1,
  import_batch_id       INTEGER REFERENCES import_batches(id),
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cisco_key
  ON cisco_accounts(savm_group_id, sfdc_account_name, state);

CREATE INDEX IF NOT EXISTS idx_cisco_group    ON cisco_accounts(savm_group_id);
CREATE INDEX IF NOT EXISTS idx_cisco_group_nm ON cisco_accounts(savm_group_name);
CREATE INDEX IF NOT EXISTS idx_cisco_acct_nm  ON cisco_accounts(sfdc_account_name);
CREATE INDEX IF NOT EXISTS idx_cisco_state    ON cisco_accounts(state);
CREATE INDEX IF NOT EXISTS idx_cisco_vertical ON cisco_accounts(vertical);
CREATE INDEX IF NOT EXISTS idx_cisco_active   ON cisco_accounts(is_active);
```

`sfdc_account_name` and `state` default to `''` rather than NULL so the unique index behaves predictably.

#### Column mapping from the export

Group level:

| Column | Source header |
|---|---|
| `savm_group_id` | `SAVM_ID` |
| `savm_group_name` | `SAV_NAME` |
| `sl1`–`sl6` | `SALES LEVEL 1`–`SALES LEVEL 6` |
| `vertical` | `SAV_VERTICAL_TOP` |
| `segment` | `NODE_SEGMENT` |
| `tier` | `NODE_SUBSEGMENT` |
| `source` | `SOURCE` — `SAV` \| `SFDC` \| `SAV+SFDC` |
| `node_id` | `NODE_ID` |

Account level:

| Column | Source header |
|---|---|
| `unified_account_name` | `UNIFIED_ACCOUNT_NAME` |
| `sfdc_account_name` | `SFDC_ACC_NAME` |
| `state` | `UNIFIED_STATE` |
| `sfdc_savm_id` | `SFDC_SAVM_ID` |
| `sfdc_acc_owner_email` | `SFDC_ACC_OWNER_EMAIL` |
| `exists_in_sav` | `EXISTS_IN_SAV` |
| `exists_in_sfdc` | `EXISTS_IN_SFDC` |

AM nomination:

| Column | Source header |
|---|---|
| `am_cec` | `NOMINATED_OWNER_CEC` |
| `am_name` | `NOMINATED_OWNER_NAME` |
| `am_email` | `NOMINATED_OWNER_EMAIL` |
| `am_job_title` | `NOMINATED_OWNER_JOB_TITLE` |
| `am_confidence` | `CONFIDENCE_LEVEL` |
| `am_priority` | `NOMINATION_PRIORITY` |
| `am_reason` | `NOMINATION_REASON` |
| `am_candidate_rank` | `CANDIDATE_RANK` |
| `am_in_gs` / `am_in_sfdc` / `am_in_sav` | `NOMINATED_OWNER_IN_GS` / `_IN_SFDC` / `_IN_SAV` |

Carried through unused: `SAV_PEOPLE`, `GS_ALL_EMAILS`, `GS_MAX_END_DATE`, `EDWSF_UPDATE_DTM`.

`UNIFIED_ACCOUNT_NAME` equals `SFDC_ACC_NAME` in the sample, but both are stored — they can diverge in the full dataset.

### 2.5 `matches` — Table A (the memory)

```sql
CREATE TABLE IF NOT EXISTS matches (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,

  entity_name_original  TEXT    NOT NULL,
  entity_name_cleaned   TEXT    NOT NULL,
  entity_state          TEXT    NOT NULL DEFAULT '',

  savm_group_id         TEXT,
  sfdc_account_name     TEXT,
  account_state         TEXT,
  match_level           TEXT    CHECK (match_level IN ('SAVM','SFDC')),

  snap_savm_group_name  TEXT,
  snap_account_name     TEXT,
  snap_am_name          TEXT,
  snap_am_email         TEXT,
  snap_am_confidence    TEXT,

  confidence_score      REAL,
  match_stage           TEXT,

  status                TEXT    NOT NULL CHECK (status IN
                          ('pending_admin_approval','pending_review','active','rejected','deleted')),
  notes                 TEXT,

  source                TEXT    NOT NULL CHECK (source IN ('match_run','bulk_upload','manual')),
  source_detail         TEXT,

  created_by            TEXT    NOT NULL,
  created_at            TEXT    NOT NULL,
  updated_by            TEXT,
  updated_at            TEXT,
  decided_by            TEXT,
  decided_at            TEXT,

  link_status           TEXT    NOT NULL DEFAULT 'linked'
                          CHECK (link_status IN ('linked','unlinked')),
  prev_status           TEXT
);

CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_cleaned ON matches(entity_name_cleaned);
CREATE INDEX IF NOT EXISTS idx_matches_group   ON matches(savm_group_id);

-- One ACTIVE match per entity. Rejected/deleted rows are exempt.
CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_active_unique
  ON matches(entity_name_cleaned, entity_state)
  WHERE status = 'active';
```

For an SFDC-level match the link is the full B key: `savm_group_id` + `sfdc_account_name` + `account_state`.

**Snapshots** are written once at approval and never refreshed by a B import. Live display reads B; snapshots feed history and drift detection. If a snapshot no longer matches B, flag the row **drifted** in the library view.

`prev_status` exists only to support restore-after-delete.

### 2.6 `match_history`
```sql
CREATE TABLE IF NOT EXISTS match_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id      INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  event         TEXT    NOT NULL CHECK (event IN
                  ('created','approved','rejected','edited','deleted','restored','imported','unlinked')),
  from_status   TEXT,
  to_status     TEXT,
  field_changes TEXT,
  notes         TEXT,
  actor         TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_match ON match_history(match_id);
```
`field_changes` is a JSON string: `{"notes": {"from": "...", "to": "..."}}`.

### 2.7 `import_batches`
```sql
CREATE TABLE IF NOT EXISTS import_batches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  kind            TEXT    NOT NULL CHECK (kind IN ('cisco_accounts','matches','deletions')),
  filename        TEXT    NOT NULL,
  row_count       INTEGER NOT NULL DEFAULT 0,
  inserted        INTEGER NOT NULL DEFAULT 0,
  updated         INTEGER NOT NULL DEFAULT 0,
  deactivated     INTEGER NOT NULL DEFAULT 0,
  skipped         INTEGER NOT NULL DEFAULT 0,
  skipped_blank   INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  newly_unlinked  INTEGER NOT NULL DEFAULT 0,
  error_report    TEXT,
  actor           TEXT    NOT NULL,
  created_at      TEXT    NOT NULL
);
```

---

## 3. Status model

| Score at creation | Initial status | Who can resolve |
|---|---|---|
| ≥ 0.95 | `pending_admin_approval` | admin only |
| < 0.95 | `pending_review` | reviewer or admin |
| any | `rejected` (notes **required**) | reviewer or admin |
| n/a | `active` | set by approval, or by pre-approved bulk upload |
| n/a | `deleted` | soft delete, admin only |

**Legal transitions** (reject anything else with HTTP 409):

```
pending_admin_approval → active | rejected | deleted
pending_review         → active | rejected | deleted
active                 → rejected | deleted
rejected               → pending_review | deleted
deleted                → (restore) prev_status
```

**Rejection memory:** rejected rows stay. When a run produces a pair that already exists as `rejected`, do not re-create it — report it as `suppressed_previously_rejected` so the reviewer sees why it is missing. Keyed on `(entity_name_cleaned, savm_group_id, sfdc_account_name, account_state)`.

---

## 4. Matching behaviour

1. **Stage 1 — memory.** Look up `entity_name_cleaned` (+ `entity_state`) in active matches. Hit → return immediately with `Match_Stage = 'verified_library'` and `Confidence_Score = 1.0`. **No fuzzy scoring.**
2. **Misses** go to `MultiStageEntityMatcher`, scored against **both** `savm_group_name` and the account name. Higher score wins and sets `match_level`.
3. Suppress previously rejected pairs.
4. Stage new rows: ≥0.95 → `pending_admin_approval`; <0.95 → `pending_review`.

### 4.1 AM resolution

| Match level | AM comes from |
|---|---|
| `SFDC` | **That exact row.** No ranking, no comparison, even if a sibling ranks higher |
| `SAVM` | The group's best child row, chosen by `am_priority` |

`NOMINATION_PRIORITY` is already an ordinal rank and maps 1:1 to `CONFIDENCE_LEVEL` (`HIGH`=2, `MEDIUM`=4 in the sample). **Lower number wins.** No derived rank column — sort on `am_priority`, display `am_confidence`.

SAVM-level rules:
- Lowest `am_priority` wins.
- Ties → lowest `sfdc_account_name` alphabetically, for determinism.
- `am_priority` null/unparseable → treated as worst.
- No child has an `am_email` → return **no AM**. Do not guess.
- Output carries `am_source_account_name` and `am_confidence` so the pick is auditable.

---

## 5. API contract

Served by FastAPI on `:8000`, reached by the browser as `/api/matcher/*` through the existing Next.js rewrite:

```js
{ source: '/api/matcher/:path*', destination: 'http://localhost:8000/:path*' }
```

Going through the proxy makes everything same-origin so `SameSite=Lax` HttpOnly cookies work. `lib/matcherApi.ts` currently calls `:8000` directly and must be changed (Task 11.1).

All endpoints except `/health` and `/auth/login` require a valid session. `401` when absent/expired, `403` when the role is insufficient. Never leak whether a username exists.

### 5.1 Auth
| Method | Path | Role | Body → Response |
|---|---|---|---|
| POST | `/auth/login` | – | `{username, password}` → sets `offload_session` cookie; `{username, role}` |
| POST | `/auth/logout` | any | → `{ok: true}` |
| GET | `/auth/me` | any | → `{username, role}` |

Cookie flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` from `OFFLOAD_SESSION_HOURS`. `Secure` when `OFFLOAD_COOKIE_SECURE=1`.

### 5.2 Users (admin only)
| Method | Path | Body → Response |
|---|---|---|
| GET | `/users` | → `[{id, username, role, is_active, created_at}]` |
| POST | `/users` | `{username, password, role}` → created user |
| PATCH | `/users/{id}` | `{role?, is_active?, password?}` → updated user |

Password policy: minimum 8 characters, max 128, no composition rules.

### 5.3 Cisco accounts
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/accounts` | any | Query: `search`, `state`, `vertical`, `tier`, `source`, `limit` (≤200, default 50), `offset` → `{items, total}` |
| GET | `/accounts/{id}` | any | One account row |
| GET | `/accounts/group/{savm_group_id}` | any | Every account in the group + the resolved AM |
| POST | `/accounts/import` | admin | multipart `file` (CSV). Wholesale replace. Returns an `import_batches` summary |
| GET | `/accounts/import/{batch_id}` | admin | Batch result + error report |

### 5.4 Matches
| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/matches` | any | Query: `status`, `search`, `state`, `vertical`, `link_status`, `limit` (≤200), `offset` → `{items, total}` |
| POST | `/matches` | any | `{entity_name_original, entity_name_cleaned, entity_state?, savm_group_id, sfdc_account_name?, account_state?, notes?}` |
| PATCH | `/matches/{id}` | any | `{notes}` — notes only; logged to history |
| POST | `/matches/{id}/approve` | role-gated by status | `{notes?}` → `active` |
| POST | `/matches/{id}/reject` | any | `{notes}` **required** → `rejected` |
| POST | `/matches/bulk-approve` | admin | `{ids: [int], notes?}` → `{approved, failed:[{id,reason}]}` |
| DELETE | `/matches/{id}` | admin | `{notes}` → soft delete |
| POST | `/matches/{id}/restore` | admin | → `prev_status` |
| GET | `/matches/{id}/history` | any | history rows, newest first |
| POST | `/matches/import` | admin | multipart CSV of pre-approved historical matches → `active` |
| POST | `/matches/import-deletions` | admin | multipart CSV → soft-deletes |
| GET | `/matches/export` | any | CSV of the current filter, joined to B |

### 5.5 Match run
| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/match` | any | **Keep unchanged** — existing stateless endpoint |
| POST | `/match/run` | any | Same inputs plus library integration per §4 |

`/match/run` response = existing `{results, stats}` plus `library_hits`, `newly_staged`, `suppressed`.

### 5.6 Errors
Uniform shape: `{"error": {"code": "...", "message": "..."}}`.
Codes: `unauthorized`, `forbidden`, `not_found`, `invalid_transition`, `duplicate_active_match`, `validation_failed`, `file_too_large`, `unsupported_file_type`, `import_failed`.

---

## 6. Phased task list

### Phase 1 — Database foundation
**Files:** create `Matching_Engine/db.py`, `Matching_Engine/tests/test_db.py`

- [ ] **1.1** `get_connection(db_path=None)` reading `OFFLOAD_DB_PATH`. WAL + foreign keys, `sqlite3.Row` factory.
- [ ] **1.2** `init_db(conn)` creating every table in §2 idempotently, writing `schema_version = 1`.
- [ ] **1.3** `@contextmanager transaction(conn)` — commit on success, rollback on exception.
- [ ] **1.4** `utcnow() -> str`.
- [ ] **1.5** Add `offload.db*` and `Matching_Engine/backups/` to `.gitignore`.
- [ ] **1.6** Tests: all 7 tables created; `init_db` twice is a no-op; the partial unique index blocks a second `active` row for one `(entity_name_cleaned, entity_state)` but allows a second `rejected` row; the `cisco_accounts` triple key blocks exact duplicates and allows the same account name in two states.

### Phase 2 — Auth
**Files:** create `Matching_Engine/auth.py`, `Matching_Engine/seed_admin.py`, `Matching_Engine/tests/test_auth.py`; modify `Matching_Engine/requirements.txt`

- [ ] **2.1** Add `passlib[argon2]`, `argon2-cffi`, `pytest`, `httpx` to `requirements.txt`.
- [ ] **2.2** `hash_password`, `verify_password` (Argon2id via `CryptContext`).
- [ ] **2.3** `create_user(conn, username, password, role, created_by)` — rejects duplicates and passwords under 8 chars.
- [ ] **2.4** `create_session(conn, user_id)` — 32-byte `secrets.token_urlsafe`; store SHA-256 hash; return the raw token once.
- [ ] **2.5** `resolve_session(conn, raw_token)` → user row or `None`; purges expired rows, updates `last_seen_at`.
- [ ] **2.6** `delete_session`, `list_users`, `update_user`, `authenticate`.
- [ ] **2.7** `seed_admin.py` CLI reading `OFFLOAD_ADMIN_USER` / `OFFLOAD_ADMIN_PASSWORD`; exits non-zero if either is missing. **No default password.**
- [ ] **2.8** Tests: correct password verifies, wrong fails; hash ≠ plaintext; expired session → `None`; duplicate username rejected; short password rejected; inactive user cannot authenticate.

### Phase 3 — Cisco accounts store
**Files:** create `Matching_Engine/cisco_store.py`, `Matching_Engine/tests/test_cisco_store.py`

- [ ] **3.1** `COLUMN_ALIASES` per §2.4, matched case-insensitively and whitespace-trimmed. `REQUIRED = {"savm_group_id"}`.
- [ ] **3.2** Unknown columns are ignored, not fatal; their names go into the batch `error_report` as warnings.
- [ ] **3.3** `import_accounts_csv(conn, file_bytes, filename, actor)`:
  - Stream with `csv.DictReader` over a text wrapper. **Never** `read_csv` the whole file into pandas — real exports run 100k–1M rows.
  - Batch `executemany` in chunks of 1000.
  - Skip rows with a blank `SAVM_ID` and count them as `skipped_blank`, not failures.
  - Wholesale replace: set `is_active = 0` on everything first, then upsert on `(savm_group_id, sfdc_account_name, state)` setting `is_active = 1`.
  - Coerce `am_priority` / `am_candidate_rank` to int, `None` when unparseable.
  - After import, flag orphan matches (§3.5) and count them as `newly_unlinked`.
  - Write one `import_batches` row and return it.
- [ ] **3.4** `list_accounts`, `get_account`, `get_group_accounts`.
- [ ] **3.5** `flag_orphan_matches(conn)` — matches whose `savm_group_id` has no active account become `link_status='unlinked'` with an `unlinked` history row. Never delete, never auto-reject. Re-linking happens automatically on a later import that restores the group.
- [ ] **3.6** `resolve_group_am(conn, savm_group_id)` — §4.1 rules. `resolve_account_am(row)` for SFDC level.
- [ ] **3.7** Tests:
  - All 35 real headers map correctly.
  - Blank rows skipped and counted as `skipped_blank`.
  - Same account name in two states → two rows.
  - Exact duplicate key → one row.
  - Re-import deactivates rows absent from the new file.
  - `resolve_group_am` picks lowest `am_priority`; ties break alphabetically; all-null → no AM.
  - SFDC-level AM ignores a better-ranked sibling.
  - Orphan flagging sets `unlinked` and writes history.
  - Header-only file = valid zero-row import.

### Phase 4 — Match store & workflow
**Files:** create `Matching_Engine/match_store.py`, `Matching_Engine/tests/test_match_store.py`

- [ ] **4.1** `create_match(conn, payload, actor)` — status from score per §3; snapshots captured from B; writes a `created` history row.
- [ ] **4.2** `ALLOWED_TRANSITIONS` + `_assert_transition` raising `InvalidTransition`.
- [ ] **4.3** `approve_match(conn, match_id, actor, role, notes)` — admin-only for `pending_admin_approval`; sets `decided_by`/`decided_at`; raises `DuplicateActiveMatch` on conflict.
- [ ] **4.4** `reject_match` — notes required, empty rejected.
- [ ] **4.5** `update_notes`, `soft_delete_match`, `restore_match` (uses `prev_status`) — all write history.
- [ ] **4.6** `list_matches(conn, filters)` → `{items, total}` joined to B for live account data, with a `drifted` boolean; `get_match_history`.
- [ ] **4.7** `get_active_library(conn)` → `{(cleaned, state): {...}}`.
- [ ] **4.8** `get_rejected_keys(conn)` → set of `(cleaned, group_id, account_name, account_state)`.
- [ ] **4.9** `bulk_approve` — per-row failures reported, the rest commit.
- [ ] **4.10** Tests: score thresholds route correctly; reviewer blocked from the admin queue; reject without notes raises; illegal transition raises; two actives blocked; every mutation writes exactly one history row; drift detected when B changes.

### Phase 5 — Wire the API
**Files:** modify `Matching_Engine/matcher_service.py`; create `Matching_Engine/tests/test_service_api.py`

- [ ] **5.1** Startup hook calling `init_db`.
- [ ] **5.2** `require_user()` / `require_admin()` dependencies reading the `offload_session` cookie.
- [ ] **5.3** Implement §5.1–§5.4.
- [ ] **5.4** Implement `/match/run` per §4. **Leave `/match` exactly as it is.**
- [ ] **5.5** Global exception handler producing the §5.6 shape. Never return a traceback.
- [ ] **5.6** Enforce `OFFLOAD_MAX_UPLOAD_BYTES` (default 50 MB) on uploads.
- [ ] **5.7** CORS limited to `http://localhost:3000`, `allow_credentials=True`.
- [ ] **5.8** Tests: unauthenticated → 401; reviewer on an admin route → 403; full login → run → approve → second run hits the library.

### Phase 6 — Bulk import & deletion
**Files:** modify `Matching_Engine/match_store.py`, `matcher_service.py`; create `Matching_Engine/tests/test_imports.py`

- [ ] **6.1** Historical match import CSV. Required: `entity_name_original`, `entity_name_cleaned`, `savm_group_id`. Optional: `entity_state`, `sfdc_account_name`, `account_state`, `notes`. Imports as `active`, `source='bulk_upload'`.
- [ ] **6.2** Per-row failure reasons: `unknown_group`, `unknown_account`, `missing_reference`. Non-fatal.
- [ ] **6.3** Collision with an existing active match → `skipped` / `duplicate_active_match`.
- [ ] **6.4** Deletion import: `match_id`, or `entity_name_cleaned` + `savm_group_id`. Soft-deletes with history.
- [ ] **6.5** Both endpoints return the batch summary with a downloadable error report.
- [ ] **6.6** Tests: partial-failure import; duplicate handling; deletion by both key styles.

### Phase 7 — Frontend auth
All paths relative to `Normalization/Cursor_Build_Norm/`.
**Files:** create `app/login/page.tsx`, `lib/authApi.ts`, `lib/authTypes.ts`, `middleware.ts`; modify `lib/matcherApi.ts`, `components/AppShell.tsx`

- [ ] **7.1** `API_BASE` → `/api/matcher`, add `credentials: 'include'` everywhere.
- [ ] **7.2** `lib/authApi.ts`: `login`, `logout`, `getMe`.
- [ ] **7.3** `app/login/page.tsx` — cream editorial styling. One generic error: *"Invalid username or password."*
- [ ] **7.4** `middleware.ts` — redirect unauthenticated `/workspace/*` to `/login`.
- [ ] **7.5** `AppShell.tsx` — username + role, Logout, and tabs for **Match Library** and (admin) **Admin**.
- [ ] **7.6** `<input type="password">`, paste allowed.

### Phase 8 — Match Library page
**Files:** create `app/workspace/library/page.tsx`, `components/library/*`, `lib/libraryApi.ts`, `lib/libraryTypes.ts`

- [ ] **8.1** Types mirroring §5.4.
- [ ] **8.2** Paginated table: Entity (Original / Cleaned), Entity State, SAVM Group Name, SAVM Group ID, Account Name, Match Level, AM Name, AM Confidence, Vertical, Tier, Score, Status, Source, Created By, Created At, Notes.
- [ ] **8.3** Server-side filters: status, search, state, vertical, link status.
- [ ] **8.4** Inline notes editing.
- [ ] **8.5** History drawer.
- [ ] **8.6** Approve / Reject (notes modal) / Delete (admin).
- [ ] **8.7** Export with active filters.
- [ ] **8.8** **drifted** badge and **unlinked** filter.
- [ ] **8.9** Reuse `components/ui/*`.

### Phase 9 — Admin pages
**Files:** create `app/workspace/admin/*`, `components/admin/*`

- [ ] **9.1** Approval queue = `status=pending_admin_approval` with select-all + bulk approve.
- [ ] **9.2** User manager: list, create, role change, deactivate, password reset.
- [ ] **9.3** Account import: single file picker, no source dropdown, result summary with failed-row reasons and `newly_unlinked` count.
- [ ] **9.4** Historical-match import and deletion import reusing `ImportResultCard`.
- [ ] **9.5** Admin routes guarded server-side, not just hidden.

### Phase 10 — Results page integration
**Files:** modify `app/workspace/matching/page.tsx`, `components/matching/ReviewQueue.tsx`, `MatchingResults.tsx`, `lib/matchingTypes.ts`

- [ ] **10.1** Notes textarea per review card; extend `ReviewDecision` with `notes`.
- [ ] **10.2** Reject disabled until notes are non-empty.
- [ ] **10.3** Switch to `POST /match/run`; surface "X from library, Y staged, Z suppressed".
- [ ] **10.4** **Save decisions to library** button with a per-row result summary.
- [ ] **10.5** Badge `verified_library` rows distinctly.
- [ ] **10.6** Comment that the internal/external column swap at lines ~96–101 is intentional.

### Phase 11 — Docs & ops
- [ ] **11.1** `Matching_Engine/README.md` — env vars, seeding, migrations.
- [ ] **11.2** Root `README.md` — login step, new tabs.
- [ ] **11.3** `LOG.md` — dated entry.
- [ ] **11.4** Update `launch_offload.bat` / `setup_offload.bat` if startup changed.
- [ ] **11.5** `POST /admin/backup` — timestamped copy into `Matching_Engine/backups/`.
- [ ] **11.6** `Matching_Engine/.env.example` with placeholders.

---

## 7. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `OFFLOAD_DB_PATH` | `offload.db` | SQLite file |
| `OFFLOAD_MAX_UPLOAD_BYTES` | `52428800` | Upload cap |
| `OFFLOAD_SESSION_HOURS` | `8` | Session lifetime |
| `OFFLOAD_COOKIE_SECURE` | `0` | `1` when served over HTTPS |
| `OFFLOAD_ADMIN_USER` | – | Seed script only |
| `OFFLOAD_ADMIN_PASSWORD` | – | Seed script only |
| `NEXT_PUBLIC_MATCHER_API_URL` | `/api/matcher` | Frontend API base |

---

## 8. Definition of done

1. A fresh clone plus `seed_admin.py` yields a working login.
2. Running a match, approving a result, then re-running the **same file** returns those rows as `verified_library` without re-scoring.
3. A rejected match never reappears as a suggestion.
4. Every status change is visible in the history drawer with actor and timestamp.
5. Two active matches for one entity are impossible.
6. A 100k+ row account import completes without loading the whole file into memory.
7. Removing a group from the reference file flags its matches `unlinked` rather than deleting them.
8. SAVM-level matches resolve the AM by lowest `am_priority`; SFDC-level matches use their own row.
9. `pytest Matching_Engine/tests/` passes.
10. `npm run build` succeeds in `Normalization/Cursor_Build_Norm`.
11. No secrets, passwords, or tokens in source or logs.

---

## 9. Deliberately out of scope

Multi-project scoping · conflict-resolution UI beyond the duplicate block · Excel multi-sheet export · analytics dashboard · AI-assisted review · parent/child roll-up beyond SAVM→SFDC · SSO. These stay in `Kaizen.md`.
