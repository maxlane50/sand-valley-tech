/**
 * Tests for the raw-rows -> leaderboard transform. The scoring maths itself is
 * covered in src/scoring/scoring.test.ts; what matters here is ranking, ties,
 * movement, and refusing to fall over on a course that isn't filled in.
 */

import { describe, expect, it } from 'vitest';

import { getCourse } from '../data/courses';
import { buildLeaderboard } from './leaderboard';
import type { PlayerRecord, RoundRecord, ScoreRecord } from './types';

const lookup = (id: string) => {
  try {
    return getCourse(id);
  } catch {
    return undefined;
  }
};

const LIDO_ROUND: RoundRecord = {
  id: 1,
  date: '2026-08-13',
  course_id: 'lido',
  tee_name: 'White',
};

/** Every hole the same score, for a predictable card. */
function flatCard(roundId: number, playerId: number, strokes: number | null): ScoreRecord[] {
  return Array.from({ length: 18 }, (_, i) => ({
    round_id: roundId,
    player_id: playerId,
    hole: i + 1,
    strokes,
  }));
}

const PLAYERS: PlayerRecord[] = [
  { id: 1, name: 'Alice', handicap_index: 2.0 },
  { id: 2, name: 'Bob', handicap_index: 12.0 },
  { id: 3, name: 'Cass', handicap_index: 26.0 },
];

