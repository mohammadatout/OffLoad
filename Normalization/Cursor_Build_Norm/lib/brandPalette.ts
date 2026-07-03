/** Illumine / workspace analytics palette */
export const BRAND_PALETTE = {
  darkBlue: '#080D44',
  green: '#74bf4b',
  red: '#e3241b',
  darkGray: '#414344',
  lightGray: '#e2e2e2',
} as const;

/** Semantic quality ramp: good → caution → serious → critical (do not use neutral/brand blues for “poor”) */
const SCORE_FAIR_AMBER = '#f59e0b';
const SCORE_POOR_ORANGE = '#f97316';

/** Quality / score coloring from fixed thresholds */
export function scoreToColor(score: number): string {
  if (score >= 80) return BRAND_PALETTE.green;
  if (score >= 60) return SCORE_FAIR_AMBER;
  if (score >= 40) return SCORE_POOR_ORANGE;
  return BRAND_PALETTE.red;
}

/** Bar / series colors (column-type distribution and legacy categorical use) */
export const CHART_CATEGORY_FILLS: string[] = [
  BRAND_PALETTE.darkBlue,
  BRAND_PALETTE.green,
  BRAND_PALETTE.darkGray,
  '#0f1a6e',
  '#8fd46e',
  '#5a5c5d',
  BRAND_PALETTE.red,
  '#a3d989',
];

/** Top Values horizontal bar chart: pick one ramp (avoids multicolor bars). */
export type SpotlightBarPaletteMode = 'blue' | 'brown';

/** Set to `'brown'` for earth-tone bars; default is Illumine blue shades from #080D44 → lighter. */
export const SPOTLIGHT_BAR_PALETTE: SpotlightBarPaletteMode = 'blue';

const SPOTLIGHT_FILLS_BLUE: string[] = [
  '#080D44',
  '#121a72',
  '#1e2a8c',
  '#2d3ca3',
  '#3f50b5',
  '#5a68c4',
  '#7a87d4',
  '#9ea8e3',
];

const SPOTLIGHT_FILLS_BROWN: string[] = [
  '#3d2f26',
  '#4a382e',
  '#5c4336',
  '#6f4f3f',
  '#8a6249',
  '#a67a5a',
  '#c19472',
  '#d9b896',
];

export function getSpotlightBarFills(): string[] {
  return SPOTLIGHT_BAR_PALETTE === 'brown' ? SPOTLIGHT_FILLS_BROWN : SPOTLIGHT_FILLS_BLUE;
}
