/**
 * Scoring tests, run against the real Lido White data in src/data/courses.json.
 * If that file changes, these numbers are supposed to move with it.
 */

import { describe, expect, it } from 'vitest';

import { getCourse, getPlayableCourse } from '../data/courses';
import {
  assertPlayableCourse,
  courseHandicap,
  getTee,
  netScore,
  playingHandicap,
  playingHandicapForRound,
  roundHalfAwayFromZero,
  scoreRound,
  stablefordPoints,
  strokeAllocation,
  strokesFromRows,
  strokesReceivedOnHole,
  totalPoints,
} from './scoring';
import type { Strokes } from './types';

const LIDO = getPlayableCourse('lido');
const WHITE = 'White';

/** Hole numbers, in ascending si order, that receive at least one stroke. */
function holesWithStrokes(handicapIndex: number): number[] {
  const { playingHandicap: ph } = playingHandicapForRound(LIDO, WHITE, handicapIndex);
  const allocation = strokeAllocation(LIDO, ph);
  return [...LIDO.holes]
    .sort((a, b) => a.si - b.si)
    .filter((h) => (allocation.get(h.hole) ?? 0) !== 0)
    .map((h) => h.hole);
}

/** The hole number carrying a given stroke index on the Lido. */
function holeAtSi(si: number): number {
  const hole = LIDO.holes.find((h) => h.si === si);
  if (!hole) throw new Error(`No hole with si ${si}`);
  return hole.hole;
}

describe('the Lido card in courses.json', () => {
  it('is a complete, self-consistent scorecard', () => {
    expect(LIDO.par).toBe(72);
    expect(LIDO.holes).toHaveLength(18);
    expect(LIDO.holes.reduce((sum, h) => sum + h.par, 0)).toBe(72);
    expect(new Set(LIDO.holes.map((h) => h.si)).size).toBe(18);
    expect(getTee(LIDO, WHITE)).toMatchObject({ rating: 72.5, slope: 144 });
  });

  it('puts si 1, 2 and 3 on holes 4, 12 and 6', () => {
    expect([holeAtSi(1), holeAtSi(2), holeAtSi(3)]).toEqual([4, 12, 6]);
  });
});

describe('roundHalfAwayFromZero', () => {
  it('rounds halves away from zero in both directions', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(2.49)).toBe(2);
    expect(roundHalfAwayFromZero(-2.49)).toBe(-2);
  });

  it('is not fooled by binary floating point dust', () => {
    // 3 * 0.95 evaluates to 2.8499999999999996, which must still round to 3.
    expect(3 * 0.95).toBeLessThan(2.85);
    expect(roundHalfAwayFromZero(3 * 0.95)).toBe(3);
    // 23 * 0.95 evaluates to 21.849999999999998.
    expect(roundHalfAwayFromZero(23 * 0.95)).toBe(22);
  });
});

describe('unplayable courses', () => {
  it('throws a course-specific error when par is null', () => {
    const stub = getCourse('sedge-valley');
    expect(stub.par).toBeNull();
    expect(() => assertPlayableCourse(stub)).toThrowError(/Sedge Valley.*par is null/s);
    expect(() => assertPlayableCourse(stub)).toThrowError(/courses\.json/);
  });

  it('refuses to score a round against a stub course', () => {
    const card: Strokes[] = Array(18).fill(4);
    expect(() => scoreRound(getCourse('mammoth-dunes'), WHITE, 12, card)).toThrowError(
      /Mammoth Dunes.*par is null/s,
    );
  });

  it('rejects a card whose holes do not add up to its stated par', () => {
    const broken = {
      ...LIDO,
      par: 71,
      holes: LIDO.holes.map((h) => ({ ...h })),
    };
    expect(() => assertPlayableCourse(broken)).toThrowError(/par 71.*add up to 72/s);
  });

  it('names an unknown tee and lists the real ones', () => {
    expect(() => getTee(LIDO, 'Black')).toThrowError(/no tee named "Black".*White/s);
  });
});

