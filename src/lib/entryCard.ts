/**
 * The live state of one card being entered. Pure — no React, no fetch — so the
 * keypad's behaviour and the running totals are testable on their own.
 *
 * Cards are assumed complete: every player holes out on all 18. A hole with no
 * score yet is "not entered", not "picked up"; the entry UI never writes NULL.
 * (The NULL path stays live in the scoring module and the schema as the
 * fallback if someone ever takes an X.)
 */

import {
  HOLES_PER_ROUND,
  assertPlayableCourse,
  holesInPlayOrder,
  netScore,
  playingHandicapForRound,
  stablefordPoints,
  strokesReceivedOnHole,
} from '../scoring/scoring';
import type { Course } from '../scoring/types';

/** Lowest and highest score the keypad will record. */
export const MIN_STROKES = 1;
export const MAX_STROKES = 20;

export interface EntryHole {
  hole: number;
  par: number;
  si: number;
  /** Negative for a plus handicap, where strokes are given back. */
  strokesReceived: number;
  strokes: number | null;
  net: number | null;
  /** null until the hole is entered. */
  points: number | null;
}

export interface EntryCard {
  courseHandicap: number;
  playingHandicap: number;
  holes: EntryHole[];
  /** Holes with a score so far, 0-18. */
  entered: number;
  complete: boolean;
  /**
   * Gross total — null until all 18 are in. This is the figure the leaderboard
   * consumes, where a partial sum would read as a real 18-hole score.
   */
  grossTotal: number | null;
  /**
   * Running gross over the holes entered so far. Entry-screen only: here a
   * partial sum is the point, since it's live feedback while typing a card.
   */
  runningGross: number;
  /** Stableford points for the holes entered so far. */
  points: number;
  /** Par for the holes entered so far, for a vs-par readout. */
  parThru: number;
}

export function buildEntryCard(
  course: Course,
  teeName: string,
  handicapIndex: number,
  strokes: readonly (number | null)[],
): EntryCard {
  const playable = assertPlayableCourse(course);
  const { courseHandicap, playingHandicap } = playingHandicapForRound(
    playable,
    teeName,
    handicapIndex,
  );

  const holes: EntryHole[] = holesInPlayOrder(playable).map((hole) => {
    const gross = strokes[hole.hole - 1] ?? null;
    const strokesReceived = strokesReceivedOnHole(hole.si, playingHandicap);
    const net = netScore(gross, strokesReceived);
    return {
      hole: hole.hole,
      par: hole.par,
      si: hole.si,
      strokesReceived,
      strokes: gross,
      net,
      points: gross === null ? null : stablefordPoints(net, hole.par),
    };
  });

  const entered = holes.filter((h) => h.strokes !== null).length;
  const complete = entered === HOLES_PER_ROUND;
  const runningGross = holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0);

  return {
    courseHandicap,
    playingHandicap,
    holes,
    entered,
    complete,
    runningGross,
    grossTotal: complete ? runningGross : null,
    points: holes.reduce((sum, h) => sum + (h.points ?? 0), 0),
    parThru: holes.reduce((sum, h) => sum + (h.strokes === null ? 0 : h.par), 0),
  };
}

/** An empty 18-hole card. */
export function emptyCard(): (number | null)[] {
  return Array.from({ length: HOLES_PER_ROUND }, () => null);
}

/**
 * Where the keypad should jump after entering a score: the next hole still
 * missing one, wrapping around. Falls back to the next hole in sequence when
 * the card is full, and stays put on the last hole.
 */
export function nextHoleIndex(strokes: readonly (number | null)[], from: number): number {
  for (let step = 1; step <= HOLES_PER_ROUND; step += 1) {
    const candidate = (from + step) % HOLES_PER_ROUND;
    if (strokes[candidate] === null) return candidate;
  }
  return Math.min(from + 1, HOLES_PER_ROUND - 1);
}

/** Clamps a keypad entry into a sane score. */
export function clampStrokes(value: number): number {
  return Math.max(MIN_STROKES, Math.min(MAX_STROKES, value));
}
