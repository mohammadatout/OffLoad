# ⬛ Design Option 2: "Obsidian"
## Dark Precision with Electric Accents

---

## Overview
A sharp, precise design inspired by professional developer tools. Deep blacks with electric accent colors. Every element has purpose. Micro-interactions provide constant feedback. Think VS Code meets Stripe Dashboard.

---

## Color Palette

```
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY ACCENT                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #00E5FF (Electric Cyan) - Primary actions/focus           │
│  #00B8D4 (Deep Cyan)     - Hover states                    │
│                                                             │
│  SECONDARY ACCENT                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #7C4DFF (Electric Purple) - Secondary actions             │
│  #651FFF (Deep Purple)     - Highlights                    │
│                                                             │
│  BACKGROUNDS (Layered)                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #000000 (True Black)   - Base background                  │
│  #0A0A0A (Near Black)   - Elevated layer 1                 │
│  #121212 (Charcoal)     - Elevated layer 2                 │
│  #1A1A1A (Dark Gray)    - Cards/Panels                     │
│  #242424 (Light Gray)   - Hover states                     │
│                                                             │
│  SEMANTIC                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #00E676 (Neon Green)   - Success                          │
│  #FF5252 (Neon Red)     - Error                            │
│  #FFD740 (Neon Yellow)  - Warning                          │
│  #448AFF (Neon Blue)    - Info                             │
│                                                             │
│  TEXT                                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #FFFFFF (White)        - Headings, important              │
│  #B0B0B0 (Light Gray)   - Body text                        │
│  #666666 (Mid Gray)     - Secondary text                   │
│  #404040 (Dark Gray)    - Disabled/Muted                   │
│                                                             │
│  BORDERS                                                    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #2A2A2A (Subtle)       - Default borders                  │
│  #3A3A3A (Visible)      - Hover/Focus borders              │
│  #00E5FF (Electric)     - Active/Selected                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Typography

```
HEADINGS:    Geist / Inter (weight: 500-600)
BODY:        Geist / Inter (weight: 400)  
MONO:        Geist Mono / JetBrains Mono (for data/code)
NUMBERS:     Tabular figures enabled for aligned data

SIZES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hero          36px / 44px line-height (tight)
Section       20px / 28px line-height
Card Title    16px / 22px line-height
Body          14px / 20px line-height
Small         12px / 16px line-height
Micro         10px / 14px line-height (labels)
```

---

## Layout Blueprint

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ ┌───────────────────────────────────────────────────────────────────────┐  │
│ │  ✧ EntityMatch Pro            │ ▼ Columns │ ⊞ Batch │ ⚡ Process      │  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│                          ↑ Top bar (56px) - Minimal header                 │
│                                                                            │
│ ┌──────┐ ┌──────────────────────────────────────────────────────────────┐ │
│ │      │ │                                                              │ │
│ │  ☰   │ │  ┌────────────────────────────────────────────────────────┐  │ │
│ │      │ │  │                                                        │  │ │
│ │ ──── │ │  │              MAIN CONTENT AREA                         │  │ │
│ │      │ │  │                                                        │  │ │
│ │  🏠  │ │  │   Cards have sharp 4px corners                        │  │ │
│ │      │ │  │   Thin 1px borders                                    │  │ │
│ │  ⚙️  │ │  │   No shadows, just layered backgrounds                │  │ │
│ │   ●  │ │  │                                                        │  │ │
│ │  📚  │ │  │                                                        │  │ │
│ │      │ │  └────────────────────────────────────────────────────────┘  │ │
│ │  💾  │ │                                                              │ │
│ │      │ │  ┌──────────────────────┐  ┌──────────────────────────────┐ │ │
│ │ ──── │ │  │                      │  │                              │ │ │
│ │      │ │  │   STATS PANEL        │  │   SECONDARY PANEL            │ │ │
│ │ 1.2K │ │  │                      │  │                              │ │ │
│ │ rows │ │  │   Compact, data-     │  │                              │ │ │
│ │      │ │  │   dense widgets      │  │                              │ │ │
│ │ ──── │ │  │                      │  │                              │ │ │
│ │      │ │  └──────────────────────┘  └──────────────────────────────┘ │ │
│ │  ☀   │ │                                                              │ │
│ └──────┘ └──────────────────────────────────────────────────────────────┘ │
│   48px                              Fluid width                            │
│  (rail)                                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Sidebar: Icon Rail Design

```
ALWAYS VISIBLE (48px rail)              ON HOVER (280px panel slides out)
                                        