describe('handicap calculation on the Lido White (72.5 / 144, par 72)', () => {
  it('HI 2.0 -> course handicap 3, playing handicap 3', () => {
    // 2.0 * (144/113) + (72.5 - 72) = 3.0487 -> 3; 3 * 0.95 = 2.85 -> 3
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      LIDO,
      WHITE,
      2.0,
    );
    expect(ch).toBe(3);
    expect(ph).toBe(3);
  });

  it('HI 2.0 takes strokes on holes 4, 12 and 6 and nowhere else', () => {
    expect(holesWithStrokes(2.0)).toEqual([4, 12, 6]);

    const allocation = strokeAllocation(LIDO, 3);
    expect(allocation.get(4)).toBe(1);
    expect(allocation.get(12)).toBe(1);
    expect(allocation.get(6)).toBe(1);
    // Every other hole is a straight gross-vs-par hole.
    for (const hole of LIDO.holes) {
      if (![4, 12, 6].includes(hole.hole)) {
        expect(allocation.get(hole.hole)).toBe(0);
      }
    }
  });

  it('HI 12.0 -> playing handicap 15, with an inclusive si boundary at 15', () => {
    // 12.0 * (144/113) + 0.5 = 15.792 -> 16; 16 * 0.95 = 15.2 -> 15
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      LIDO,
      WHITE,
      12.0,
    );
    expect(ch).toBe(16);
    expect(ph).toBe(15);

    expect(strokesReceivedOnHole(15, ph)).toBe(1); // si 15 is inside the allowance
    expect(strokesReceivedOnHole(16, ph)).toBe(0); // si 16 is not
    expect(holesWithStrokes(12.0)).toHaveLength(15);
    // si 16, 17, 18 are holes 13, 9 and 14 on this card.
    expect(holesWithStrokes(12.0)).not.toContain(holeAtSi(16));
    expect(holesWithStrokes(12.0)).not.toContain(holeAtSi(17));
    expect(holesWithStrokes(12.0)).not.toContain(holeAtSi(18));
  });

  it('HI 18.0 -> playing handicap 22, a stroke everywhere and an inclusive second at si 4', () => {
    // 18.0 * (144/113) + 0.5 = 23.438 -> 23; 23 * 0.95 = 21.85 -> 22
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      LIDO,
      WHITE,
      18.0,
    );
    expect(ch).toBe(23);
    expect(ph).toBe(22);

    for (let si = 1; si <= 18; si += 1) {
      expect(strokesReceivedOnHole(si, ph)).toBe(si <= 22 - 18 ? 2 : 1);
    }
    expect(strokesReceivedOnHole(4, ph)).toBe(2); // si 4 == ph - 18, inclusive
    expect(strokesReceivedOnHole(5, ph)).toBe(1);
  });

  it('HI 26.0 doubles up on the lowest si holes', () => {
    // 26.0 * (144/113) + 0.5 = 33.633 -> 34; 34 * 0.95 = 32.3 -> 32
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      LIDO,
      WHITE,
      26.0,
    );
    expect(ch).toBe(34);
    expect(ph).toBe(32);

    const allocation = strokeAllocation(LIDO, ph);
    // Two strokes on si 1-14, one on si 15-18.
    for (const hole of LIDO.holes) {
      expect(allocation.get(hole.hole)).toBe(hole.si <= 14 ? 2 : 1);
    }
    // The hardest holes on the card get the second strokes.
    expect(allocation.get(holeAtSi(1))).toBe(2);
    expect(allocation.get(holeAtSi(2))).toBe(2);
    expect(allocation.get(holeAtSi(3))).toBe(2);
    // Total strokes handed out equals the playing handicap.
    const handedOut = [...allocation.values()].reduce((a, b) => a + b, 0);
    expect(handedOut).toBe(32);
  });

  it('a plus-2 index gives strokes back at si 18 and 17', () => {
    // -2.0 * (144/113) + 0.5 = -2.049 -> -2; -2 * 0.95 = -1.9 -> -2
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      LIDO,
      WHITE,
      -2.0,
    );
    expect(ch).toBe(-2);
    expect(ph).toBe(-2);

    expect(strokesReceivedOnHole(18, ph)).toBe(-1);
    expect(strokesReceivedOnHole(17, ph)).toBe(-1);
    expect(strokesReceivedOnHole(16, ph)).toBe(0);
    expect(strokesReceivedOnHole(1, ph)).toBe(0);

    const allocation = strokeAllocation(LIDO, ph);
    // si 18 and 17 are holes 14 and 9 on the Lido.
    expect(allocation.get(holeAtSi(18))).toBe(-1);
    expect(allocation.get(holeAtSi(17))).toBe(-1);
    expect([...allocation.values()].reduce((a, b) => a + b, 0)).toBe(-2);
  });

  it('is computed per round, so the same index differs by course and tee', () => {
    const easier = { ...LIDO, tees: [{ name: 'Green', rating: 68.0, slope: 113 }] };
    expect(playingHandicapForRound(LIDO, WHITE, 12.0).playingHandicap).toBe(15);
    expect(playingHandicapForRound(easier, 'Green', 12.0).playingHandicap).toBe(8);
  });

  it('rejects a stroke index outside 1-18', () => {
    expect(() => strokesReceivedOnHole(0, 10)).toThrowError(/1-18/);
    expect(() => strokesReceivedOnHole(19, 10)).toThrowError(/1-18/);
  });
});

