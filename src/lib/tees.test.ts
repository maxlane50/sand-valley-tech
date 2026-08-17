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

/** The Lido plus a hypothetical back tee, so a split field can be exercised. */
const LIDO_MULTI = (() => {
  const lido = getCourse('lido');
  return { ...lido, tees: [...lido.tees, { name: 'Black', rating: 75.2, slope: 153 }] };
})();
const multiLookup = (id: string) => (id === 'lido' ? LIDO_MULTI : lookup(id));

const ROUND: RoundRecord = { id: 1, date: '2026-08-13', course_id: 'lido', tee_name: 'White' };
const ALICE: PlayerRecord = { id: 1, name: 'Alice', handicap_index: 12.0 };
const BOB: PlayerRecord = { id: 2, name: 'Bob', handicap_index: 12.0 };

const card = (playerId: number, strokes: number): ScoreRecord[] =>
  Array.from({ length: 18 }, (_, i) => ({
    round_id: 1, player_id: playerId, hole: i + 1, strokes,
  }));

describe('resolveTee', () => {
  it('falls back to the round tee when there is no override', () => {
    expect(resolveTee(buildTeeMap([]), ROUND, 1)).toBe('White');
  });

  it('uses the override when there is one', () => {
    const rows: PlayerTeeRecord[] = [{ round_id: 1, player_id: 2, tee_name: 'Black' }];
    const tees = buildTeeMap(rows);
    expect(resolveTee(tees, ROUND, 2)).toBe('Black');
    expect(resolveTee(tees, ROUND, 1)).toBe('White'); // untouched player
  });

  it('does not leak an override across rounds', () => {
    const tees = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Black' }]);
    expect(resolveTee(tees, { id: 2, tee_name: 'White' }, 2)).toBe('White');
  });

  it('reports whether the field has split', () => {
    const none = buildTeeMap([]);
    const split = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Black' }]);
    expect(isMixedTees(none, ROUND, [ALICE, BOB])).toBe(false);
    expect(isMixedTees(split, ROUND, [ALICE, BOB])).toBe(true);
    expect(teesInPlay(split, ROUND, [ALICE, BOB])).toEqual(['White', 'Black']);
  });
});

describe('scoring a split field', () => {
  const tees = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Black' }]);

  it('gives the player off the back tee a bigger playing handicap', () => {
    const grid = buildRoundGrid(ROUND, 1, LIDO_MULTI, [ALICE, BOB], [], tees);
    const [alice, bob] = grid.players;

    expect(alice!.teeName).toBe('White');
    expect(bob!.teeName).toBe('Black');
    // Identical 12.0 index; the tee is the only difference.
    expect(alice!.playingHandicap).toBe(15);
    expect(bob!.playingHandicap).toBe(18);
  });

  it('turns the same gross card into more points off the harder tee', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const grid = buildRoundGrid(ROUND, 1, LIDO_MULTI, [ALICE, BOB], scores, tees);
    const alice = grid.players.find((p) => p.name === 'Alice')!;
    const bob = grid.players.find((p) => p.name === 'Bob')!;

    expect(alice.total.gross).toBe(bob.total.gross); // identical scorecards
    expect(bob.total.points).toBeGreaterThan(alice.total.points); // compensated
  });

  it('flows through to the leaderboard', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const board = buildLeaderboard([ALICE, BOB], [ROUND], scores, multiLookup, tees);
    const alice = board.rows.find((r) => r.name === 'Alice')!;
    const bob = board.rows.find((r) => r.name === 'Bob')!;
    expect(bob.totalPoints).toBeGreaterThan(alice.totalPoints);
  });

  it('scores everyone off the round tee when no overrides exist', () => {
    const scores = [...card(1, 5), ...card(2, 5)];
    const grid = buildRoundGrid(ROUND, 1, LIDO_MULTI, [ALICE, BOB], scores, buildTeeMap([]));
    expect(grid.players[0]!.total.points).toBe(grid.players[1]!.total.points);
    expect(new Set(grid.players.map((p) => p.teeName))).toEqual(new Set(['White']));
  });

  it('isolates a bad override to that player', () => {
    const bad = buildTeeMap([{ round_id: 1, player_id: 2, tee_name: 'Gold' }]);
    const grid = buildRoundGrid(ROUND, 1, LIDO_MULTI, [ALICE, BOB], card(1, 5), bad);
    expect(grid.players[0]!.problem).toBeNull();
    expect(grid.players[1]!.problem).toMatch(/no tee named "Gold"/);
  });
});
