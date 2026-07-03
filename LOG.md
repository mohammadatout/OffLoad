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

