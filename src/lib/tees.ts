/**
 * Per-player tees.
 *
 * A round carries a default tee. Any player on something else gets a row in
 * `player_tees`, so a field where everyone plays the same tee stores nothing
 * extra. Resolution is always "the override, or the round's tee".
 *
 * The scoring engine needs no changes for this: courseHandicap already
 * includes a (rating - par) term, which is exactly the mechanism that lets
 * players off different tees compete on level terms.
 */

import type { PlayerTeeRecord, PlayerRecord, RoundRecord } from './types';

/** Map key for one player in one round. */
export function teeKey(roundId: number, playerId: number): string {
  return `${roundId}:${playerId}`;
}

export type TeeMap = ReadonlyMap<string, string>;

export const NO_TEE_OVERRIDES: TeeMap = new Map();

export function buildTeeMap(rows: readonly PlayerTeeRecord[]): TeeMap {
  return new Map(rows.map((row) => [teeKey(row.round_id, row.player_id), row.tee_name]));
}

/** The tee this player actually played in this round. */
export function resolveTee(
  tees: TeeMap | undefined,
  round: Pick<RoundRecord, 'id' | 'tee_name'>,
  playerId: number,
): string {
  return tees?.get(teeKey(round.id, playerId)) ?? round.tee_name;
}

/**
 * Distinct tees in play for a round, round default first. A single entry means
 * the field is uniform, which is what the UI keys off to stay quiet.
 */
export function teesInPlay(
  tees: TeeMap | undefined,
  round: Pick<RoundRecord, 'id' | 'tee_name'>,
  players: readonly Pick<PlayerRecord, 'id'>[],
): string[] {
  const seen = new Set<string>([round.tee_name]);
  for (const player of players) {
    seen.add(resolveTee(tees, round, player.id));
  }
  return [round.tee_name, ...[...seen].filter((t) => t !== round.tee_name)];
}

/** True when more than one tee is being played in this round. */
export function isMixedTees(
  tees: TeeMap | undefined,
  round: Pick<RoundRecord, 'id' | 'tee_name'>,
  players: readonly Pick<PlayerRecord, 'id'>[],
): boolean {
  return teesInPlay(tees, round, players).length > 1;
}
