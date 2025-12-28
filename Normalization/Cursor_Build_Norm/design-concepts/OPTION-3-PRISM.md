# 🌈 Design Option 3: "Prism"
## Light Sophistication with Gradient Accents

---

## Overview
A refined light-mode design inspired by Apple's design language. Clean whites and grays with prismatic gradient accents that catch the eye. Elegant animations, generous whitespace, and a focus on content clarity. The gradients appear as accent highlights rather than dominating the design.

---

## Color Palette

```
┌─────────────────────────────────────────────────────────────┐
│  GRADIENT ACCENTS (Used sparingly for impact)              │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                             │
│  "Sunset"   #FF6B6B → #FF8E53 → #FFCD3C                    │
│  "Ocean"    #667EEA → #64B5F6 → #4DD0E1                    │
│  "Aurora"   #A78BFA → #F472B6 → #FB7185                    │
│  "Forest"   #34D399 → #6EE7B7 → #A7F3D0                    │
│                                                             │
│  PRIMARY (Use "Ocean" as default)                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #667EEA (Indigo)     - Primary buttons/actions            │
│  #5A67D8 (Deep Indigo) - Hover state                       │
│                                                             │
│  BACKGROUNDS                                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #FFFFFF (White)      - Main background                    │
│  #FAFBFC (Snow)       - Subtle sections                    │
│  #F3F4F6 (Light Gray) - Cards/Panels                       │
│  #E5E7EB (Gray)       - Dividers                           │
│                                                             │
│  TEXT                                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #111827 (Near Black) - Headings                           │
│  #374151 (Dark Gray)  - Body text                          │
│  #6B7280 (Gray)       - Secondary text                     │
│  #9CA3AF (Light Gray) - Muted/Placeholders                 │
│                                                             │
│  SEMANTIC                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│  #10B981 (Emerald)    - Success                            │
│  #EF4444 (Red)        - Error                              │
│  #F59E0B (Amber)      - Warning                            │
│  #3B82F6 (Blue)       - Info                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Typography

```
HEADINGS:    SF Pro Display / -apple-system (weight: 600)
BODY:        SF Pro Text / -apple-system (weight: 400)  
MONO:        SF Mono / Menlo (for data)

STYLE: Apple's signature tight letter-spacing on headings

SIZES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hero          32px / 40px line-height, -0.02em tracking
Section       22px / 30px line-height, -0.01em tracking
Card Title    17px / 24px line-height
Body          15px / 24px line-height (generous)
Small         13px / 18px line-height
Caption       11px / 14px line-height, uppercase, 0.05em tracking
```

---

## Layout Blueprint

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│ ┌────────────────────────────────────────────────────────────────────────┐ │
│ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │
│ │░░░ ✧ EntityMatch Pro                                    [⚙] [👤] ░░░░░│ │
│ │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│              ↑ Slim header with subtle gradient tint (64px)                │
│                                                                            │
│ ┌──────────┐ ┌─────────────────────────────────────────────────────────┐  │
│ │          │ │                                                         │  │
│ │   Home   │ │  ╭─────────────────────────────────────────────────╮    │  │
│ │   ────   │ │  │                                                 │    │  │
│ │          │ │  │     HERO UPLOAD CARD                            │    │  │
│ │  Config  │ │  │     Large, centered, with gradient border       │    │  │
│ │   ●      │ │  │                                                 │    │  │
│ │  ────    │ │  │              ┌──────────────┐                   │    │  │
│ │          │ │  │              │   📁 Drop    │                   │    │  │
│ │  Dicts   │ │  │              │    here      │                   │    │  │
│ │          │ │  │              └──────────────┘                   │    │  │
│ │  ────    │ │  │                                                 │    │  │
│ │          │ │  ╰─────────────────────────────────────────────────╯    │  │
│ │  Saved   │ │                                                         │  │
│ │          │ │  ┌───────────┐ ┌───────────┐ ┌───────────┐             │  │
│ │  ════    │ │  │   STAT    │ │   STAT    │ │   STAT    │             │  │
│ │          │ │  │   CARD    │ │   CARD    │ │   CARD    │             │  │
│ │  Stats   │ │  └───────────┘ └───────────┘ └───────────┘             │  │
│ │  ├ Rows  │ │           ↑ Compact stat cards in a row                │  │
│ │  ├ Cols  │ │                                                         │  │
│ │  └ Score │ │                                                         │  │
│ │          │ │                                                         │  │
│ └──────────┘ └─────────────────────────────────────────────────────────┘  │
│    240px                           Fluid                                   │
│  (toggle)                                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Sidebar Design

```
EXPANDED (240px)                        COLLAPSED (0px - hidden)
                                        
