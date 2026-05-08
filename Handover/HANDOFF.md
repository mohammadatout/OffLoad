# OffLoad — Handover Briefing

You are the next agent picking up work on a project called **OffLoad**.
The user is **Mohammad** — a business user, vibe-coding. He doesn't write
code himself and doesn't hire others. He directs; you build.

**Read `files/.claude/Karpathy_rules.md` first.** Follow it strictly.

---

## 0. What's in this folder

```
Handover/
  HANDOFF.md                  ← this file (read in full before any tool call)
  files/                      ← copies of every file you may need
    .claude/Karpathy_rules.md
    README.md
    launch_offload.bat
    setup_offload.bat
    OffLoad.code-workspace
    Matching_Engine/
      README.md
      requirements.txt
      .streamlit/config.toml
      entity_matcher_v4.py            ← THE CORE. READ-ONLY by default.
      National_CRR_Intern_List.csv    ← sample internal data (605 rows)
      SAVM_External_List.csv          ← sample external data (~47k rows)
    Normalization/Cursor_Build_Norm/
      package.json
      tailwind.config.ts              ← post-Chunk-A: cisco namespace removed
      next.config.js
      tsconfig.json
      README.md
      app/layout.tsx
      app/page.tsx
      app/globals.css
      app/landing/page.tsx
      app/workspace/layout.tsx
      app/workspace/page.tsx          ← 33 KB, the workspace UI
      components/AppShell.tsx         ← top-bar + tab switcher
      components/FileUpload.tsx
      components/StatsPanel.tsx
      components/ConfigurationPanel.tsx
      lib/dataProcessing.ts           ← 34 KB, normalization engine
      lib/types.ts
      lib/utils.ts
      lib/storage.ts
    FrontEnd/cursorrules-editorial-minimalist.md   ← the only design rule
                                                     that matches reality
```

If you need a file that isn't here (e.g. another component, the Streamlit
sample images), Mohammad's live workspace is at `C:\Users\mohaatou\OffLoad`
on Windows; ask him to hand it over or read it from there.

---

## 1. What the project is

A two-tool data suite for entity resolution:
- **Normalization** — Next.js 14 / TypeScript / Tailwind browser app for CSV
  cleaning. Runs entirely client-side. Port 3000.
- **Matching Engine** — Python Streamlit app for fuzzy company-name matching.
  Port 8501. The active engine is `entity_matcher_v4.py`. v1 and v3 exist
  but are archived.

**The Matching Engine is the project's core.** Mohammad cares about its
accuracy and speed more than anything else. Treat `entity_matcher_v4.py`
as read-only. If a task could affect the matcher's behavior, performance,
or accuracy in any way, **STOP and ask** with Pros/Cons before doing
anything. NO EXCEPTIONS, NO MERCY.

### Visual theme — cream editorial only
- Background: `#F4F3EE` (warm off-white, never pure white)
- Foreground: `#0A0A0A` (near-black, never pure black)
- Muted: `#6B6B66`
- Border: `#E5E3DC`
- Single accent = the foreground itself. **No second color.** Warnings can
  use `#B8860B`.
- Fonts: Inter sans + JetBrains Mono.
- No gradients, no shadows, no rounded corners except pill buttons.
- The full rule is in `files/FrontEnd/cursorrules-editorial-minimalist.md`.
- Ignore any file or stale comment that mentions "Obsidian dark", "cyan
  accent #2DD4BF", or "two-context aesthetic" — those have been archived.

### Current routes
- `/` redirects to landing
- `/landing` cream hero "From mess to match"
- `/workspace` wraps `AppShell.tsx`; tabs are `Normalization` (real) and
  `Matching Engine` (placeholder text only — this is what Chunk B/C fixes)

### Current integration state
The Matching Engine tab inside the Next.js workspace is a placeholder.
The real Streamlit tool runs separately on port 8501. Mohammad wants
**one unified browser experience**: switch tabs in one window, no popups,
identical look and feel.

### Mohammad's chosen integration approach
"Truly unified UI" — rebuild the Matching screen in the **same cream theme**
as Normalization. Behind the scenes it calls the existing Python matcher
(`MultiStageEntityMatcher` from `entity_matcher_v4.py`). The end user only
ever sees the Next.js app. Both servers may run, but Mohammad never opens
Streamlit directly anymore. This is **Chunk C** below.

---

## 2. What was already done (the previous agent — Chunk A)

