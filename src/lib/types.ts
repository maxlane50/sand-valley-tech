/** Row shapes as they come back from Supabase, matching supabase/schema.sql. */

export interface PlayerRecord {
  id: number;
  name: string;
  handicap_index: number;
}

export interface RoundRecord {
  id: number;
  /** ISO date, e.g. '2026-08-13'. */
  date: string;
  /** Matches an `id` in src/data/courses.json. */
  course_id: string;
  /** Matches a tee `name` on that course. */
  tee_name: string;
}

export interface ScoreRecord {
  round_id: number;
  player_id: number;
  hole: number;
  /** NULL means the player picked up. */
  strokes: number | null;
}

/** Overrides the round's tee for one player. Absent means the round default. */
export interface PlayerTeeRecord {
  round_id: number;
  player_id: number;
  tee_name: string;
}

export interface TripData {
  players: PlayerRecord[];
  rounds: RoundRecord[];
  scores: ScoreRecord[];
  playerTees: PlayerTeeRecord[];
}
