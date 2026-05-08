# EntityMatch Pro — Migration Runbook

Step-by-step plan to refactor your current frontend to match `01-landing.jsx` (landing) and `entitymatch-redesign.jsx` (tool). Each phase has a copy-paste prompt for Cursor.

**Order matters.** Do not skip phases. Do not parallelize.

---

## Phase 0 — Setup (10 min)

**Goal:** Project foundation in place before touching components.

### Step 0.1 — Drop in the design rules
1. Save the `.cursorrules` file at your project root (same folder as `package.json`).
2. Save `01-landing.jsx` and `entitymatch-redesign.jsx` into a `/reference` folder so Cursor can see them when you @-mention them.

### Step 0.2 — Verify dependencies
Open a terminal in your project root and run:
```
npm install lucide-react
```
If you don't already have Tailwind: follow https://tailwindcss.com/docs/installation, then continue.

### Step 0.3 — Add Inter font
In your root layout file (e.g. `app/layout.tsx` or `index.html`):
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```
Then in your global CSS, set `body { font-family: 'Inter', system-ui, sans-serif; }`.

### Step 0.4 — Confirm route structure
You need (or should create) these routes:
- `/` → landing
- `/normalization` → tool, normalization tab
- `/matching` → tool, matching engine tab
- `/offload` → tool, offload tab

If your app is single-page with tabs, that's fine — treat the landing as a separate "screen" that the user dismisses on click of "Start matching."

---

## Phase 1 — Landing page (45 min)

**Goal:** Replace your current landing with the cream editorial design.

### Cursor prompt
```
Following the rules in .cursorrules and using @01-landing.jsx as the reference,
replace the current landing route at <YOUR LANDING FILE PATH> with a cream editorial
hero. Preserve any existing routing, auth, or analytics calls in the surrounding
shell — only replace the visual content of the landing screen.

Requirements:
- Background: #F4F3EE with the faint 80px grid
- Headline: "From mess to match." with hand-drawn underline on "match"
- Eyebrow: "— THE STUDIO FOR CLEAN DATA"
- Two pill CTAs: "Start matching" (black, with arrow) and "Watch demo" (outlined)
- Particle canvas visual on the right (copy the ParticleSwirl component from the reference)
- Stat row at bottom: 1,228 rows / 99% accuracy / 40% dedup / 6 sources

The "Start matching" button must navigate to /normalization (or whatever the tool
entry route is in this codebase).

Do not import any other styles or themes. Do not add gradients, shadows, or color
beyond what is in the reference file.
```

### Verify before moving on
1. The hero loads with cream background.
2. Click "Start matching" → lands on `/normalization` (or your equivalent).
3. The canvas particle visual rotates slowly.
4. The underline animates in on page load.
5. There is NO sidebar, NO tabs, NO app chrome on the landing.

---

## Phase 2 — App shell (30 min)

**Goal:** Replace the current top bar + sidebar with the dark workbench shell. This is the chrome that will wrap every app route.

### Cursor prompt
```
Following the rules in .cursorrules and using @entitymatch-redesign.jsx as the
reference, refactor the app shell that wraps the routes /normalization, /matching,
and /offload.

Replace the current implementation with:

1. A 48px top bar containing:
   - Brand mark (cyan square + "EntityMatch Pro")
   - Three tabs: Offload, Normalization, Matching Engine — only the active tab has a filled background
   - Right side: persistent context stats "1,228 rows | 6 cols | 87 quality" in mono font

2. A step indicator bar directly below, with four steps: Upload, Configure, Process, Results.
   Active step uses cyan accent. Completed steps show checkmark. Future steps are muted.

3. Remove the existing left sidebar with the unlabeled icons (home / settings / book / save).
   These features get folded into the top bar or a future settings menu — they do NOT
   appear in the main shell.

4. Page content area below the step indicator must use a max-width of 1440px and
   horizontal padding of 24px.

Apply the dark token palette from .cursorrules:
- bg #0B0D0E, surface #0F1112, border #1F2224, text #E8E8E6, accent #2DD4BF