describe('net score and Stableford points', () => {
  it('subtracts strokes received, and gives them back for a plus handicap', () => {
    expect(netScore(5, 1)).toBe(4);
    expect(netScore(5, 2)).toBe(3);
    expect(netScore(5, 0)).toBe(5);
    expect(netScore(5, -1)).toBe(6);
    expect(netScore(null, 1)).toBeNull();
  });

  it('scores the full points table against par', () => {
    expect(stablefordPoints(7, 4)).toBe(0); // net triple bogey
    expect(stablefordPoints(6, 4)).toBe(0); // net double bogey
    expect(stablefordPoints(5, 4)).toBe(1); // bogey
    expect(stablefordPoints(4, 4)).toBe(2); // par
    expect(stablefordPoints(3, 4)).toBe(3); // birdie
    expect(stablefordPoints(2, 4)).toBe(4); // eagle
    expect(stablefordPoints(1, 4)).toBe(5); // albatross
  });

  it('scores a picked-up hole as 0 without crashing', () => {
    expect(stablefordPoints(null, 4)).toBe(0);
    expect(stablefordPoints(null, 3)).toBe(0);
    expect(stablefordPoints(null, 5)).toBe(0);
  });
});

describe('scoreRound on the Lido White', () => {
  it('carries a picked-up hole through as 0 points and leaves it out of the gross', () => {
    const card: Strokes[] = Array(18).fill(4);
    card[6] = null; // picked up on hole 7

    const result = scoreRound(LIDO, WHITE, 12.0, card);
    const hole7 = result.holes[6];

    expect(hole7.strokes).toBeNull();
    expect(hole7.net).toBeNull();
    expect(hole7.points).toBe(0);
    expect(result.holesPickedUp).toBe(1);
    expect(result.grossTotal).toBe(17 * 4);
    expect(Number.isFinite(result.points)).toBe(true);
  });

  it('matches a hand-computed card for a 12.0 index (playing handicap 15)', () => {
    // Strokes on si 1-15 — i.e. every hole except 13 (si 16), 9 (si 17) and
    // 14 (si 18). Hole 9 is picked up.
    //
    // hole par si  gross  shot  net   result        pts
    //   1   4  11    5     +1    4    par            2
    //   2   4   7    4     +1    3    birdie         3
    //   3   3  15    3     +1    2    birdie         3
    //   4   5   1    7     +1    6    bogey          1
    //   5   4  13    6     +1    5    bogey          1
    //   6   5   3    5     +1    4    birdie         3
    //   7   5   5    8     +1    7    double         0
    //   8   3   9    4     +1    3    par            2
    //   9   4  17   pick    0   null  picked up      0
    //  10   4   6    4     +1    3    birdie         3
    //  11   4   8    5     +1    4    par            2
    //  12   4   2    4     +1    3    birdie         3
    //  13   4  16    5      0    5    bogey          1
    //  14   3  18    3      0    3    par            2
    //  15   4  10    6     +1    5    bogey          1
    //  16   3  12    3     +1    2    birdie         3
    //  17   5   4    6     +1    5    par            2
    //  18   4  14    5     +1    4    par            2
    //                                          front 15
    //                                           back 19
    //                                          total 34
    const card: Strokes[] = [
      5, 4, 3, 7, 6, 5, 8, 4, null,
      4, 5, 4, 5, 3, 6, 3, 6, 5,
    ];
    const expectedPoints = [
      2, 3, 3, 1, 1, 3, 0, 2, 0,
      3, 2, 3, 1, 2, 1, 3, 2, 2,
    ];

    const result = scoreRound(LIDO, WHITE, 12.0, card);

    expect(result.courseHandicap).toBe(16);
    expect(result.playingHandicap).toBe(15);
    expect(result.holes.map((h) => h.points)).toEqual(expectedPoints);
    expect(result.holes.slice(0, 9).reduce((s, h) => s + h.points, 0)).toBe(15);
    expect(result.holes.slice(9).reduce((s, h) => s + h.points, 0)).toBe(19);
    expect(result.points).toBe(34);
    expect(result.grossTotal).toBe(83); // 17 holes; hole 9 was picked up
    expect(result.holesPickedUp).toBe(1);
    expect(result.courseName).toBe('The Lido');
    expect(result.teeName).toBe('White');
  });

  it('matches a hand-computed card for a plus-2 index', () => {
    // Playing handicap -2: a stroke is given back on hole 14 (si 18) and
    // hole 9 (si 17). Everything else is gross vs par.
    //
    // Level par everywhere except an eagle on hole 4 (par 5, 3) and a bogey
    // on hole 9 (par 4, 5 -> net 6 with the shot given back -> double -> 0).
    const card: Strokes[] = [
      4, 4, 3, 3, 4, 5, 5, 3, 5,
      4, 4, 4, 4, 3, 4, 3, 5, 4,
    ];

    const result = scoreRound(LIDO, WHITE, -2.0, card);

    expect(result.playingHandicap).toBe(-2);
    expect(result.holes[3].points).toBe(4); // hole 4: eagle
    expect(result.holes[8].net).toBe(6); // hole 9: 5 + 1 given back
    expect(result.holes[8].points).toBe(0); // net double bogey
    expect(result.holes[13].net).toBe(4); // hole 14: par 3 in 3, +1 back
    expect(result.holes[13].points).toBe(1); // net bogey
    // 15 holes at level par (2 each) + 4 + 0 + 1
    expect(result.points).toBe(15 * 2 + 4 + 0 + 1);
    expect(result.grossTotal).toBe(71);
    expect(result.holesPickedUp).toBe(0);
  });

  it('scores a scratch card as gross Stableford', () => {
    const card: Strokes[] = [...LIDO.holes]
      .sort((a, b) => a.hole - b.hole)
      .map((h) => h.par);
    const result = scoreRound(LIDO, WHITE, 0, card);
    expect(result.courseHandicap).toBe(1); // 0 * slope + 0.5 -> 1
    expect(result.playingHandicap).toBe(1);
    expect(result.holes.find((h) => h.si === 1)?.points).toBe(3); // net birdie
    expect(result.points).toBe(17 * 2 + 3);
  });

  it('rejects a card that is not 18 holes', () => {
    expect(() => scoreRound(LIDO, WHITE, 12, Array(17).fill(4))).toThrowError(
      /Expected 18 hole scores/,
    );
  });

  it('rejects nonsense strokes', () => {
    const card: Strokes[] = Array(18).fill(4);
    card[0] = 0;
    expect(() => scoreRound(LIDO, WHITE, 12, card)).toThrowError(/Hole 1 has strokes 0/);
  });
});

