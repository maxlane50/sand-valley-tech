import { getSupabase } from './supabase';
import type { PlayerRecord, RoundRecord, ScoreRecord, TripData } from './types';

/**
 * Pulls the whole trip in three reads. At 7 players x 4 rounds x 18 holes the
 * scores table tops out at 504 rows, so there is nothing to paginate or
 * aggregate server-side — everything is computed in the browser.
 */
export async function fetchTrip(): Promise<TripData> {
  const supabase = getSupabase();

  const [players, rounds, scores] = await Promise.all([
    supabase.from('players').select('id, name, handicap_index').order('name'),
    supabase.from('rounds').select('id, date, course_id, tee_name').order('date').order('id'),
    supabase.from('scores').select('round_id, player_id, hole, strokes'),
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

  return {
    players: (players.data ?? []) as PlayerRecord[],
    rounds: (rounds.data ?? []) as RoundRecord[],
    scores: (scores.data ?? []) as ScoreRecord[],
  };
}