┌────────┐                              ┌────────┬─────────────────────────┐
│        │                              │        │                         │
│   ✧    │  ← Logo                      │   ✧    │  EntityMatch Pro        │
│        │                              │        │                         │
│  ════  │                              │  ════  │─────────────────────────│
│        │                              │        │                         │
│   🏠   │  ← Icon only                 │   🏠   │  Dashboard              │
│        │     Tooltip on hover         │        │                         │
│   ⚙️   │                              │   ⚙️   │  Configuration    ●────│← Active
│   ●    │  ← Active indicator          │        │                         │
│   📚   │    (cyan dot)                │   📚   │  Dictionaries           │
│        │                              │        │                         │
│   💾   │                              │   💾   │  Saved Configs          │
│        │                              │        │                         │
│  ════  │                              │  ════  │─────────────────────────│
│        │                              │        │                         │
│  1.2K  │  ← Live stat                 │  1.2K  │  Total Rows             │
│   ↓    │    (small, muted)            │   ↓    │  ↓12% from last         │
│        │                              │        │                         │
│   89   │  ← Quality score             │   89   │  Quality Score          │
│   %    │                              │   %    │  Excellent              │
│        │                              │        │                         │
│  ════  │                              │  ════  │─────────────────────────│
│        │                              │        │                         │
│   ☀    │  ← Theme toggle              │   ☀    │  Light Mode        [○]  │
│        │                              │        │                         │
└────────┘                              └────────┴─────────────────────────┘

The panel slides out from the rail on hover.
It slides back when mouse leaves.
Smooth 200ms ease-out animation.
```

---

## Component Styles

### Cards
```css
.obsidian-card {
  background: #1A1A1A;
  border: 1px solid #2A2A2A;
  border-radius: 4px;
  /* No shadows - pure flat design */
}

.obsidian-card:hover {
  border-color: #3A3A3A;
  background: #1E1E1E;
}

.obsidian-card:focus-within {
  border-color: #00E5FF;
  box-shadow: 0 0 0 1px #00E5FF;
}
```

### Buttons
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  PRIMARY:     ┌──────────────────────┐                         │
│               │ ⚡ Start Processing  │  ← Solid cyan           │
│               └──────────────────────┘                          │
│               Background: #00E5FF                               │
│               Text: #000000                                     │
│               Hover: Slight glow, darken to #00B8D4            │
│               Active: Scale 0.98                                │
│                                                                 │
│  SECONDARY:   ┌──────────────────────┐                         │
│               │    Export Data       │  ← Outline style        │
│               └──────────────────────┘                          │
│               Border: 1px solid #00E5FF                        │
│               Text: #00E5FF                                    │
│               Hover: Background rgba(0, 229, 255, 0.1)         │
│                                                                 │
│  GHOST:       ┌──────────────────────┐                         │
│               │    Cancel            │  ← Minimal              │
│               └──────────────────────┘                          │
│               Text: #B0B0B0                                    │
│               Hover: Text #FFFFFF, bg #242424                  │
│                                                                 │
│  ICON:        [ ⚙ ]  ← 32x32 icon button                       │
│               Border: 1px solid #2A2A2A                        │
│               Hover: Border #00E5FF                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Collapsible Sections
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  COLLAPSED:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▶  Cleaning & Normalization                       [2]  │   │
│  └─────────────────────────────────────────────────────────┘   │
│      ↑                                                    ↑     │
│    Icon                                              Badge     │
│    rotates                                         (options   │
│                                                    enabled)    │
│                                                                 │
│  EXPANDED:                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ▼  Cleaning & Normalization                       [2]  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │    Uppercase Conversion                           [○]   │   │
│  │    Convert text to uppercase                            │   │
│  │                                                         │   │
│  │  ─────────────────────────────────────────────────────  │   │
│  │                                                         │   │
│  │    Normalization                                  [●]   │   │
│  │    Remove punctuation, clean whitespace                 │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Toggle Switch
```
OFF:  ┌──────────────┐
      │  ○───────    │  Gray track, white circle
      └──────────────┘

