import { getSupabase } from './supabase';
import type {
  PlayerRecord,
  PlayerTeeRecord,
  RoundRecord,
  ScoreRecord,
  TripData,
} from './types';

/**
 * Pulls the whole trip in a handful of reads. At 7 players x 4 rounds x 18
 * holes the scores table tops out at 504 rows, so there is nothing to paginate
 * or aggregate server-side — everything is computed in the browser.
 */
export async function fetchTrip(): Promise<TripData> {
  const supabase = getSupabase();

  const [players, rounds, scores, playerTees] = await Promise.all([
    supabase.from('players').select('id, name, handicap_index').order('name'),
    supabase.from('rounds').select('id, date, course_id, tee_name').order('date').order('id'),
    supabase.from('scores').select('round_id, player_id, hole, strokes'),
    supabase.from('player_tees').select('round_id, player_id, tee_name'),
  ]);

  for (const [table, result] of [
    ['players', players],
    ['rounds', rounds],
    ['scores', scores],
  ] as const) {
    if (result.error) {
      throw new Error(`Could not read ${table} from Supabase: ${result.error.message}`);
    }
  }

  // player_tees is deliberately not fatal. If the migration in
  // supabase/schema.sql hasn't been run yet the table is missing, and the whole
  // board going dark over an optional feature would be a bad trade — every
  // player just falls back to their round's tee.
  if (playerTees.error) {
    console.warn(
      `player_tees unavailable, falling back to each round's tee: ${playerTees.error.message}`,
    );
  }

  return {
    players: (players.data ?? []) as PlayerRecord[],
    rounds: (rounds.data ?? []) as RoundRecord[],
    scores: (scores.data ?? []) as ScoreRecord[],
    playerTees: (playerTees.error ? [] : (playerTees.data ?? [])) as PlayerTeeRecord[],
  };
}
