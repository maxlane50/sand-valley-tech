import { describe, expect, it } from 'vitest';

import { getCourse } from '../data/courses';
import { buildRoundGrid } from './roundGrid';
import { buildLeaderboard } from './leaderboard';
import { buildTeeMap, isMixedTees, resolveTee, teesInPlay } from './tees';
import type { PlayerRecord, PlayerTeeRecord, RoundRecord, ScoreRecord } from './types';

const lookup = (id: string) => {
  try {
    return getCourse(id);
  } catch {
    return undefined;
  }
};

/** The round goes off Gold; one player is pushed back to Black. */
const ROUND: RoundRecord = {
  id: 1,
  date: '2026-08-13',
  course_id: 'bandon-dunes',
  tee_name: 'Gold',
};
const ALICE: PlayerRecord = {
  id: 1,
  name: 'Alice',
  handicap_index: 12.0,
  rating_set: 'men',
};
const BOB: PlayerRecord = { id: 2, name: 'Bob', handicap_index: 12.0, rating_set: 'men' };

const card = (playerId: number, strokes: number): ScoreRecord[] =>
  Array.from({ length: 18 }, (_, i) => ({
    round_id: 1, player_id: playerId, hole: i + 1, strokes,
  }));

describe('resolveTee', () => {
  it('falls back to the round tee when there is no override', () => {
    expect(resolveTee(buildTeeMap([]), ROUND, 1)).toBe('Gold');
  });

  it('uses the override when there is one', () => {
    const rows: PlayerTeeRecord[] = [{ round_id: 1, player_id: 2, tee_name: 'Black' }];
    const tees = buildTeeMap(rows);
    expect(resolveTee(tees, ROUND, 2)).toBe('Black');
    expect(resolveTee(tees, ROUND, 1)).toBe('Gold'); // untouched player
  });

  it('does not leak an override across rounds', () => {
    const tees = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Black' }]);
    expect(resolveTee(tees, { id: 2, tee_name: 'Gold' }, 2)).toBe('Gold');
  });

  it('reports whether the field has split', () => {
    const none = buildTeeMap([]);
    const split = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Black' }]);
    expect(isMixedTees(none, ROUND, [ALICE, BOB])).toBe(false);
    expect(isMixedTees(split, ROUND, [ALICE, BOB])).toBe(true);
    expect(teesInPlay(split, ROUND, [ALICE, BOB])).toEqual(['Gold', 'Black']);
  });
});

describe('scoring a split field', () => {
  const tees = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Black' }]);
  const BANDON = getCourse('bandon-dunes');

  it('gives the player off the back tee a bigger playing handicap', () => {
    const grid = buildRoundGrid(ROUND, 1, BANDON, [ALICE, BOB], [], tees);
    const [alice, bob] = grid.players;

    expect(alice!.teeName).toBe('Gold');
    expect(bob!.teeName).toBe('Black');
    // Identical 12.0 index; the tee is the only difference.
    // Gold  69.1/124: 12 * (124/113) + (69.1 - 72) = 10.27 -> 10; * .95 -> 10
    // Black 73.5/143: 12 * (143/113) + (73.5 - 72) = 16.69 -> 17; * .95 -> 16
    expect(alice!.playingHandicap).toBe(10);
    expect(bob!.playingHandicap).toBe(16);
  });

  it('turns the same gross card into more points off the harder tee', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const grid = buildRoundGrid(ROUND, 1, BANDON, [ALICE, BOB], scores, tees);
    const alice = grid.players.find((p) => p.name === 'Alice')!;
    const bob = grid.players.find((p) => p.name === 'Bob')!;

    expect(alice.total.gross).toBe(bob.total.gross); // identical scorecards
    expect(bob.total.points).toBeGreaterThan(alice.total.points); // compensated
  });

  it('flows through to the leaderboard', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const board = buildLeaderboard([ALICE, BOB], [ROUND], scores, lookup, tees);
    const alice = board.rows.find((r) => r.name === 'Alice')!;
    const bob = board.rows.find((r) => r.name === 'Bob')!;
    expect(bob.totalPoints).toBeGreaterThan(alice.totalPoints);
  });

  it('scores everyone off the round tee when no overrides exist', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const grid = buildRoundGrid(ROUND, 1, BANDON, [ALICE, BOB], scores, buildTeeMap([]));
    expect(grid.players[0]!.total.points).toBe(grid.players[1]!.total.points);
    expect(new Set(grid.players.map((p) => p.teeName))).toEqual(new Set(['Gold']));
  });

  it('isolates a bad override to that player', () => {
    const bad = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Purple' }]);
    const grid = buildRoundGrid(ROUND, 1, BANDON, [ALICE, BOB], card(1, 5), bad);
    expect(grid.players[0]!.problem).toBeNull();
    expect(grid.players[1]!.problem).toMatch(/no tee named "Purple"/);
  });
});

describe('a split field across the two course ratings', () => {
  const womensBob: PlayerRecord = { ...BOB, rating_set: 'women' };

  it('gives the same index a bigger allowance off the women\'s rating', () => {
    const grid = buildRoundGrid(ROUND, 1, getCourse('bandon-dunes'), [ALICE, womensBob], []);
    const [alice, bob] = grid.players;

    // Both off Gold, both 12.0. Only the rating set differs.
    expect(alice!.teeName).toBe(bob!.teeName);
    expect(alice!.ratingSet).toBe('men');
    expect(bob!.ratingSet).toBe('women');
    expect(bob!.playingHandicap).toBeGreaterThan(alice!.playingHandicap);
  });

  it('carries through to the leaderboard', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const board = buildLeaderboard([ALICE, womensBob], [ROUND], scores, lookup);
    const alice = board.rows.find((r) => r.name === 'Alice')!;
    const bob = board.rows.find((r) => r.name === 'Bob')!;
    expect(bob.totalPoints).toBeGreaterThan(alice.totalPoints);
  });
});