Do not include any marketing imagery, gradient banners, or stat cards in this shell.
The shell must look identical across all three app routes.
```

### Verify before moving on
1. Top bar is 48px tall, dark, with three tabs.
2. Step indicator is visible directly below on every app route.
3. The unlabeled left sidebar icons are gone.
4. No gradient banner, no network image, no Data Wrangling Studio hero.

---

## Phase 3 — Configuration screen (60 min)

**Goal:** This is your most overwhelming screen. Refactor it to use progressive disclosure.

### Cursor prompt
```
Following @entitymatch-redesign.jsx, refactor the Configuration screen at
<YOUR CONFIGURATION FILE PATH>.

Two-column layout: left config panel (320px), right work area (rest).

LEFT CONFIG PANEL:
- Header: "CONFIGURATION" label in mono uppercase + "Reset" link on the right
- Six collapsible sections in this order:
  1. Cleaning & Normalization (icon: Layers)
  2. Parsing (icon: FileText)
  3. Phone, Website & Links (icon: Phone)
  4. City & State Validation (icon: MapPin)
  5. Deduplication Strategy (icon: Filter)
  6. Dictionaries & Lists (icon: Book)
- ALL sections must be collapsed by default. Only the actively-edited section opens.
- Each section header shows: icon, title, optional active-count badge (e.g. "3 active" in cyan/10%), and a chevron.
- At the bottom of the left panel: ONE primary button "Run Normalization" in cyan.

RIGHT WORK AREA, top to bottom:
1. Required-action callout (amber border, amber icon) prompting the user to select the main entity field, with a "Use suggestion →" link.
2. Two-column row: Quality Score card (260px wide) on the left, Input Preview table on the right.
   - Quality Score card: big "87" number, then 4 bar metrics (Completeness 100%, Validity 100%, Consistency 100%, Uniqueness 36% in amber).
   - Input Preview: mono table, 5 sample rows from the user's actual data, with column headers in uppercase mono.
3. Footer line: small muted text "Configuration auto-saves. Click Run Normalization when ready."

DELETE FROM THIS SCREEN:
- The 4 marketing stat cards (10x faster / 85% less time / 99% accuracy / 40% reduction)
- The gradient hero banner with the network image
- The "Powered by EntityMatch Pro" footer text
- The separate column quality breakdown panel (it merges into the Quality Score card)
- The Live Stats / Column Type Distribution / Top Values Spotlight panels
  (these move to the Process or Results step, not Configure)

PRESERVE:
- All existing data-loading logic, file upload handlers, processing functions
- All checkbox state for column selection
- The actual business logic in your reducers / hooks / API calls

This is a visual refactor. Behavior must be identical.
```

### Verify before moving on
1. Left config panel has 6 sections, ALL COLLAPSED on first load.
2. Click the first section → it expands. Click another → first collapses.
3. One cyan "Run Normalization" button is visible at panel bottom.
4. Right side shows Quality card + table side by side.
5. The marketing stat cards are gone.
6. Existing file upload still works. Existing config persistence still works.

---

## Phase 4 — Matching Engine screen (45 min)

**Goal:** Currently nearly empty. Make it match the same shell density as Configure.

### Cursor prompt
```
Following the rules in .cursorrules, refactor the Matching Engine screen at
<YOUR MATCHING ENGINE FILE PATH> to match the visual density and pattern of the
Configuration screen we just built.

Use the same two-column layout: left 320px config panel, right work area.

LEFT CONFIG PANEL — sections specific to matching:
1. Match Strategy (icon: Filter) — fuzzy threshold, blocking key, scoring weights
2. Field Mapping (icon: Layers) — map external columns to internal columns
3. Context Rules (icon: Book) — domain selector (schools / hospitals / counties / generic)
4. Output Settings (icon: FileText) — match confidence cutoffs, review queue thresholds

All collapsed by default. Same chevron + badge pattern.
Bottom of panel: cyan "Run Matching" button.

