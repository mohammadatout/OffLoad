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
