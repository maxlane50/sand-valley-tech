/**
 * Net Stableford scoring for the Sand Valley trip.
 *
 * Pure functions only: no UI, no Supabase, no I/O. Everything the leaderboard
 * shows is derived from raw strokes + the course card at read time, so fixing a
 * typo'd score or filling in a course in courses.json is all it takes to make
 * every screen correct.
 */

import type {
  Course,
  Hole,
  HoleResult,
  PlayableCourse,
  RoundResult,
  ScoreRow,
  Strokes,
  Tee,
} from './types';

export const HOLES_PER_ROUND = 18;

/** USGA slope baseline. */
const NEUTRAL_SLOPE = 113;

/** USGA allowance for individual stroke play in a field of this size. */
export const HANDICAP_ALLOWANCE = 0.95;

/**
 * Rounds half away from zero: 2.5 -> 3, -2.5 -> -3.
 *
 * Math.round rounds half toward +Infinity, which is wrong for plus handicaps.
 * The toFixed snap first absorbs binary floating point dust — 3 * 0.95 is
 * 2.8499999999999996, and that must still round to 3, not 2.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot round a non-finite value: ${value}`);
  }
  const snapped = Number(value.toFixed(10));
  return snapped < 0 ? -Math.round(-snapped) : Math.round(snapped);
}

/**
 * Narrows a course to one that can actually be scored, or throws with a message
 * that says exactly what to do about it.
 */
export function assertPlayableCourse(course: Course): PlayableCourse {
  const where = `${course.name} (id "${course.id}")`;

  if (course.par === null || course.par === undefined) {
    throw new Error(
      `${where} has no scorecard data yet (par is null). ` +
        `Fill in par, tees and the 18 holes for it in src/data/courses.json before scoring rounds there.`,
    );
  }

  if (course.holes.length !== HOLES_PER_ROUND) {
    throw new Error(
      `${where} has ${course.holes.length} holes in src/data/courses.json; expected ${HOLES_PER_ROUND}.`,
    );
  }

  const holeNumbers = new Set(course.holes.map((h) => h.hole));
  const strokeIndexes = new Set(course.holes.map((h) => h.si));
  for (let n = 1; n <= HOLES_PER_ROUND; n += 1) {
    if (!holeNumbers.has(n)) {
      throw new Error(`${where} is missing hole ${n} in src/data/courses.json.`);
    }
    if (!strokeIndexes.has(n)) {
      throw new Error(
        `${where} is missing stroke index ${n} in src/data/courses.json; ` +
          `each si from 1 to 18 must be used exactly once.`,
      );
    }
  }

  const parSum = course.holes.reduce((sum, h) => sum + h.par, 0);
  if (parSum !== course.par) {
    throw new Error(
      `${where} lists par ${course.par} but its 18 holes add up to ${parSum}. ` +
        `Fix src/data/courses.json.`,
    );
  }

  if (course.tees.length === 0) {
    throw new Error(`${where} has no tees defined in src/data/courses.json.`);
  }

  return course as PlayableCourse;
}

/** True when a course has enough data to be scored. Never throws. */
export function isPlayableCourse(course: Course): boolean {
  try {
    assertPlayableCourse(course);
    return true;
  } catch {
    return false;
  }
}

/** Looks up a tee by name, case-insensitively. Throws if it isn't on the card. */
export function getTee(course: PlayableCourse, teeName: string): Tee {
  const tee = course.tees.find(
    (t) => t.name.toLowerCase() === teeName.trim().toLowerCase(),
  );
  if (!tee) {
    const available = course.tees.map((t) => t.name).join(', ') || 'none';
    throw new Error(
      `${course.name} has no tee named "${teeName}". Available tees: ${available}.`,
    );
  }
  return tee;
}

/** Holes sorted 1..18. */
export function holesInPlayOrder(course: PlayableCourse): Hole[] {
  return [...course.holes].sort((a, b) => a.hole - b.hole);
}

/**
 * Step 1: courseHandicap = round(HI * (slope / 113) + (rating - par))
 */
export function courseHandicap(
  handicapIndex: number,
  tee: Tee,
  par: number,
): number {
  return roundHalfAwayFromZero(
    handicapIndex * (tee.slope / NEUTRAL_SLOPE) + (tee.rating - par),
  );
}

/**
 * Step 2: playingHandicap = round(courseHandicap * 0.95)
 */
export function playingHandicap(courseHandicapValue: number): number {
  return roundHalfAwayFromZero(courseHandicapValue * HANDICAP_ALLOWANCE);
}

/** Convenience: both steps at once, for one round on one tee. */
export function playingHandicapForRound(
  course: PlayableCourse,
  teeName: string,
  handicapIndex: number,
): { courseHandicap: number; playingHandicap: number } {
  const ch = courseHandicap(handicapIndex, getTee(course, teeName), course.par);
  return { courseHandicap: ch, playingHandicap: playingHandicap(ch) };
}