### Q&A verification (don't redo unless suspicious)
- Python syntax of `entity_matcher_v4.py` is valid.
- Python deps install: streamlit 1.52.0, pandas 2.3.3, numpy, jellyfish,
  Levenshtein, fuzzywuzzy, sklearn.
- Next.js production build passes clean: 0 TS errors, 0 lint errors,
  6 routes generate. Workspace bundle is 185 kB.
- Both dev servers start cleanly on 3000 and 8501.
- v4 matcher was smoke-tested end-to-end:
  ```
  internal:
    CA-SAN DIEGO UNIFIED SCHOOL DISTRICT
    TX-AUSTIN INDEPENDENT SCHOOL DISTRICT
    NY-NEW YORK UNIVERSITY
  external:
    SAN DIEGO USD, AUSTIN ISD, NEW YORK UNIVERSITY, STANFORD UNIVERSITY
  ```
  Result with `use_state_blocking=False, use_context_validation=True`:
  100% match rate, all 3 stage_0_exact. Abbreviation expansion correct.

### Cleanup completed
- Created `/Archive/` at the project root and **moved** (not deleted)
  the following stale files into it, preserving relative subpaths:
  - **Root**: `01-landing.jsx`, `landing-prototype.html`,
    `landing-prototype-v2.html`, `Normalization-redesign.jsx`,
    `Design breakdown — Optimus landing.txt`, `Error.png`,
    `Entity Resolution - Mapping.jpg`.
  - **FrontEnd**: `01-landing.jsx`, `MIGRATION.md`, `cursorrules` (the
    dark/two-context one). Kept `cursorrules-editorial-minimalist.md`.
  - **Matching_Engine**: `entity_matcher.py` (v1), `entity_matcher_v3.py`,
    `test_matcher.py`, `test_matcher_v2.py`, `test_matcher_v4.py`,
    `README_V3.md`, `IMPROVEMENTS_SUMMARY.md`, `Opus 4.1.txt`,
    `matching_results_diagnostic.csv`, `matching_results_v3.csv`,
    `matching_results_v4.csv`, `review_items_v4.csv`,
    `unmatched_analysis.csv`, `unmatched_entities.csv`.
  - **Normalization/Cursor_Build_Norm**: entire `design-concepts/` folder,
    orphan components `Sidebar.tsx`, `ColumnRenamer.tsx`,
    `ToolHighlights.tsx`, entire `public/images/` folder. Empty `scripts/`
    folder removed.
- `launch_offload.bat` and `setup_offload.bat` now launch
  `entity_matcher_v4.py` (was v3).
- Root `README.md` no longer claims "Obsidian dark theme" — replaced with
  cream editorial description.
- `Matching_Engine/README.md` Version-History table now flags v1 and v3
  as Archived and adds an archive note.
- `tailwind.config.ts` no longer contains the `cisco` color namespace
  (verified zero references in live code before removal).
- Final `npm run build` passed: 0 errors, same 6 routes, no bundle-size
  regression.

### NOT done
- `requirements.txt` was **not** modified. v4 imports `TfidfVectorizer`
  at module load even though it never calls it; removing scikit-learn
  would break startup. `plotly` is genuinely unused but was left as-is
  (minimum-risk policy). Mohammad can decide later.
- No `.gitignore` added. Mohammad explicitly opted out for now.
- The 3 issues in Section 4 below are **still pending Mohammad's decision**.

---

## 3. The matcher API you'll wire to (Chunks B + C)

```python
from entity_matcher_v4 import MultiStageEntityMatcher

matcher = MultiStageEntityMatcher(
    abbreviations=None,           # dict[str,str] | None
    use_state_blocking=True,      # default True; see GOTCHA below
    use_context_validation=True,
    context_config=None,
)

results_df, stats_dict = matcher.match_entities(
    internal_df,                  # pandas DataFrame
    external_df,                  # pandas DataFrame
    internal_col,                 # column name in internal_df
    external_col,                 # column name in external_df
    progress_callback=None,       # optional callable(progress: float, msg: str)
)

# stats_dict keys:
#   total_internal, total_external,
#   stage_0_exact, stage_1_high_confidence, stage_2_confident,
#   stage_3_probable, stage_4_review,
#   unmatched, total_matched, match_rate, elapsed_time
```

### GOTCHA
If `use_state_blocking=True` and the external file has no state info,
**all matches return zero** with reason `"No candidates in state X"`.
Documented behavior, not a bug. Users have been surprised by this.
Either auto-detect (Issue 3 below) or surface clearly in the new UI.

---

## 4. PENDING DECISIONS — re-ask Mohammad before touching anything

