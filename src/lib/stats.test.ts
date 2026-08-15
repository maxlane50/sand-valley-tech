import { describe, expect, it } from 'vitest';

import { getCourse } from '../data/courses';
import { buildTripStats } from './stats';
import type { PlayerRecord, RoundRecord, ScoreRecord } from './types';

const lookup = (id: string) => {
  try {
    return getCourse(id);
  } catch {
    return undefined;
  }
};

const R1: RoundRecord = { id: 1, date: '2026-08-13', course_id: 'lido', tee_name: 'White' };
const R2: RoundRecord = { id: 2, date: '2026-08-14', course_id: 'lido', tee_name: 'White' };

const ALICE: PlayerRecord = { id: 1, name: 'Alice', handicap_index: 12.0 };
const BOB: PlayerRecord = { id: 2, name: 'Bob', handicap_index: 12.0 };

/** The Lido's pars in hole order. */
const PARS = [4, 4, 3, 5, 4, 5, 5, 3, 4, 4, 4, 4, 4, 3, 4, 3, 5, 4];

function card(roundId: number, playerId: number, strokes: (number | null)[]): ScoreRecord[] {
  return strokes.map((s, i) => ({ round_id: roundId, player_id: playerId, hole: i + 1, strokes: s }));
}

/** A card that is `delta` over par on every hole. Holes may be nulled out. */
const overPar = (delta: number): (number | null)[] => PARS.map((p) => p + delta);

const build = (
  rounds: RoundRecord[],
  players: PlayerRecord[],
  scores: ScoreRecord[],
) => buildTripStats(rounds, players, scores, lookup);

describe('buildTripStats · hole type splits', () => {
  it('averages gross vs par and points per hole for each hole type', () => {
    // Level par everywhere: average vs par is 0 on all three types.
    const stats = build([R1], [ALICE], card(1, 1, overPar(0)));
    const alice = stats.players[0]!;

    expect(alice.holesPlayed).toBe(18);
    for (const type of alice.byType) {
      expect(type.averageVsPar).toBe(0);
    }
    // The Lido has 4 par 3s, 10 par 4s and 4 par 5s.
    expect(alice.byType.map((t) => t.holes)).toEqual([4, 10, 4]);
    expect(alice.byType.map((t) => t.par)).toEqual([3, 4, 5]);
  });

  it('reports a null average for a hole type never played', () => {
    // Only holes 1 and 2 (both par 4) entered.
    const strokes: (number | null)[] = Array(18).fill(null);
    strokes[0] = 4;
    strokes[1] = 4;
    const stats = build([R1], [ALICE], card(1, 1, strokes));
    const alice = stats.players[0]!;

    expect(alice.byType[0]!.averageVsPar).toBeNull(); // par 3
    expect(alice.byType[0]!.pointsPerHole).toBeNull();
    expect(alice.byType[1]!.averageVsPar).toBe(0); // par 4
    expect(alice.byType[2]!.averageVsPar).toBeNull(); // par 5
    expect(alice.holesPlayed).toBe(2);
  });

  it('separates a par 3 specialist from a par 5 specialist', () => {
    // Alice is +2 on par 3s, level elsewhere. Bob is the reverse on par 5s.
    const aliceCard = PARS.map((p) => (p === 3 ? p + 2 : p));
    const bobCard = PARS.map((p) => (p === 5 ? p + 2 : p));
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, aliceCard),
      ...card(1, 2, bobCard),
    ]);

    const alice = stats.players.find((p) => p.name === 'Alice')!;
    const bob = stats.players.find((p) => p.name === 'Bob')!;

    expect(alice.byType[0]!.averageVsPar).toBe(2); // par 3
    expect(alice.byType[2]!.averageVsPar).toBe(0); // par 5
    expect(bob.byType[0]!.averageVsPar).toBe(0);
    expect(bob.byType[2]!.averageVsPar).toBe(2);

    // Alice is worst on par 3s AND best on par 5s. design.html gives par 5s
    // priority, so that is the tag she wears; Bob takes best par 3s.
    expect(alice.tag).toEqual({ text: 'best par 5s', tone: 'good' });
    expect(bob.tag).toEqual({ text: 'best par 3s', tone: 'good' });
  });

  it('falls back to "worst par 3s" when the par 5 tag is taken by someone else', () => {
    // Bob is best on par 5s. Alice is left holding the worst par 3s.
    const aliceCard = PARS.map((p) => (p === 3 ? p + 2 : p + 1));
    const bobCard = PARS.map((p) => (p === 5 ? p : p + 1));
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, aliceCard),
      ...card(1, 2, bobCard),
    ]);

    expect(stats.players.find((p) => p.name === 'Bob')!.tag).toEqual({
      text: 'best par 5s',
      tone: 'good',
    });
    expect(stats.players.find((p) => p.name === 'Alice')!.tag).toEqual({
      text: 'worst par 3s',
      tone: 'bad',
    });
  });

  it('hands out no tag when there is only one player to compare', () => {
    const stats = build([R1], [ALICE], card(1, 1, overPar(1)));
    expect(stats.players[0]!.tag).toBeNull();
  });

  it('orders players by points per hole, best first', () => {
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, overPar(0)), // level par
      ...card(1, 2, overPar(3)), // three over everywhere
    ]);
    expect(stats.players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
    expect(stats.players[0]!.totalPoints).toBeGreaterThan(stats.players[1]!.totalPoints);
  });
});

