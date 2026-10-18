/**
 * Domain types for the scoring engine.
 *
 * These mirror src/data/courses.json and the Supabase tables. Nothing here
 * knows about React, Supabase, or the DOM — the scoring module is pure.
 */

/**
 * Which of the two course ratings printed on the card a player is scored
 * against. Every set of tees is rated twice, and the two are not close: off
 * the black tees at Bandon Trails the course rating is 74.9 for men and 80.3
 * for women. Using the wrong one is worth several strokes of handicap, so it
 * is carried on the player and never defaulted at the point of use.
 *
 * This names a column on the scorecard, not a person.
 */
export type RatingSet = 'men' | 'women';

export const RATING_SETS: readonly RatingSet[] = ['men', 'women'];

export function isRatingSet(value: unknown): value is RatingSet {
  return value === 'men' || value === 'women';
}

/** One rating of one set of tees: the pair the course handicap formula needs. */
export interface TeeRating {
  /** Course rating from the scorecard, e.g. 74.9 */
  rating: number;
  /** Slope rating from the scorecard, e.g. 136 */
  slope: number;
}

export interface Tee {
  name: string;
  /** Rated twice. Both are printed on the card, men's above women's. */
  men: TeeRating;
  women: TeeRating;
  /** 18 yardages, hole 1 first. The card's OUT / IN / TOTAL are their sums. */
  yards: number[];
  /**
   * This tee's own stroke index, when the card prints a second handicap row
   * for it. 18 entries, hole 1 first; absent means the holes' own stroke index
   * applies.
   *
   * All three Bandon cards print one under the Orange tees, and it is not the
   * same allocation: at Bandon Dunes the 5th is stroke 1 off the back four
   * tees and stroke 7 off Orange. Scoring a card off the wrong row moves which
   * holes a player gets a shot on.
   */
  si?: number[];
}

export interface Hole {
  /** 1..18 */
  hole: number;
  par: number;
  /** Stroke index, 1..18, 1 being the hardest hole. Overridable per tee. */
  si: number;
}

/**
 * A course as it appears in courses.json. `par: null` with empty tees/holes
 * marks a stub that has not been filled in yet.
 */
export interface Course {
  id: string;
  name: string;
  par: number | null;
  tees: Tee[];
  holes: Hole[];
}

/** A course that has passed validation and is safe to score against. */
export interface PlayableCourse extends Course {
  par: number;
}

/** Strokes taken on a hole. `null` means the player picked up. */
export type Strokes = number | null;

/** A row shaped like the Supabase `scores` table. */
export interface ScoreRow {
  hole: number;
  strokes: Strokes;
}

export interface HoleResult {
  hole: number;
  par: number;
  /** The stroke index actually used, which is the tee's when it has its own. */
  si: number;
  /** Gross strokes, or null if picked up. */
  strokes: Strokes;
  /** Strokes received on this hole. Negative for a plus handicap. */
  strokesReceived: number;
  /** strokes - strokesReceived, or null if picked up. */
  net: Strokes;
  points: number;
}

export interface RoundResult {
  courseId: string;
  courseName: string;
  teeName: string;
  /** Which of the tee's two ratings this card was scored against. */
  ratingSet: RatingSet;
  handicapIndex: number;
  courseHandicap: number;
  playingHandicap: number;
  holes: HoleResult[];
  /** Sum of gross strokes over holes that were completed. */
  grossTotal: number;
  /** Number of holes picked up (strokes === null). */
  holesPickedUp: number;
  /** Sum of Stableford points over all 18 holes. */
  points: number;
}