The previous agent presented these and Mohammad said "Go Chunk A" without
answering. Re-ask before proceeding to Chunk B.

### Decision 1 — Streamlit sidebar console warnings
**Symptom:** Streamlit emits ~30 console errors:
```
Invalid color passed for widgetBackgroundColor in theme.sidebar: ""
Invalid color passed for widgetBorderColor in theme.sidebar: ""
Invalid color passed for skeletonBackgroundColor in theme.sidebar: ""
```
**Cause:** `.streamlit/config.toml` only defines top-level `[theme]`.
Streamlit 1.52+ added a `[theme.sidebar]` sub-block with widget color fields.

**Impact:** cosmetic console noise. Functionality is unaffected. Matching
is unaffected.

| Option | Pros | Cons |
|---|---|---|
| **A.** Add `[theme.sidebar]` block with explicit colors to `.streamlit/config.toml` | Clean console; ~2 min; never opens `entity_matcher_v4.py`; zero risk to matching | None |
| B. Leave as-is | Zero touch | Console stays noisy; future real errors get drowned in these |

**Recommended:** A.

### Decision 2 — Material Symbols icons render as text
**Symptom:** In Streamlit the "View/Edit Abbreviations" expander button
shows literal text `keyboard_arrow_rig` instead of a chevron icon.
**Cause:** the inline CSS injected at lines ~40–435 of
`entity_matcher_v4.py` is overriding Streamlit's icon font display.

**Impact:** cosmetic only.

| Option | Pros | Cons |
|---|---|---|
| A. Add ~5 lines of additive CSS *override* at the bottom of v4's CSS block (no logic change) | Fixes the look | Touches the matcher file. Mohammad said no mercy. |
| B. Move v4's CSS into a separate `theme.css` and load via `st.markdown` | Clean separation | Real refactor; small risk of subtle render differences |
| **C.** Defer — Streamlit goes away once Chunk C ships the native cream Matching UI | Zero risk now; problem disappears | Ugly button stays for now |

**Recommended:** C.

### Decision 3 — State-blocking 0-match surprise
**Symptom:** if user uploads an external file with no state info AND has
state blocking ON, they get 0 matches with `"No candidates in state X"`.

| Option | Pros | Cons |
|---|---|---|
| A. Add a one-line warning before Run when matcher detects no state info on external | Saves confusion | Touches matcher UI |
| B. Document in README only | Zero risk | Doc-only fix |
| **C.** Defer to Chunk C — handle in the new native UI | Zero risk now | Surprise persists in Streamlit until then |

**Recommended:** C.

After Mohammad picks A/B/C for each, proceed to Chunk B.

---

## 5. Chunk B — Integration prep (~1.5–2 h, 2 rounds)

Goal: get plumbing in place so Chunk C can build the native UI.

### B.1  Round 1 — pick the backend shape (5-min conversation, no code yet)

| Option | Description | Pros | Cons |
|---|---|---|---|
| 1. **FastAPI sidecar** | Small Python service exposes `POST /match {internal_csv, external_csv, config}` → `{results, stats}`. Next.js fetches it. Streamlit goes away. Two processes (Next.js + FastAPI), both managed by setup/launch bat files. | Standard pattern; debuggable; easy to deploy later; runs on any machine | Another moving part to start |
| 2. **Next.js spawns Python subprocess on demand** | Next.js API route shells out to a thin `matcher_cli.py` that imports `MultiStageEntityMatcher` and prints JSON. No long-running Python service. | Only one server (just Next.js) | Cold start per call; large CSVs reload from disk; harder to add streaming progress later |

**Recommend Option 1** if Mohammad has no preference. Cleaner long-term.

### B.2  Round 2 — execute the chosen plumbing

- Create a thin wrapper file (`matcher_cli.py` or `matcher_service.py`,
  ~50 lines) that **imports** `MultiStageEntityMatcher` from
  `entity_matcher_v4.py` and adds a CLI/HTTP entry point.
  **Do not modify `entity_matcher_v4.py` itself.**
- For Option 1: add `fastapi`, `uvicorn`, `python-multipart` to
  `requirements.txt`. Create `/match` endpoint accepting two uploaded CSVs.
- For Option 2: add a Next.js API route at
  `app/api/match/route.ts` that spawns Python via `child_process`.

### B.3  Add a real `/workspace/matching` route
- New file: `app/workspace/matching/page.tsx`. Initial content:
  "Matching Engine scaffold ready" + a single button "Test backend
  connection" that pings the matcher service and shows OK/FAIL.
