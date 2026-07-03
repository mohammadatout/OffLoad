# OffLoad - Session Handoff (Updated Jul 01, 2026 - UX Simplification Pass)

## Read First
- `C:\Users\mohaatou\OffLoad\.claude\Karpathy_rules.md` for user-specific workflow preferences.
- Keep edits surgical and provide short, frequent progress updates.

## Current Repo State
- Branch: `enhancements/start`
- Latest commits:
  - `f12c81f` feat(workspace): polish layout readability and table usability
  - `4c4516c` feat(workspace): enhance landing globe and matching output UX
  - `8d07ccb` chore(archive): move legacy frontend rule into Archive
  - `0a5653a` fix(matching): harden long-running matching requests
- Local uncommitted files:
  - Modified: `.claude/Karpathy_rules.md`
  - Untracked: `OffLoad_Overview.md`

## What Was Completed

### Matching Reliability Fixes
- Added a guard in `Matching_Engine/entity_matcher_v4.py` to prevent `ZeroDivisionError` when the uploaded internal dataframe is empty.
- Updated `Normalization/Cursor_Build_Norm/lib/matcherApi.ts` so matcher requests call FastAPI directly (`http://localhost:8000`) instead of going through the Next.js proxy timeout path.

### Batch 1 (Completed)
- Replaced the landing globe with a neural-mesh style animation and slowed rotation in `Normalization/Cursor_Build_Norm/app/landing/page.tsx`.
- Added a temporary comparison page at `Normalization/Cursor_Build_Norm/app/landing-globe-lab/page.tsx`.
- Corrected matching upload semantics (External source vs Internal target) in:
  - `Normalization/Cursor_Build_Norm/components/matching/MatchingUpload.tsx`
  - `Normalization/Cursor_Build_Norm/app/workspace/matching/page.tsx`
- Implemented tagged/ordered matching output in both results table and export:
  - New utility: `Normalization/Cursor_Build_Norm/lib/matchingOutput.ts`
  - Wired in:
    - `Normalization/Cursor_Build_Norm/components/matching/MatchingResults.tsx`
    - `Normalization/Cursor_Build_Norm/components/matching/MatchingExport.tsx`
- Added export naming helpers in `Normalization/Cursor_Build_Norm/lib/utils.ts`:
  - Normalization: `<original>_Cleaned_MMM_DD.csv`
  - Matching: `<external_original>_Matched_MMM_DD.csv`
  - Uses `formatMonthDayTag()` and `toSlugBaseName()`.

### Batch 2 + 2.1 (Completed)
- Header spacing/overlap fixes in `Normalization/Cursor_Build_Norm/components/AppShell.tsx`.
- Saved configuration typography and layout fixes in `Normalization/Cursor_Build_Norm/components/ConfigurationManager.tsx`.
- Input preview table upgrades in `Normalization/Cursor_Build_Norm/components/PreviewTable.tsx`:
  - Horizontal scrolling and better column sizing
  - Quick search/filter
  - Compact/comfortable density toggle
  - Sticky pinned columns (first 1 or 2)
- Changed "Use suggested column" pulse highlight to orange in `Normalization/Cursor_Build_Norm/app/globals.css`.
- Increased left setup pane width and added draggable resize handle in `Normalization/Cursor_Build_Norm/app/workspace/page.tsx`.

### Latest UX Simplification Pass (Completed)
- Normalization config was streamlined in `Normalization/Cursor_Build_Norm/components/ConfigurationPanel.tsx`:
  - Phone + Website normalization moved into Cleaning.
  - Entity Cleaning moved under Dictionaries and renamed Entity Normalization.
  - Compact info-tooltips added; feature title sizing reduced; supportive microcopy simplified.
  - Simple/Advanced support added (driven by page-level mode state).
- Default behavior updated:
  - `uppercaseConversion` now defaults to true in `Normalization/Cursor_Build_Norm/app/workspace/page.tsx`.
- Setup flow upgrades in `Normalization/Cursor_Build_Norm/app/workspace/page.tsx`:
  - Simple/Advanced mode toggle.
  - Recommended one-click config chips after upload.
  - Readiness summary + run control moved into sticky footer in the left config rail.
  - Company warning styling/layout refined ("Use suggestion" and green emphasis updates).
- Preview and compact cards refined:
  - `Normalization/Cursor_Build_Norm/components/PreviewTable.tsx`: fixed 1 pinned column, removed pin selector controls, moved company guidance under title, removed "Showing X of Y" copy.
  - `Normalization/Cursor_Build_Norm/components/DataQualityScoreCard.tsx` and `Normalization/Cursor_Build_Norm/components/TopValuesSpotlight.tsx`: reduced compact-mode whitespace.
  - `Normalization/Cursor_Build_Norm/components/WordFrequencyAnalyzer.tsx`: removed Word Frequency export and compacted top controls.
- Shared toggle style unified in `Normalization/Cursor_Build_Norm/components/ui/Switch.tsx`:
  - Smaller footprint + green ON state aligned to dashboard green.
- Matching UX updates:
  - `Normalization/Cursor_Build_Norm/app/workspace/matching/page.tsx`: smart state-blocking pre-run warning + quick "Turn off".
  - `Normalization/Cursor_Build_Norm/components/matching/MatchingConfigPanel.tsx`: switched to shared toggle component (style parity with Normalization).
  - `Normalization/Cursor_Build_Norm/components/matching/MatchingUpload.tsx` and matching page: improved upload card centering/height and adjusted vertical placement; enlarged Run Matching button.
- Header clean-up:
  - Removed top-right ready badge block from `Normalization/Cursor_Build_Norm/components/AppShell.tsx`.

## Important Behavioral Notes
- UI labels are now user-aligned: External file is treated as the source list and Internal as the target list, with mapped matcher config fields adjusted before request.
- Matching API is expected at `http://localhost:8000`.
- If UI shows stale/blank content after major UI edits, prior stable recovery was:
  1. Stop Next.js process.
  2. Clear `.next`.
  3. Run `npm run build`.
  4. Run `npm run start`.

## Runbook

### Start Services
1. Next.js UI:
   - `cd Normalization/Cursor_Build_Norm`
   - `npm run dev` (or `npm run start` after a production build for stability)
2. Matcher API:
   - `cd Matching_Engine`
   - `uvicorn matcher_service:app --host 0.0.0.0 --port 8000`
3. Legacy Streamlit (optional):
   - `cd Matching_Engine`
   - `python -m streamlit run entity_matcher_v4.py --server.port 8501`

### Smoke Checks
- `http://localhost:3000/landing` shows the updated neural-mesh globe.
- `http://localhost:3000/workspace/matching` accepts uploads and runs matching.
- Exported files follow `_Cleaned_MMM_DD` and `_Matched_MMM_DD`.
- Normalization setup shows Simple/Advanced toggle, recommended chips, and sticky run summary in left rail.
- Matching config toggles visually match Normalization toggles.

## Guardrails For Next Agent
- Do not revert unrelated local changes (`.claude/Karpathy_rules.md`, `OffLoad_Overview.md`).
- Treat `Matching_Engine/entity_matcher_v4.py` as sensitive; avoid additional behavior changes unless explicitly requested.
- Keep UI consistent with the cream editorial direction.
- Keep user-facing updates short and practical.

## Suggested First Message To User
"Briefing synced. Latest UX simplification pass is in place (Simple/Advanced mode, recommended chips, sticky run summary, unified toggles, matching pre-run warnings). Ready for the next enhancement or cleanup task."