ON:   ┌──────────────┐
      │  ───────●    │  Cyan track, white circle
      └──────────────┘

Transition: 150ms ease-out
Circle has subtle shadow
```

---

## File Upload Zone

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │   │
│  │ ┊                                                      ┊ │   │
│  │ ┊              ╭──────────────────╮                    ┊ │   │
│  │ ┊              │      📄          │                    ┊ │   │
│  │ ┊              │   ┌──────────┐   │                    ┊ │   │
│  │ ┊              │   │  .CSV    │   │                    ┊ │   │
│  │ ┊              │   └──────────┘   │                    ┊ │   │
│  │ ┊              ╰──────────────────╯                    ┊ │   │
│  │ ┊                                                      ┊ │   │
│  │ ┊         Drop CSV file here or browse                 ┊ │   │
│  │ ┊                                                      ┊ │   │
│  │ ┊           ┌───────────────────────┐                  ┊ │   │
│  │ ┊           │    Select File        │                  ┊ │   │
│  │ ┊           └───────────────────────┘                  ┊ │   │
│  │ ┊                                                      ┊ │   │
│  │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Border: 1px dashed #2A2A2A (default)                          │
│  Border: 1px dashed #00E5FF (on drag)                          │
│  Background: transparent → rgba(0, 229, 255, 0.05) on drag     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Animations (Micro-interactions)

### 1. Ripple Effect on Click
```
Every clickable element has a subtle ripple
Color: rgba(0, 229, 255, 0.3)
Duration: 400ms
```

### 2. Focus Glow
```
Inputs and buttons get a cyan glow on focus
box-shadow: 0 0 0 2px rgba(0, 229, 255, 0.3)
Duration: 150ms
```

### 3. State Transitions
```
All color/background changes: 150ms ease-out
Transform changes: 200ms ease-out
Height changes (accordion): 250ms ease-out
```

### 4. Loading States
```
Skeleton: Gradient shimmer left-to-right
Spinner: Simple rotating ring (cyan)
Progress: Smooth width transition + pulse glow at edge
```

### 5. Number Counters
```
When numbers change, they flip/roll like a slot machine
Spring physics for natural feel
```

---

## Data Table Design

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Company Name    │ City      │ State │ Phone     │ ✓   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Acme Corp       │ Seattle   │ WA    │ 555-1234  │ ✓   │   │
│  │  Beta Inc        │ Portland  │ OR    │ 555-5678  │ ✗   │   │
│  │  Gamma LLC       │ Austin    │ TX    │ 555-9012  │ ✓   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Header: #121212 background, uppercase, 11px, letter-spacing   │
│  Rows: Alternating #0A0A0A and #0F0F0F (very subtle)          │
│  Hover: Row background #1A1A1A                                 │
│  Borders: Only horizontal, #1A1A1A                             │
│  Valid: Green checkmark                                        │
│  Invalid: Red X                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Progress Bar

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Processing · Cleaning                         67% · ~12s      │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │████████████████████████████████████░░░░░░░░░░░░░░░░░░░░│  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   Track: #1A1A1A                                               │
│   Fill: Gradient #00E5FF → #7C4DFF                            │
│   Edge: Glowing pulse animation                                │
│   Height: 6px, rounded                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

**Obsidian** is about **precision and efficiency**:
- True black backgrounds for OLED screens
- Electric cyan as the signature accent
- Sharp corners (4px radius max)
- No shadows, just layered backgrounds
- Fast, snappy micro-interactions
- Icon rail sidebar for maximum workspace
- Data-dense but not cluttered

**Best for:** Power users who want efficiency and a professional developer-tool feel