- Update `AppShell.tsx`: the "Matching Engine" tab now navigates to
  `/workspace/matching` instead of toggling display. Remove the
  `MatchingEnginePlaceholder` function.
- Confirm `/workspace` (Normalization) still works.

### B.4  Verify
```
cd Normalization/Cursor_Build_Norm
npm run build
```
Must pass with zero errors.

### B.5  Stop and report. Do not auto-proceed to Chunk C.

---

## 6. Chunk C — Native cream Matching UI (~4–6 h, 3–4 rounds)

Build the real Matching screen in cream theme. Sub-chunks:

### C.1 — Round 1: upload + run
Two upload cards (Internal / External) using the same FileUpload pattern
as Normalization. A single "Run Matching" pill button at the bottom (black
fill, white text). Sends to backend from Chunk B. Show a progress
indicator while running.

### C.2 — Round 2: results display
Tabbed results table: "All Matches" / "Stage breakdown" / "Review queue".
Use the cream `data-table` styles already in `globals.css` (mono font,
11 px text, 10 px uppercase tracked headers, 1 px row borders).

### C.3 — Round 3: configuration panel
Left rail (320 px) like Normalization's `ConfigurationPanel`. Sections:
- "Match Strategy" (state blocking toggle, context validation toggle, threshold sliders)
- "Abbreviation Dictionary" (editable list)

All collapsed by default; only one open at a time.

### C.4 — Round 4: review queue + export
Top-3 candidate review for stage_4 entries (radio buttons,
accept/reject/manual). CSV export of final matches.

### Anti-rules for Chunk C
- **Do not import or modify `entity_matcher_v4.py`.** Always go through
  the service/CLI built in Chunk B.
- **No second accent color.** Single accent = foreground. Warnings can use `#B8860B`.
- **Max content width 1440 px.** Match Normalization spacing scale.
- **Auto-expand at most one configuration section.**

---

## 7. Testing protocol after each chunk

```
cd Normalization/Cursor_Build_Norm
npm run build        # must pass with 0 errors
npm run dev          # starts on 3000
```
Open http://localhost:3000, click into `/workspace`, switch tabs, confirm
no console errors.

For matching (after Chunk B+C are wired): upload
`Matching_Engine/National_CRR_Intern_List.csv` as Internal (column
`Full_Entity_Name`) and `Matching_Engine/SAVM_External_List.csv` as
External (column `Company Name`). Set `state_blocking=OFF`,
`context_validation=ON`. Run. Confirm results render and match rate is
reasonable.

---

## 8. Hard rules (every chunk, no exceptions)

- **Do not modify `Matching_Engine/entity_matcher_v4.py`** (functions,
  classes, thresholds, weights, abbreviation dictionary, embedded CSS)
  without explicit per-change approval from Mohammad. This is the
  project's core asset.
- **Do not introduce dark theme tokens, gradients, drop shadows,
  or a second accent color** anywhere.
- **Do not delete files.** Always archive into `/Archive/`.
- **Do not auto-skip user reviews between chunks.**
- **Do not pad estimates** to "1–2 weeks". Quote real hours and rounds.
- **Do not add a `.gitignore`** — Mohammad opted out for now.
- **Do not add new design libraries** (shadcn, MUI, headlessui, etc.).
  Stick with the existing Tailwind + lucide-react + framer-motion stack.
- **Do not refactor adjacent untested code.** Surgical changes only.
- **No emojis** in code or chat output. Mohammad finds them noisy.

---

## 9. Current machine state (when this handover was written)

- OS: Windows, PowerShell shell.
- Working tree: `C:\Users\mohaatou\OffLoad`
- The previous agent killed both dev servers cleanly. To restart:
  ```
  cd Normalization\Cursor_Build_Norm
  npm run dev                                            # port 3000
  ```
  ```
  cd Matching_Engine
  python -m streamlit run entity_matcher_v4.py           # port 8501
  ```
- All node_modules and pip deps are installed.
- Browser MCP cannot simulate native file-picker uploads. If you need
  end-to-end CSV-upload coverage, ask Mohammad to do it manually.

---

## 10. First message to send Mohammad

Suggested template (he expects short, no fluff, no emojis):

> Briefing read. Chunk A is already done by the previous agent
> (cream README, v4 in bat files, Archive folder created). I have
> 3 small decisions still pending — please pick A/B/C for each
> below, then I'll start Chunk B.
>
> [paste the three pros/cons tables from Section 4]

Wait for his answers. Then ask the FastAPI-vs-subprocess question
from Section 5.B.1. Then start coding.