describe('buildTripStats · scoring counts', () => {
  it('counts eagles separately from birdies', () => {
    const strokes = overPar(0);
    strokes[0] = PARS[0]! - 1; // birdie
    strokes[1] = PARS[1]! + 1; // bogey
    strokes[2] = PARS[2]! + 2; // blow-up
    strokes[3] = PARS[3]! - 2; // eagle, its own column

    const stats = build([R1], [ALICE], card(1, 1, strokes));
    expect(stats.players[0]!.counts).toEqual({
      eagles: 1,
      birdies: 1,
      pars: 14,
      bogeys: 1,
      blowups: 1,
    });
  });

  it('counts an ace on a par 3 as an eagle, not a birdie', () => {
    const strokes = overPar(0);
    strokes[2] = 1; // hole 3 is a par 3
    const stats = build([R1], [ALICE], card(1, 1, strokes));
    expect(stats.players[0]!.counts.eagles).toBe(1);
    expect(stats.players[0]!.counts.birdies).toBe(0);
  });

  it('counts an albatross with the eagles', () => {
    const strokes = overPar(0);
    strokes[3] = PARS[3]! - 3; // hole 4 is a par 5
    const stats = build([R1], [ALICE], card(1, 1, strokes));
    expect(stats.players[0]!.counts.eagles).toBe(1);
  });

  it('classifies every played hole exactly once', () => {
    const strokes = overPar(0);
    strokes[0] = PARS[0]! - 2;
    strokes[1] = PARS[1]! - 1;
    strokes[2] = PARS[2]! + 1;
    strokes[3] = PARS[3]! + 5;
    const { counts } = build([R1], [ALICE], card(1, 1, strokes)).players[0]!;
    const total =
      counts.eagles + counts.birdies + counts.pars + counts.bogeys + counts.blowups;
    expect(total).toBe(18);
  });

  it('does not count unplayed holes as blow-ups', () => {
    const stats = build([R1], [ALICE, BOB], card(1, 1, overPar(0)));
    const bob = stats.players.find((p) => p.name === 'Bob')!;

    expect(bob.holesPlayed).toBe(0);
    expect(bob.counts).toEqual({ eagles: 0, birdies: 0, pars: 0, bogeys: 0, blowups: 0 });
  });

  it('excludes a picked-up hole from the counts', () => {
    const strokes = overPar(0);
    strokes[7] = null;
    const stats = build([R1], [ALICE], card(1, 1, strokes));
    const counts = stats.players[0]!.counts;
    expect(counts.pars).toBe(17);
    expect(counts.blowups).toBe(0);
    expect(stats.players[0]!.holesPlayed).toBe(17);
  });
});