describe('strokesFromRows', () => {
  it('builds a dense 18-hole card from Supabase rows, in any order', () => {
    const rows = [
      { hole: 3, strokes: 4 },
      { hole: 1, strokes: 5 },
      { hole: 2, strokes: null },
    ];
    const card = strokesFromRows(rows);
    expect(card).toHaveLength(18);
    expect(card[0]).toBe(5);
    expect(card[1]).toBeNull();
    expect(card[2]).toBe(4);
    expect(card[17]).toBeNull(); // holes with no row yet are unplayed
  });

  it('rejects an out-of-range hole number', () => {
    expect(() => strokesFromRows([{ hole: 19, strokes: 4 }])).toThrowError(/hole 19/);
  });
});

describe('totalPoints', () => {
  it('adds up the rounds played so far', () => {
    const card: Strokes[] = Array(18).fill(5);
    const r1 = scoreRound(LIDO, WHITE, 12.0, card);
    const r2 = scoreRound(LIDO, WHITE, 12.0, card);
    expect(totalPoints([])).toBe(0);
    expect(totalPoints([r1, r2])).toBe(r1.points * 2);
  });
});

describe('handicap primitives in isolation', () => {
  it('applies the 95% allowance', () => {
    expect(playingHandicap(20)).toBe(19);
    expect(playingHandicap(10)).toBe(10); // 9.5 -> 10, half away from zero
    expect(playingHandicap(0)).toBe(0);
    expect(playingHandicap(-4)).toBe(-4); // -3.8 -> -4
  });

  it('applies slope and the rating-minus-par adjustment', () => {
    const scratchTee = { name: 'Neutral', rating: 72, slope: 113 };
    expect(courseHandicap(10, scratchTee, 72)).toBe(10);
    expect(courseHandicap(10, { ...scratchTee, slope: 144 }, 72)).toBe(13);
    expect(courseHandicap(10, { ...scratchTee, rating: 74.5 }, 72)).toBe(13);
  });
});
