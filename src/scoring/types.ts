/**
 * Domain types for the scoring engine.
 *
 * These mirror src/data/courses.json and the Supabase tables. Nothing here
 * knows about React, Supabase, or the DOM — the scoring module is pure.
 */

export interface Tee {
  name: string;
  /** Course rating from the scorecard, e.g. 72.5 */
  rating: number;
  /** Slope rating from the scorecard, e.g. 144 */
  slope: number;
  yards?: number;
}

export interface Hole {
  /** 1..18 */
  hole: number;
  par: number;
  /** Stroke index, 1..18, 1 being the hardest hole */
  si: number;
  yards?: number;
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