describe('buildTripStats · group figures', () => {
  it('aggregates every player into the group row', () => {
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, overPar(0)),
      ...card(1, 2, overPar(2)),
    ]);

    expect(stats.group.holesPlayed).toBe(36);
    // Level par and two over, averaged, is one over.
    for (const type of stats.group.byType) {
      expect(type.averageVsPar).toBe(1);
    }
    expect(stats.group.counts.pars).toBe(18);
    expect(stats.group.counts.blowups).toBe(18);
  });
});

describe('buildTripStats · hole difficulty', () => {
  it('ranks holes purely on what the group scored, ignoring the stroke index', () => {
    // Everyone is level par except hole 14, which happens to carry the printed
    // easiest stroke index. It played hardest, so it ranks hardest.
    const strokes = overPar(0);
    strokes[13] = PARS[13]! + 4;
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, strokes),
      ...card(1, 2, strokes),
    ]);

    expect(stats.holesRanked).toBe(18);
    const hardest = stats.hardest[0]!;
    expect(hardest.hole).toBe(14);
    expect(hardest.si).toBe(18); // carried for context only
    expect(hardest.averageVsPar).toBe(4);
    expect(hardest.actualRank).toBe(1);
    expect(hardest.playersCounted).toBe(2);
  });

  it('orders strictly by scoring average, whatever the stroke index says', () => {
    const strokes = overPar(0);
    strokes[13] = PARS[13]! + 4; // si 18, worst average
    strokes[3] = PARS[3]! + 2; // si 1, second worst
    const stats = build([R1], [ALICE], card(1, 1, strokes));

    expect(stats.hardest.map((h) => h.hole)).toEqual([14, 4, expect.any(Number)]);
    expect(stats.hardest[0]!.averageVsPar).toBeGreaterThan(
      stats.hardest[1]!.averageVsPar,
    );
  });

  it('returns three hardest and three easiest, easiest first', () => {
    const stats = build([R1], [ALICE], card(1, 1, overPar(1)));
    expect(stats.hardest).toHaveLength(3);
    expect(stats.easiest).toHaveLength(3);
    expect(stats.easiest[0]!.actualRank).toBe(18);
    expect(stats.hardest[0]!.actualRank).toBe(1);
  });

  it('ranks across every round, not within each one', () => {
    const two = build([R1, R2], [ALICE], [
      ...card(1, 1, overPar(0)),
      ...card(2, 1, overPar(0)),
    ]);
    expect(two.holesRanked).toBe(36);
    expect(two.hardest[0]!.actualRank).toBe(1);
    expect(two.easiest[0]!.actualRank).toBe(36);
  });

  it('averages a hole over only the players who played it', () => {
    const alice = overPar(2);
    const bob = overPar(0);
    bob[0] = null; // Bob did not finish hole 1
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, alice),
      ...card(1, 2, bob),
    ]);

    const holeOne = [...stats.hardest, ...stats.easiest].find((h) => h.hole === 1);
    // Only Alice's +2 counts, so the average is 2 and not 1.
    expect(holeOne?.playersCounted ?? 1).toBe(1);
    expect(holeOne?.averageVsPar ?? 2).toBe(2);
  });
});