/**
 * Step 3: strokes received on a hole of the given stroke index.
 *
 * Positive handicap: 1 stroke if si <= playingHandicap, a 2nd if
 * si <= playingHandicap - 18, and so on.
 *
 * Plus handicap: strokes are given back (negative) starting at si 18 and
 * working down, so a plus-2 gives back at si 18 and 17.
 */
export function strokesReceivedOnHole(
  si: number,
  playingHandicapValue: number,
): number {
  if (!Number.isInteger(si) || si < 1 || si > HOLES_PER_ROUND) {
    throw new Error(`Stroke index must be an integer 1-18, got ${si}.`);
  }

  const magnitude = Math.abs(playingHandicapValue);
  const everyHole = Math.floor(magnitude / HOLES_PER_ROUND);
  const remainder = magnitude % HOLES_PER_ROUND;

  // Positive handicaps allocate from si 1 up; plus handicaps from si 18 down.
  const extra =
    playingHandicapValue >= 0
      ? si <= remainder
        ? 1
        : 0
      : si >= HOLES_PER_ROUND + 1 - remainder
        ? 1
        : 0;

  const received = everyHole + extra;
  // `received === 0` guard keeps a plus handicap's untouched holes at +0, not
  // -0, which would otherwise render as "-0" and survive a JSON round trip.
  return playingHandicapValue >= 0 || received === 0 ? received : -received;
}

/** Strokes received on every hole, keyed by hole number. */
export function strokeAllocation(
  course: PlayableCourse,
  playingHandicapValue: number,
): Map<number, number> {
  return new Map(
    holesInPlayOrder(course).map((h) => [
      h.hole,
      strokesReceivedOnHole(h.si, playingHandicapValue),
    ]),
  );
}

/**
 * Step 4: netScore = strokes - strokesReceived. A picked-up hole stays null.
 */
export function netScore(strokes: Strokes, strokesReceived: number): Strokes {
  if (strokes === null) return null;
  return strokes - strokesReceived;
}

/**
 * Step 5: Stableford points against par.
 *
 * net double bogey or worse 0, bogey 1, par 2, birdie 3, eagle 4, albatross 5.
 * A picked-up hole (null) scores 0.
 */
export function stablefordPoints(net: Strokes, par: number): number {
  if (net === null) return 0;
  return Math.max(0, 2 - (net - par));
}

/** Turns Supabase `scores` rows into the dense 18-length array scoreRound wants. */
export function strokesFromRows(rows: readonly ScoreRow[]): Strokes[] {
  const byHole = new Map<number, Strokes>();
  for (const row of rows) {
    if (!Number.isInteger(row.hole) || row.hole < 1 || row.hole > HOLES_PER_ROUND) {
      throw new Error(`Score row has hole ${row.hole}; expected an integer 1-18.`);
    }
    byHole.set(row.hole, row.strokes ?? null);
  }
  return Array.from({ length: HOLES_PER_ROUND }, (_, i) => byHole.get(i + 1) ?? null);
}

/**
 * Scores one player's round. `strokes` is indexed by hole - 1; null entries are
 * holes the player picked up on.
 *
 * Step 6: the playing handicap is derived here, from this course and tee, so it
 * is never shared across rounds.
 */
export function scoreRound(
  course: Course,
  teeName: string,
  handicapIndex: number,
  strokes: readonly Strokes[],
): RoundResult {
  const playable = assertPlayableCourse(course);

  if (strokes.length !== HOLES_PER_ROUND) {
    throw new Error(
      `Expected ${HOLES_PER_ROUND} hole scores for ${playable.name}, got ${strokes.length}.`,
    );
  }

  const tee = getTee(playable, teeName);
  const ch = courseHandicap(handicapIndex, tee, playable.par);
  const ph = playingHandicap(ch);

  const holes: HoleResult[] = holesInPlayOrder(playable).map((hole) => {
    const gross = strokes[hole.hole - 1] ?? null;
    if (gross !== null && (!Number.isInteger(gross) || gross < 1)) {
      throw new Error(
        `Hole ${hole.hole} has strokes ${gross}; expected a positive integer or null for a pick-up.`,
      );
    }
    const strokesReceived = strokesReceivedOnHole(hole.si, ph);
    const net = netScore(gross, strokesReceived);
    return {
      hole: hole.hole,
      par: hole.par,
      si: hole.si,
      strokes: gross,
      strokesReceived,
      net,
      points: stablefordPoints(net, hole.par),
    };
  });

  return {
    courseId: playable.id,
    courseName: playable.name,
    teeName: tee.name,
    handicapIndex,
    courseHandicap: ch,
    playingHandicap: ph,
    holes,
    grossTotal: holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0),
    holesPickedUp: holes.filter((h) => h.strokes === null).length,
    points: holes.reduce((sum, h) => sum + h.points, 0),
  };
}

/**
 * Cumulative points across a player's rounds, for the leaderboard.
 * Rounds not yet played are simply absent from the array.
 */
export function totalPoints(rounds: readonly RoundResult[]): number {
  return rounds.reduce((sum, r) => sum + r.points, 0);
}
