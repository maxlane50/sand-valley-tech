/**
 * Presentation rules for the stats screen, lifted from design.html so the
 * thresholds live in one place rather than being scattered through JSX.
 */

/** Strokes vs par at or below this reads as good scoring. */
export const AVG_GOOD = 0.35;
/** Strokes vs par at or above this reads as bad scoring. */
export const AVG_BAD = 1.3;
/** Net Stableford points per hole at or above this tints the cell green. */
export const PPH_GOOD = 2.05;
/** Points per hole at or below this tints the cell red. */
export const PPH_BAD = 1.35;

/** +1.2 / -0.4 / 0.0 — always signed, one decimal. */
export function signed(value: number, decimals = 1): string {
  const fixed = value.toFixed(decimals);
  return value >= 0 && !fixed.startsWith('-') ? `+${fixed}` : fixed;
}

export function averageClass(average: number | null): string {
  if (average === null) return 'text-ink-25';
  if (average <= AVG_GOOD) return 'text-turf';
  if (average >= AVG_BAD) return 'text-flag';
  return 'text-ink';
}

export function pointsTint(pointsPerHole: number | null): string {
  if (pointsPerHole === null) return '';
  if (pointsPerHole >= PPH_GOOD) return 'bg-tint-good';
  if (pointsPerHole <= PPH_BAD) return 'bg-tint-bad';
  return '';
}

/** Section letter + title, shared by every block. */
export const SECTION_LETTER = 'font-num text-micro text-flag';