describe('buildTripStats · superlatives', () => {
  it('names the best single round with its course', () => {
    const stats = build([R1, R2], [ALICE, BOB], [
      ...card(1, 1, overPar(0)),
      ...card(2, 1, overPar(4)),
      ...card(1, 2, overPar(4)),
      ...card(2, 2, overPar(4)),
    ]);

    const best = stats.superlatives.find((s) => s.label === 'Most points, one round')!;
    expect(best.name).toBe('Alice');
    expect(best.note).toContain('Round 1');
    expect(best.note).toContain('The Lido');
  });

  it('measures the longest run of point-scoring holes', () => {
    // Level par scores everywhere with a handicap, so break it with two
    // deliberate blow-ups at holes 5 and 12.
    const strokes = overPar(0);
    strokes[4] = PARS[4]! + 8;
    strokes[11] = PARS[11]! + 8;
    const stats = build([R1], [ALICE], card(1, 1, strokes));

    const streak = stats.superlatives.find(
      (s) => s.label === 'Longest streak with points',
    )!;
    // Holes 6-11 is six, holes 13-18 is six, holes 1-4 is four.
    expect(streak.value).toBe(6);
    expect(streak.name).toBe('Alice');
  });

  it('counts eagles towards "most birdies or better"', () => {
    const aliceCard = overPar(0);
    aliceCard[0] = PARS[0]! - 2; // one eagle
    const bobCard = overPar(0);
    bobCard[0] = PARS[0]! - 1; // one birdie
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, aliceCard),
      ...card(1, 2, bobCard),
    ]);

    const best = stats.superlatives.find((s) => s.label === 'Most birdies or better')!;
    expect(best.value).toBe(1);
    expect(best.name).toBe('Alice & Bob'); // an eagle and a birdie both count as one
  });

  it('reports a tie by name rather than picking a favourite', () => {
    const strokes = overPar(0);
    strokes[0] = PARS[0]! + 5; // one blow-up each
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, strokes),
      ...card(1, 2, strokes),
    ]);

    const blowups = stats.superlatives.find((s) => s.label === 'Most blow-ups')!;
    expect(blowups.value).toBe(1);
    expect(blowups.name).toBe('Alice & Bob');
  });

  it('describes a three-way tie compactly', () => {
    const carol: PlayerRecord = { id: 3, name: 'Carol', handicap_index: 12.0 };
    const strokes = overPar(0);
    strokes[0] = PARS[0]! + 5;
    const stats = build([R1], [ALICE, BOB, carol], [
      ...card(1, 1, strokes),
      ...card(1, 2, strokes),
      ...card(1, 3, strokes),
    ]);
    expect(stats.superlatives.find((s) => s.label === 'Most blow-ups')!.name).toBe(
      '3-way tie',
    );
  });

  it('omits a superlative nobody has earned', () => {
    // Level par with a handicap: no blow-ups anywhere.
    const stats = build([R1], [ALICE], card(1, 1, overPar(0)));
    expect(stats.superlatives.some((s) => s.label === 'Most blow-ups')).toBe(false);
  });
});

describe('buildTripStats · rounds and problems', () => {
  it('summarises each round with its par and low scorer', () => {
    const stats = build([R1], [ALICE, BOB], [
      ...card(1, 1, overPar(0)),
      ...card(1, 2, overPar(4)),
    ]);

    expect(stats.rounds).toHaveLength(1);
    expect(stats.rounds[0]).toMatchObject({
      number: 1,
      courseName: 'The Lido',
      par: 72,
      problem: null,
    });
    expect(stats.rounds[0]!.low!.name).toBe('Alice');
  });

  it('reports a stub course once and keeps the rest of the trip intact', () => {
    const stub: RoundRecord = {
      id: 3,
      date: '2026-08-15',
      course_id: 'sedge-valley',
      tee_name: 'White',
    };
    const stats = build([R1, stub], [ALICE], card(1, 1, overPar(0)));

    expect(stats.problems).toHaveLength(1);
    expect(stats.problems[0]).toMatch(/Sedge Valley.*par is null/s);
    expect(stats.rounds[1]!.par).toBeNull();
    expect(stats.holesRanked).toBe(18); // only the Lido contributes
    expect(stats.players[0]!.holesPlayed).toBe(18);
  });

  it('survives a trip with no data at all', () => {
    const stats = build([], [ALICE], []);
    expect(stats.hasData).toBe(false);
    expect(stats.superlatives).toEqual([]);
    expect(stats.hardest).toEqual([]);
    expect(stats.group.holesPlayed).toBe(0);
    expect(stats.players[0]!.byType.every((t) => t.averageVsPar === null)).toBe(true);
  });
});
