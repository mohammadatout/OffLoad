# Editorial Minimalist Design System
**Reference:** v0-optimus-delta.vercel.app
**Use:** Drop the first section into `.cursorrules` at your project root. Use the second section as your v0.dev starter prompt.

---

## PART 1 — `.cursorrules` (paste into project root)

You are building a frontend in the style of editorial Swiss minimalism with a single generative-art accent. Reference: Optimus / Vercel / Linear / Geist. Treat the rules below as non-negotiable design tokens. Do not introduce alternatives "for variety."

### COLOR — only these values exist
- `--bg`: `#F4F3EE` (warm cream, the only background)
- `--fg`: `#0A0A0A` (near-black, the only ink)
- `--muted`: `#6B6B66` (warm gray, secondary text only)
- `--border`: `#E5E3DC` (cream-tinted gray, 1px borders only)
- No blues, greens, gradients, glows, or accent colors. The contrast IS the design.

### TYPOGRAPHY — strict scale, no improvisation
- Display + Body font: `Geist` or `Inter Display` (sans-serif grotesk)
- Mono font: `Geist Mono` or `JetBrains Mono` (labels, code, metadata)
- Hero: `clamp(4rem, 10vw, 9rem)`, weight 500, line-height 0.95, letter-spacing -0.04em
- Section heading: `clamp(2rem, 4vw, 3.5rem)`, weight 500, line-height 1.05
- Body: `1rem` to `1.125rem`, weight 400, line-height 1.6
- Labels/metadata: `0.75rem`, UPPERCASE, letter-spacing 0.1em, mono family

### SPACING — strict 8px scale
- Allowed values only: 4, 8, 16, 24, 32, 48, 64, 96, 128, 192 px
- Section vertical padding: 96px mobile, 192px desktop
- Whitespace is content. Do not fill it.

### LAYOUT
- Max content width: 1280px
- Background grid: 1px lines at 8% opacity, 80×80px cells, full-bleed
- Hero is asymmetric: text left ~55%, visual right ~45%
- Body sections are left-aligned, not centered

### SIGNATURE ELEMENTS — these ARE the look
1. Em-dash eyebrow labels: `— Capabilities`, `— Process`, `— Pricing`
2. Numbered section markers in mono: `01`, `02`, `03` (or `I`, `II`, `III`)
3. UPPERCASE small caps for brand names and metadata in stat blocks
4. Pill buttons (`rounded-full`):
   - Primary: solid `--fg` background, white text, includes a `→` arrow icon
   - Secondary: `--bg` background, 1px `--fg` border, same pill shape
5. Animated hand-drawn underline beneath ONE key word in the hero headline
6. Stat row at bottom of hero: huge number → small mono description → SMALL CAPS brand

### COMPONENTS
- Base library: shadcn/ui, restyled to the tokens above
- Buttons: always `rounded-full`
- Cards: 1px `--border`, no shadow, no rounded corners larger than 8px
- Inputs: 1px bottom border only, no other borders
- No box-shadows. Ever. The grid + typography carry depth.

### ANIMATION
- Framer Motion: component transitions only
- GSAP or canvas-2d: hero generative visual
- Section reveal: 20px upward fade, 0.6s, ease-out, stagger 0.1s
- One animation per section maximum
- Forbidden: bounce, spring overshoot, parallax scroll, scroll-jacking

### STACK
- Next.js 14+ App Router
- Tailwind, config locked to the tokens above (override defaults)
- shadcn/ui
- Framer Motion
- next/font for Geist
- Three.js OR canvas-2d for the hero visual

### VOICE
- Declarative, short, confident
- Hero headline: 4–6 words
- Subhead: 1–2 sentences, period
- Section titles read like statements: "Three steps. Infinite possibilities."
- Banned words: amazing, powerful, revolutionary, seamless, robust, leverage

### FORBIDDEN
- Gradients, drop shadows, glow effects
- Stock photography, illustrated mascots, emojis as design elements
- Centered body copy in hero
- Multiple accent colors
- "Variety" deviations from the type scale
- Pure white (`#FFFFFF`) anywhere — always cream
- Pure black (`#000000`) anywhere — always near-black

---

## PART 2 — v0.dev starter prompt

Copy this into v0.dev to scaffold the hero. Iterate from there.

```
Build a landing page hero in editorial Swiss minimalist style.

BACKGROUND
- Warm cream #F4F3EE
- Faint background grid: 1px lines at 8% opacity, 80px × 80px cells, full bleed

LAYOUT
- Asymmetric two-column: left ~55% (text), right ~45% (generative visual)
- Max width 1280px, generous vertical padding (192px desktop)

TYPOGRAPHY
- Geist or Inter Display
- Eyebrow label above headline: thin em-dash, then uppercase mono text — "— THE PLATFORM FOR MODERN TEAMS"
- Headline: two lines, clamp(4rem, 10vw, 9rem), weight 500, line-height 0.95, letter-spacing -0.04em
- One key word in headline gets a hand-drawn animated underline that draws in over 0.8s on load
- Subhead: 2 sentences, color #6B6B66, max-width 480px

BUTTONS
- Two pill buttons (rounded-full)
- Primary: solid black #0A0A0A, white text, → arrow icon
- Secondary: cream background, 1px black border, no fill

STAT ROW (below hero)
- Horizontal row of 4 stats
- Format: huge number ("300%") → small description below ("throughput increase") → UPPERCASE SMALL CAPS brand name ("LINEAR")

RIGHT SIDE VISUAL
- Particle-based dot-matrix sphere
- Slowly rotates on its own axis
- Pure black dots on cream background
- Dots concentrated at the sphere's edge, sparse interior
- Built with canvas-2d, ~2000 particles

CONSTRAINTS
- No colors except black, cream, and warm gray
- No gradients, no shadows, no rounded corners on anything except the pill buttons
- No emojis, no stock photos
```

---

## PART 3 — How to use this

1. Drop Part 1 into `.cursorrules` at your project root.
2. Generate the hero in v0.dev with Part 2.
3. Pull the v0 output into Cursor — Claude will now respect Part 1's tokens automatically.
4. Iterate at least 5 times before deciding the result is "done." First-pass output of any AI tool is mediocre.
5. The ASCII/dot-matrix sphere is the hardest piece to clone — search GitHub for "particle sphere canvas" or "ascii sphere three.js" and pull a starter, then theme it to your tokens.