describe('buildLeaderboard', () => {
  it('ranks by cumulative points and reports points back from the leader', () => {
    const scores = [
      ...flatCard(1, 1, 5),
      ...flatCard(1, 2, 5),
      ...flatCard(1, 3, 5),
    ];
    const board = buildLeaderboard(PLAYERS, [LIDO_ROUND], scores, lookup);

    // Same gross card, more strokes received -> more points.
    expect(board.rows.map((r) => r.name)).toEqual(['Cass', 'Bob', 'Alice']);
    expect(board.rows[0]!.position).toBe(1);
    expect(board.rows[0]!.isLeader).toBe(true);
    expect(board.rows[0]!.pointsBack).toBeNull();

    const leadTotal = board.rows[0]!.totalPoints;
    for (const row of board.rows.slice(1)) {
      expect(row.pointsBack).toBe(leadTotal - row.totalPoints);
      expect(row.isLeader).toBe(false);
    }
    expect(board.problems).toEqual([]);
  });

  it('gives tied players the same position and skips the next one', () => {
    const scores = [
      ...flatCard(1, 1, 5),
      ...flatCard(1, 2, 5),
      ...flatCard(1, 3, 5),
    ];
    // Make Alice and Bob tie by giving them identical indexes.
    const tied: PlayerRecord[] = [
      { id: 1, name: 'Alice', handicap_index: 12.0 },
      { id: 2, name: 'Bob', handicap_index: 12.0 },
      { id: 3, name: 'Cass', handicap_index: 26.0 },
    ];
    const board = buildLeaderboard(tied, [LIDO_ROUND], scores, lookup);

    expect(board.rows.map((r) => r.position)).toEqual([1, 2, 2]);
    expect(board.rows[1]!.totalPoints).toBe(board.rows[2]!.totalPoints);
  });

  it('sums points across rounds and marks the best single round of the trip', () => {
    const rounds: RoundRecord[] = [
      LIDO_ROUND,
      { id: 2, date: '2026-08-14', course_id: 'lido', tee_name: 'White' },
    ];
    const scores = [
      ...flatCard(1, 1, 5),
      ...flatCard(2, 1, 4), // much better second round
      ...flatCard(1, 2, 6),
      ...flatCard(2, 2, 6),
    ];
    const board = buildLeaderboard(PLAYERS.slice(0, 2), rounds, scores, lookup);

    const alice = board.rows.find((r) => r.name === 'Alice')!;
    expect(alice.rounds).toHaveLength(2);
    expect(alice.totalPoints).toBe(alice.rounds[0]!.points! + alice.rounds[1]!.points!);
    expect(alice.rounds[1]!.isBestOfTrip).toBe(true);
    expect(alice.rounds[0]!.isBestOfTrip).toBe(false);
    expect(board.holesPlayed).toBe(36);
    expect(board.current).toEqual({ number: 2, holesPlayed: 18 });
  });

  it('tracks position movement across the latest round', () => {
    const rounds: RoundRecord[] = [
      LIDO_ROUND,
      { id: 2, date: '2026-08-14', course_id: 'lido', tee_name: 'White' },
    ];
    const two = PLAYERS.slice(0, 2); // Alice (2.0), Bob (12.0)
    const scores = [
      // Round 1: Bob well ahead.
      ...flatCard(1, 1, 7),
      ...flatCard(1, 2, 4),
      // Round 2: Alice storms it, Bob collapses.
      ...flatCard(2, 1, 3),
      ...flatCard(2, 2, 8),
    ];
    const board = buildLeaderboard(two, rounds, scores, lookup);

    const alice = board.rows.find((r) => r.name === 'Alice')!;
    const bob = board.rows.find((r) => r.name === 'Bob')!;
    expect(alice.position).toBe(1);
    expect(alice.movement).toBe('leader');
    expect(bob.movement).toBe('down');
  });

  it('reports a stub course instead of throwing, and still scores the others', () => {
    const rounds: RoundRecord[] = [
      LIDO_ROUND,
      { id: 2, date: '2026-08-14', course_id: 'mammoth-dunes', tee_name: 'White' },
    ];
    const scores = [...flatCard(1, 1, 5), ...flatCard(2, 1, 5)];
    const board = buildLeaderboard([PLAYERS[0]!], rounds, scores, lookup);

    expect(board.problems).toHaveLength(1);
    expect(board.problems[0]).toMatch(/Round 2.*Mammoth Dunes.*par is null/s);
    expect(board.rounds[1]!.par).toBeNull();

    const alice = board.rows[0]!;
    expect(alice.rounds[0]!.points).toBeGreaterThan(0); // the Lido still counts
    expect(alice.rounds[1]!.points).toBeNull(); // the stub does not
    expect(alice.totalPoints).toBe(alice.rounds[0]!.points);
  });

  it('reports an unknown course id', () => {
    const rounds: RoundRecord[] = [
      { id: 1, date: '2026-08-13', course_id: 'whistling-straits', tee_name: 'Black' },
    ];
    const board = buildLeaderboard([PLAYERS[0]!], rounds, flatCard(1, 1, 5), lookup);
    expect(board.problems[0]).toMatch(/not in src\/data\/courses\.json/);
    expect(board.rows[0]!.totalPoints).toBe(0);
  });

  it('reports a bad tee name without taking the board down', () => {
    const rounds: RoundRecord[] = [
      { id: 1, date: '2026-08-13', course_id: 'lido', tee_name: 'Tips' },
    ];
    const board = buildLeaderboard([PLAYERS[0]!], rounds, flatCard(1, 1, 5), lookup);
    expect(board.problems[0]).toMatch(/no tee named "Tips"/);
    expect(board.rows[0]!.rounds[0]!.points).toBeNull();
  });

  it('shows a player with no scores yet as a dot, not a zero-point round', () => {
    const scores = flatCard(1, 1, 5); // only Alice has a card
    const board = buildLeaderboard(PLAYERS, [LIDO_ROUND], scores, lookup);

    const bob = board.rows.find((r) => r.name === 'Bob')!;
    expect(bob.rounds[0]!.points).toBeNull();
    expect(bob.totalPoints).toBe(0);
    expect(bob.grossTotal).toBeNull(); // nothing played, so no gross to show
  });

  it('still scores a picked-up hole but withholds the gross total', () => {
    const card = flatCard(1, 1, 5);
    card[3] = { ...card[3]!, strokes: null };
    const board = buildLeaderboard([PLAYERS[0]!], [LIDO_ROUND], card, lookup);

    const alice = board.rows[0]!;
    // Points are unaffected — the picked-up hole scores 0 and the rest count.
    expect(alice.rounds[0]!.points).toBeGreaterThan(0);
    // But 17 holes is not an 18-hole gross, so it shows as a dash, not 85.
    expect(alice.grossTotal).toBeNull();
    expect(board.problems).toEqual([]);
  });

  it('withholds the gross total for a part-entered card', () => {
    const partial = flatCard(1, 1, 5).slice(0, 12);
    const board = buildLeaderboard([PLAYERS[0]!], [LIDO_ROUND], partial, lookup);

    expect(board.rows[0]!.grossTotal).toBeNull();
    expect(board.rows[0]!.totalPoints).toBeGreaterThan(0);
  });

  it('reports the gross total once every card is complete', () => {
    const rounds: RoundRecord[] = [
      LIDO_ROUND,
      { id: 2, date: '2026-08-14', course_id: 'lido', tee_name: 'White' },
    ];
    const scores = [...flatCard(1, 1, 5), ...flatCard(2, 1, 4)];
    const board = buildLeaderboard([PLAYERS[0]!], rounds, scores, lookup);

    expect(board.rows[0]!.grossTotal).toBe(18 * 5 + 18 * 4);
  });

  it('counts a part-played round as thru that many holes', () => {
    const partial = flatCard(1, 1, 5).slice(0, 11);
    const board = buildLeaderboard([PLAYERS[0]!], [LIDO_ROUND], partial, lookup);

    expect(board.rounds[0]!.holesPlayed).toBe(11);
    expect(board.holesPlayed).toBe(11);
    expect(board.current).toEqual({ number: 1, holesPlayed: 11 });
  });

  it('orders rounds by date regardless of row order or id', () => {
    const rounds: RoundRecord[] = [
      { id: 9, date: '2026-08-15', course_id: 'lido', tee_name: 'White' },
      { id: 3, date: '2026-08-13', course_id: 'lido', tee_name: 'White' },
    ];
    const board = buildLeaderboard([PLAYERS[0]!], rounds, [], lookup);
    expect(board.rounds.map((r) => r.number)).toEqual([1, 2]);
    expect(board.rounds.map((r) => r.date)).toEqual(['2026-08-13', '2026-08-15']);
  });

  it('survives an empty trip', () => {
    const board = buildLeaderboard([], [], [], lookup);
    expect(board.rows).toEqual([]);
    expect(board.rounds).toEqual([]);
    expect(board.current).toBeNull();
    expect(board.holesPlayed).toBe(0);
  });

  it('accepts a handicap index that arrives as a string from postgres numeric', () => {
    const asString = [
      { id: 1, name: 'Alice', handicap_index: '12.0' as unknown as number },
    ];
    const board = buildLeaderboard(asString, [LIDO_ROUND], flatCard(1, 1, 5), lookup);
    expect(board.rows[0]!.handicapIndex).toBe(12);
    expect(board.rows[0]!.totalPoints).toBeGreaterThan(0);
  });
});