┌──────────────────────────┐            
│                          │            Just the toggle button remains:
│  ✧ EntityMatch Pro       │            
│     Data Studio          │            ┌────┐
│                          │            │ ☰  │  ← Hamburger to expand
├──────────────────────────┤            └────┘
│                          │            
│  🏠  Home                │            
│                          │            
│  ⚙️  Configuration    ●  │ ← Active    
│                          │            
│  📚  Dictionaries        │            
│                          │            
│  💾  Saved Configs       │            
│                          │            
├──────────────────────────┤            
│                          │            
│  SESSION STATS           │  ← Small caps label
│                          │            
│  ┌────────────────────┐  │            
│  │  1,234             │  │            
│  │  Total Rows        │  │            
│  └────────────────────┘  │            
│                          │            
│  ┌────────────────────┐  │            
│  │  89%               │  │            
│  │  ████████████░░    │  │  ← Mini progress bar
│  │  Data Quality      │  │            
│  └────────────────────┘  │            
│                          │            
├──────────────────────────┤            
│                          │            
│  Theme  ☀ ━━○━━ ☾       │  ← Slider style toggle
│                          │            
│            [←]           │  ← Collapse button
└──────────────────────────┘            

Animation: Sidebar slides out with spring physics
Overlay: Light gray overlay on main content
```

---

## Component Styles

### Cards
```css
.prism-card {
  background: #FFFFFF;
  border: 1px solid #E5E7EB;
  border-radius: 16px;
  box-shadow: 
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 4px 12px rgba(0, 0, 0, 0.04);
}