RIGHT WORK AREA:
1. Two upload cards side by side: "Internal Data" and "External Data"
   - Each card: icon, title, drop zone, file size limit, status indicator
   - Once uploaded, card collapses to show filename + row count + a small "Replace" link
2. Below uploads: a Match Preview placeholder card that says "Upload both files to preview matches"
3. Once both files uploaded: replace the placeholder with a 3-column preview showing
   sample matched pairs (External, Internal, Confidence %).

Use the same dark tokens. Same typography. Same spacing scale.
Do not introduce any new color, no purple, no extra accent.

This screen must look like the same product as /normalization — same shell, same density,
same patterns. The only difference is the content of the work area.
```

### Verify before moving on
1. Matching Engine has the same two-column layout as Configure.
2. Same top bar, same step indicator, same density.
3. Two upload cards visible side by side.
4. Same cyan accent, no new colors introduced.

---

## Phase 5 — Offload screen (20 min)

**Goal:** Apply the same shell. Likely the simplest screen.

### Cursor prompt
```
Following .cursorrules and the patterns now established in /normalization and /matching,
refactor /offload to use the same two-column shell.

Left panel: collapsible config sections appropriate to data offload (e.g., Source,
Destination, Schedule, Format). All collapsed by default.

Right panel: the actual offload UI you currently have — but stripped of any marketing
imagery, gradient banners, or stat cards. Use the same surface tokens, same border
treatment, same typography.

Bottom of left panel: cyan "Run Offload" button.

The screen must visually be a sibling of /normalization and /matching. Different
content, identical chrome.
```

---

## Phase 6 — QA pass (30 min)

Open each route in order: `/` → `/offload` → `/normalization` → `/matching`.

Check each item against this list. Anything that fails goes back to Cursor with the rule it broke.

1. Landing has cream background, no app chrome.
2. App routes share identical top bar, step indicator, and side-panel pattern.
3. Active config section is the only one expanded on each app screen.
4. Exactly one cyan primary button is visible per screen.
5. No marketing copy ("10x faster", "lightning fast", "intelligent") anywhere inside the app.
6. No gradient backgrounds inside the app.
7. No purple, green, or red accents — only cyan (active) and amber (warnings).
8. Step indicator shows correct active step on each route.
9. All existing functionality (upload, processing, export) still works.
10. The "Start matching" button on the landing routes correctly into the app.

---

## What "done" looks like

1. You can demo the landing in a meeting and it gets the WOW reaction.
2. You can spend a full work day in the tool without feeling visual fatigue.
3. A new colleague opens the tool and immediately understands: "I'm on step 2 of 4, and I need to configure cleaning rules."
4. Nothing on screen looks like marketing. Nothing inside the tool tries to sell you anything.

---

## If Cursor gets it wrong

Common failure modes and the prompt to fix them:

1. **Cursor adds a gradient or hero image inside an app route.**
   - Prompt: `Remove any gradient backgrounds, hero images, or network imagery from this screen. App routes use solid #0B0D0E background only. See .cursorrules CONTEXT B forbidden list.`

2. **Cursor leaves config sections expanded by default.**
   - Prompt: `All config sections must be collapsed by default. Only the section the user is actively editing should be open. Convert all sections to use a single openSections state object keyed by section id.`

3. **Cursor uses pure white or pure black.**
   - Prompt: `Replace any #FFFFFF with #F4F3EE on the landing or #E8E8E6 in the app. Replace any #000000 with #0A0A0A on the landing or #0B0D0E in the app. See .cursorrules tokens.`

4. **Cursor introduces a second accent color.**
   - Prompt: `The app uses a single accent: cyan #2DD4BF. Replace all other colored icons, badges, and indicators with --text-muted (#8A8F93) for inactive and --accent for active. See .cursorrules CONTEXT B forbidden list.`

5. **Cursor over-animates.**
   - Prompt: `Remove all animations except: section expand/collapse (CSS transition), step indicator state change (CSS transition), and the auto-saved status pulse. No bounce, no spring, no parallax, no scroll-jacking.`