.prism-card:hover {
  box-shadow: 
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

/* Gradient border variant */
.prism-card-gradient {
  background: linear-gradient(white, white) padding-box,
              linear-gradient(135deg, #667EEA, #64B5F6, #4DD0E1) border-box;
  border: 2px solid transparent;
}
```

### Buttons
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  PRIMARY:     ┌──────────────────────┐                         │
│               │   Start Processing   │                         │
│               └──────────────────────┘                          │
│               Background: #667EEA                               │
│               Text: White                                       │
│               Border-radius: 12px                               │
│               Hover: #5A67D8 + subtle shadow                   │
│               Press: Scale 0.98                                │
│                                                                 │
│  SECONDARY:   ┌──────────────────────┐                         │
│               │    Export Data       │                         │
│               └──────────────────────┘                          │
│               Background: #F3F4F6                              │
│               Text: #374151                                    │
│               Hover: #E5E7EB                                   │
│                                                                 │
│  OUTLINE:     ┌──────────────────────┐                         │
│               │    View Details      │                         │
│               └──────────────────────┘                          │
│               Border: 1.5px solid #E5E7EB                      │
│               Text: #374151                                    │
│               Hover: Background #F9FAFB, border #667EEA        │
│                                                                 │
│  GRADIENT:    ┌──────────────────────┐                         │
│               │   ✨ Process         │  ← For hero actions    │
│               └──────────────────────┘                          │
│               Background: gradient(135deg, #667EEA, #64B5F6)   │
│               Hover: Subtle shimmer animation                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### File Upload Zone
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ╭ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╮   │
│  ╎                                                         ╎   │
│  ╎          ╭─────────────────────────────╮               ╎   │
│  ╎          │                             │               ╎   │
│  ╎          │     ┌───────────────┐       │               ╎   │
│  ╎          │     │   ↑           │       │               ╎   │
│  ╎          │     │  ───          │       │  ← Animated   ╎   │
│  ╎          │     │  📄           │       │    bounce     ╎   │
│  ╎          │     └───────────────┘       │               ╎   │
│  ╎          │                             │               ╎   │
│  ╎          ╰─────────────────────────────╯               ╎   │
│  ╎                                                         ╎   │
│  ╎            Drag your CSV file here                     ╎   │
│  ╎            or click to browse                          ╎   │
│  ╎                                                         ╎   │
│  ╎      ┌─────────────────────────────────────────┐       ╎   │
│  ╎      │          Select from Computer           │       ╎   │
│  ╎      └─────────────────────────────────────────┘       ╎   │
│  ╎                                                         ╎   │
│  ╰ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╯   │
│                                                                 │
│  NORMAL: Dashed border #E5E7EB, radius 20px                    │
│  DRAG OVER: Gradient border, light tinted background           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Collapsible Sections (Apple-style)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  COLLAPSED:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ⚙️  Cleaning & Normalization                      ＞  │   │
│  │      2 options enabled                                  │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Clean card with subtle shadow                                 │
│  Chevron rotates smoothly                                      │
│                                                                 │
│                                                                 │
│  EXPANDED:                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  ⚙️  Cleaning & Normalization                      ∨   │   │
│  │      2 options enabled                                  │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │                                                 │   │   │
│  │  │  Uppercase Conversion              ○────────    │   │   │
│  │  │  Convert all text to uppercase                  │   │   │
│  │  │                                                 │   │   │
│  │  │  ─────────────────────────────────────────────  │   │   │
│  │  │                                                 │   │   │
│  │  │  Normalization                     ────────●    │   │   │
│  │  │  Clean whitespace and punctuation               │   │   │
│  │  │                                                 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Content area has inset background #FAFBFC                     │
│  Smooth height animation with spring physics                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Slim Header Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║                                                                     ║   │
│  ║  ✧ EntityMatch Pro                                                  ║   │
│  ║     Data Wrangling Studio                   [Profiler] [Batch] [⚡] ║   │
│  ║                                                                     ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│                                                                             │
│  Height: 64px                                                              │
│  Background: White with very subtle gradient tint at bottom               │
│  Border-bottom: 1px solid rgba(0,0,0,0.05)                                │
│  Left: Logo + tagline                                                      │
│  Right: Action buttons (pill-shaped)                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quality Score Widget (Apple-style)

```
         ╭─────────────────────────╮
         │                         │
         │          89             │  ← Large number
         │         ────            │     Gradient text
         │       EXCELLENT         │     (optional)
         │                         │
         │    ┌───────────────┐    │
         │    │███████████░░░│    │  ← Progress bar
         │    └───────────────┘    │
         │                         │
         │   Completeness   92%    │
         │   Validity       87%    │
         │   Uniqueness     88%    │
         │                         │
         ╰─────────────────────────╯

Card has subtle shadow
Numbers use tabular figures
Mini bars next to each metric
```

---

## Animations

### 1. Page Transitions
```
Content fades in with slight upward motion
Duration: 300ms
Easing: ease-out (not spring - more Apple-like)
```

### 2. Card Hover
```
translateY(-2px)
Shadow expands
Duration: 200ms ease-out
```

### 3. Button Press
```
Scale: 0.98
Duration: 100ms
Feels tactile and responsive
```

### 4. Sidebar Toggle
```
Slides in/out with slight bounce
Overlay fades in
Duration: 350ms spring
```

### 5. Toggle Switch
```
Smooth slide with slight overshoot
Color transition
Duration: 200ms
```

### 6. Accordion
```
Height animates smoothly
Content fades in with 100ms delay
Chevron rotates 180°
Duration: 300ms ease-out
```

---

## Stats Cards Row

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │               │  │               │  │               │       │
│  │   📊 1,234    │  │   ✓ 89%      │  │   🔄 234     │       │
│  │   ─────────   │  │   ─────────   │  │   ─────────   │       │
│  │   Total Rows  │  │   Valid Data  │  │   Duplicates │       │
│  │               │  │               │  │               │       │
│  └───────────────┘  └───────────────┘  └───────────────┘       │
│                                                                 │
│  Cards: White with subtle shadow                               │
│  Icon: Gradient colored                                        │
│  Number: Large, semi-bold                                      │
│  Label: Small, gray, uppercase                                 │
│  Hover: Slight lift + shadow expand                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary

**Prism** is about **refined elegance**:
- Clean white backgrounds that feel spacious
- Gradient accents used sparingly for impact
- Apple-level attention to typography
- Generous whitespace and padding
- Smooth, polished animations
- Sidebar that fully collapses for maximum focus
- Cards with subtle shadows and rounded corners

**Best for:** Users who prefer light mode and want a premium, sophisticated feel

