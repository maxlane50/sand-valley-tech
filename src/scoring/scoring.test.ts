/**
 * Scoring tests, run against the real Bandon Dunes Black data in
 * src/data/courses.json. If that file changes, these numbers are supposed to
 * move with it.
 *
 * Every figure below was worked out from the printed card by hand rather than
 * read off this implementation, which is the only thing that makes them a
 * check on it.
 */

import { describe, expect, it } from 'vitest';

import { getCourse, getPlayableCourse } from '../data/courses';
import {
  assertPlayableCourse,
  courseHandicap,
  getTee,
  holesForTee,
  netScore,
  playingHandicap,
  playingHandicapForRound,
  ratingFor,
  roundHalfAwayFromZero,
  scoreRound,
  stablefordPoints,
  strokeAllocation,
  strokesFromRows,
  strokesReceivedOnHole,
  totalPoints,
} from './scoring';
import type { Course, Strokes, Tee } from './types';

const BANDON = getPlayableCourse('bandon-dunes');
const TRAILS = getPlayableCourse('bandon-trails');
const BLACK = 'Black';

const blackTee = getTee(BANDON, BLACK);
const orangeTee = getTee(BANDON, 'Orange');

/** Hole numbers, in ascending si order, that receive at least one stroke. */
function holesWithStrokes(handicapIndex: number): number[] {
  const { playingHandicap: ph } = playingHandicapForRound(
    BANDON,
    BLACK,
    handicapIndex,
    'men',
  );
  const allocation = strokeAllocation(BANDON, blackTee, ph);
  return [...BANDON.holes]
    .sort((a, b) => a.si - b.si)
    .filter((h) => (allocation.get(h.hole) ?? 0) !== 0)
    .map((h) => h.hole);
}

/** The hole number carrying a given stroke index on Bandon Dunes. */
function holeAtSi(si: number): number {
  const hole = BANDON.holes.find((h) => h.si === si);
  if (!hole) throw new Error(`No hole with si ${si}`);
  return hole.hole;
}

/** A course with no scorecard filled in, for the unplayable paths. */
const STUB: Course = {
  id: 'old-macdonald',
  name: 'Old Macdonald',
  par: null,
  tees: [],
  holes: [],
};

describe('the Bandon Dunes card in courses.json', () => {
  it('is a complete, self-consistent scorecard', () => {
    expect(BANDON.par).toBe(72);
    expect(BANDON.holes).toHaveLength(18);
    expect(BANDON.holes.reduce((sum, h) => sum + h.par, 0)).toBe(72);
    expect(new Set(BANDON.holes.map((h) => h.si)).size).toBe(18);
    expect(blackTee.men).toEqual({ rating: 73.5, slope: 143 });
    expect(blackTee.women).toEqual({ rating: 79.6, slope: 145 });
  });

  // Per the Handicap row on the printed card.
  it('puts si 1, 2 and 3 on holes 5, 11 and 3', () => {
    expect([holeAtSi(1), holeAtSi(2), holeAtSi(3)]).toEqual([5, 11, 3]);
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
    expect(() => assertPlayableCourse(STUB)).toThrowError(/Old Macdonald.*par is null/s);
    expect(() => assertPlayableCourse(STUB)).toThrowError(/courses\.json/);
  });

  it('refuses to score a round against a stub course', () => {
    const card: Strokes[] = Array(18).fill(4);
    expect(() => scoreRound(STUB, BLACK, 12, 'men', card)).toThrowError(
      /Old Macdonald.*par is null/s,
    );
  });

  it('rejects a card whose holes do not add up to its stated par', () => {
    const broken = { ...BANDON, par: 71, holes: BANDON.holes.map((h) => ({ ...h })) };
    expect(() => assertPlayableCourse(broken)).toThrowError(/par 71.*add up to 72/s);
  });

  it('refuses a tee that is only rated once', () => {
    // Half a rating is worse than none: a woman scored off a tee with no
    // women's rating would silently be given the men's.
    const halfRated = {
      ...BANDON,
      tees: [{ ...blackTee, women: undefined } as unknown as Tee],
    };
    expect(() => assertPlayableCourse(halfRated)).toThrowError(
      /no women's rating and slope for the Black tees/,
    );
  });

  it('refuses a per-tee stroke index that is not 1 to 18', () => {
    const broken = {
      ...BANDON,
      tees: [{ ...orangeTee, si: Array(18).fill(1) }],
    };
    expect(() => assertPlayableCourse(broken)).toThrowError(
      /own stroke index.*exactly once/s,
    );
  });

  it('names an unknown tee and lists the real ones', () => {
    expect(() => getTee(BANDON, 'Purple')).toThrowError(
      /no tee named "Purple".*Black.*Orange/s,
    );
  });
});

describe("handicap calculation on Bandon Dunes Black, men's (73.5 / 143, par 72)", () => {
  it('HI 2.0 -> course handicap 4, playing handicap 4', () => {
    // 2.0 * (143/113) + (73.5 - 72) = 4.031 -> 4; 4 * 0.95 = 3.8 -> 4
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      BANDON,
      BLACK,
      2.0,
      'men',
    );
    expect(ch).toBe(4);
    expect(ph).toBe(4);
  });

  it('HI 2.0 takes strokes on the four hardest holes and nowhere else', () => {
    // si 1-4 are holes 5, 11, 3 and 18.
    expect(holesWithStrokes(2.0)).toEqual([5, 11, 3, 18]);

    const allocation = strokeAllocation(BANDON, blackTee, 4);
    for (const hole of BANDON.holes) {
      expect(allocation.get(hole.hole)).toBe(hole.si <= 4 ? 1 : 0);
    }
  });

  it('HI 12.0 -> playing handicap 16, with an inclusive si boundary at 16', () => {
    // 12.0 * (143/113) + 1.5 = 16.686 -> 17; 17 * 0.95 = 16.15 -> 16
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      BANDON,
      BLACK,
      12.0,
      'men',
    );
    expect(ch).toBe(17);
    expect(ph).toBe(16);

    expect(strokesReceivedOnHole(16, ph)).toBe(1); // si 16 is inside the allowance
    expect(strokesReceivedOnHole(17, ph)).toBe(0); // si 17 is not
    expect(holesWithStrokes(12.0)).toHaveLength(16);
    // si 17 and 18 are holes 6 and 12 on this card.
    expect(holesWithStrokes(12.0)).not.toContain(holeAtSi(17));
    expect(holesWithStrokes(12.0)).not.toContain(holeAtSi(18));
  });

  it('HI 18.0 -> playing handicap 23, a stroke everywhere and an inclusive second at si 5', () => {
    // 18.0 * (143/113) + 1.5 = 24.279 -> 24; 24 * 0.95 = 22.8 -> 23
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      BANDON,
      BLACK,
      18.0,
      'men',
    );
    expect(ch).toBe(24);
    expect(ph).toBe(23);

    for (let si = 1; si <= 18; si += 1) {
      expect(strokesReceivedOnHole(si, ph)).toBe(si <= 23 - 18 ? 2 : 1);
    }
    expect(strokesReceivedOnHole(5, ph)).toBe(2); // si 5 == ph - 18, inclusive
    expect(strokesReceivedOnHole(6, ph)).toBe(1);
  });

  it('HI 26.0 doubles up on the lowest si holes', () => {
    // 26.0 * (143/113) + 1.5 = 34.403 -> 34; 34 * 0.95 = 32.3 -> 32
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      BANDON,
      BLACK,
      26.0,
      'men',
    );
    expect(ch).toBe(34);
    expect(ph).toBe(32);

    const allocation = strokeAllocation(BANDON, blackTee, ph);
    // Two strokes on si 1-14, one on si 15-18.
    for (const hole of BANDON.holes) {
      expect(allocation.get(hole.hole)).toBe(hole.si <= 14 ? 2 : 1);
    }
    expect(allocation.get(holeAtSi(1))).toBe(2);
    expect(allocation.get(holeAtSi(2))).toBe(2);
    expect(allocation.get(holeAtSi(3))).toBe(2);
    // Total strokes handed out equals the playing handicap.
    const handedOut = [...allocation.values()].reduce((a, b) => a + b, 0);
    expect(handedOut).toBe(32);
  });

  it('a plus index gives strokes back from si 18 down', () => {
    // -2.0 * (143/113) + 1.5 = -1.031 -> -1; -1 * 0.95 = -0.95 -> -1
    const { courseHandicap: ch, playingHandicap: ph } = playingHandicapForRound(
      BANDON,
      BLACK,
      -2.0,
      'men',
    );
    expect(ch).toBe(-1);
    expect(ph).toBe(-1);

    expect(strokesReceivedOnHole(18, ph)).toBe(-1);
    expect(strokesReceivedOnHole(17, ph)).toBe(0);

    // A deeper plus handicap gives back further up the card.
    expect(strokesReceivedOnHole(18, -2)).toBe(-1);
    expect(strokesReceivedOnHole(17, -2)).toBe(-1);
    expect(strokesReceivedOnHole(16, -2)).toBe(0);
    expect(strokesReceivedOnHole(1, -2)).toBe(0);

    const allocation = strokeAllocation(BANDON, blackTee, ph);
    expect(allocation.get(holeAtSi(18))).toBe(-1);
    expect([...allocation.values()].reduce((a, b) => a + b, 0)).toBe(-1);
  });

  it('is computed per round, so the same index differs by course and tee', () => {
    const easier = {
      ...BANDON,
      tees: [
        {
          name: 'Green',
          men: { rating: 68.0, slope: 113 },
          women: { rating: 68.0, slope: 113 },
          yards: Array(18).fill(300),
        },
      ],
    };
    // 12 * (113/113) + (68 - 72) = 8; 8 * 0.95 = 7.6 -> 8
    expect(playingHandicapForRound(BANDON, BLACK, 12.0, 'men').playingHandicap).toBe(16);
    expect(playingHandicapForRound(easier, 'Green', 12.0, 'men').playingHandicap).toBe(8);
  });

  it('rejects a stroke index outside 1-18', () => {
    expect(() => strokesReceivedOnHole(0, 10)).toThrowError(/1-18/);
    expect(() => strokesReceivedOnHole(19, 10)).toThrowError(/1-18/);
  });
});

describe("the men's and women's ratings are both honoured", () => {
  it('reads whichever of the two the player is scored against', () => {
    const trailsBlack = getTee(TRAILS, BLACK);
    expect(ratingFor(trailsBlack, 'men')).toEqual({ rating: 74.9, slope: 136 });
    expect(ratingFor(trailsBlack, 'women')).toEqual({ rating: 80.3, slope: 146 });
  });

  it('is worth seven shots off Bandon Trails Black at a 12.0 index', () => {
    // men:   12 * (136/113) + (74.9 - 71) = 18.34 -> 18; 18 * 0.95 = 17.1 -> 17
    // women: 12 * (146/113) + (80.3 - 71) = 24.80 -> 25; 25 * 0.95 = 23.75 -> 24
    const men = playingHandicapForRound(TRAILS, BLACK, 12.0, 'men');
    const women = playingHandicapForRound(TRAILS, BLACK, 12.0, 'women');

    expect(men).toEqual({ courseHandicap: 18, playingHandicap: 17 });
    expect(women).toEqual({ courseHandicap: 25, playingHandicap: 24 });
    expect(women.playingHandicap - men.playingHandicap).toBe(7);
  });

  it('carries the rating set it used onto the result', () => {
    const card: Strokes[] = Array(18).fill(5);
    expect(scoreRound(TRAILS, BLACK, 12.0, 'men', card).ratingSet).toBe('men');
    expect(scoreRound(TRAILS, BLACK, 12.0, 'women', card).ratingSet).toBe('women');
  });

  it('gives the bigger allowance more points off the same gross', () => {
    const card: Strokes[] = Array(18).fill(5);
    const men = scoreRound(TRAILS, BLACK, 12.0, 'men', card);
    const women = scoreRound(TRAILS, BLACK, 12.0, 'women', card);
    expect(women.points).toBeGreaterThan(men.points);
    expect(women.grossTotal).toBe(men.grossTotal);
  });

  it('agrees with courseHandicap called directly', () => {
    const trailsBlack = getTee(TRAILS, BLACK);
    expect(courseHandicap(12.0, trailsBlack, 71, 'men')).toBe(18);
    expect(courseHandicap(12.0, trailsBlack, 71, 'women')).toBe(25);
    expect(playingHandicap(25)).toBe(24);
  });
});

describe("a tee with its own handicap row on the card", () => {
  it('uses the tee row rather than the course row', () => {
    // Bandon Dunes prints a second Handicap row under Orange. The 5th is
    // stroke 1 off the back four tees and stroke 7 off Orange.
    expect(BANDON.holes.find((h) => h.hole === 5)!.si).toBe(1);
    expect(orangeTee.si![4]).toBe(7);

    expect(holesForTee(BANDON, blackTee).find((h) => h.hole === 5)!.si).toBe(1);
    expect(holesForTee(BANDON, orangeTee).find((h) => h.hole === 5)!.si).toBe(7);
  });

  it('leaves a tee without its own row on the course row', () => {
    expect(blackTee.si).toBeUndefined();
    expect(holesForTee(BANDON, blackTee)).toEqual(
      [...BANDON.holes].sort((a, b) => a.hole - b.hole),
    );
  });

  it('moves which holes a shot falls on', () => {
    // A single stroke goes to si 1 — hole 5 off Black, hole 3 off Orange.
    const black = strokeAllocation(BANDON, blackTee, 1);
    const orange = strokeAllocation(BANDON, orangeTee, 1);
    expect(black.get(5)).toBe(1);
    expect(black.get(3)).toBe(0);
    expect(orange.get(3)).toBe(1);
    expect(orange.get(5)).toBe(0);
  });

  it('reports the stroke index it actually scored off', () => {
    const card: Strokes[] = Array(18).fill(4);
    const result = scoreRound(BANDON, 'Orange', 12.0, 'men', card);
    expect(result.holes.find((h) => h.hole === 5)!.si).toBe(7);
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

describe('scoreRound on Bandon Dunes Black', () => {
  it('carries a picked-up hole through as 0 points and leaves it out of the gross', () => {
    const card: Strokes[] = Array(18).fill(4);
    card[6] = null; // picked up on hole 7

    const result = scoreRound(BANDON, BLACK, 12.0, 'men', card);
    const hole7 = result.holes[6]!;

    expect(hole7.strokes).toBeNull();
    expect(hole7.net).toBeNull();
    expect(hole7.points).toBe(0);
    expect(result.holesPickedUp).toBe(1);
    expect(result.grossTotal).toBe(17 * 4);
    expect(Number.isFinite(result.points)).toBe(true);
  });

  it('matches a hand-computed card for a 12.0 index (playing handicap 16)', () => {
    // Strokes on si 1-16 — i.e. every hole except 6 (si 17) and 12 (si 18).
    // Hole 9 is picked up.
    //
    // hole par si  gross  shot  net   result        pts
    //   1   4  13    5     +1    4    par            2
    //   2   3  15    4     +1    3    par            2
    //   3   5   3    6     +1    5    par            2
    //   4   4   5    5     +1    4    par            2
    //   5   4   1    6     +1    5    bogey          1
    //   6   3  17    3      0    3    par            2
    //   7   4   7    4     +1    3    birdie         3
    //   8   4  11    5     +1    4    par            2
    //   9   5   9   pick    0   null  picked up      0
    //  10   4   8    4     +1    3    birdie         3
    //  11   4   2    5     +1    4    par            2
    //  12   3  18    4      0    4    bogey          1
    //  13   5   6    6     +1    5    par            2
    //  14   4  16    5     +1    4    par            2
    //  15   3  14    3     +1    2    birdie         3
    //  16   4  10    4     +1    3    birdie         3
    //  17   4  12    5     +1    4    par            2
    //  18   5   4    7     +1    6    bogey          1
    //                                          front 16
    //                                           back 19
    //                                          total 35
    const card: Strokes[] = [
      5, 4, 6, 5, 6, 3, 4, 5, null,
      4, 5, 4, 6, 5, 3, 4, 5, 7,
    ];
    const expectedPoints = [
      2, 2, 2, 2, 1, 2, 3, 2, 0,
      3, 2, 1, 2, 2, 3, 3, 2, 1,
    ];

    const result = scoreRound(BANDON, BLACK, 12.0, 'men', card);

    expect(result.courseHandicap).toBe(17);
    expect(result.playingHandicap).toBe(16);
    expect(result.holes.map((h) => h.points)).toEqual(expectedPoints);
    expect(result.holes.slice(0, 9).reduce((s, h) => s + h.points, 0)).toBe(16);
    expect(result.holes.slice(9).reduce((s, h) => s + h.points, 0)).toBe(19);
    expect(result.points).toBe(35);
    expect(result.grossTotal).toBe(81); // 17 holes; hole 9 was picked up
    expect(result.holesPickedUp).toBe(1);
    expect(result.courseName).toBe('Bandon Dunes');
    expect(result.teeName).toBe('Black');
    expect(result.ratingSet).toBe('men');
  });

  it('matches a hand-computed card for a plus-2 index', () => {
    // Playing handicap -1: one stroke is given back, on hole 12 (si 18).
    // Level par everywhere except an eagle on hole 3 (par 5 in 3) and a bogey
    // on hole 12 (par 3 in 4, net 5 with the shot given back -> double -> 0).
    const card: Strokes[] = [
      4, 3, 3, 4, 4, 3, 4, 4, 5,
      4, 4, 4, 5, 4, 3, 4, 4, 5,
    ];

    const result = scoreRound(BANDON, BLACK, -2.0, 'men', card);

    expect(result.playingHandicap).toBe(-1);
    expect(result.holes[2]!.points).toBe(4); // hole 3: eagle
    expect(result.holes[11]!.net).toBe(5); // hole 12: 4 + 1 given back
    expect(result.holes[11]!.points).toBe(0); // net double bogey
    // 16 holes at level par (2 each) + 4 + 0
    expect(result.points).toBe(16 * 2 + 4 + 0);
    expect(result.grossTotal).toBe(71);
    expect(result.holesPickedUp).toBe(0);
  });

  it('scores a scratch card as gross Stableford plus the allowance', () => {
    const card: Strokes[] = [...BANDON.holes]
      .sort((a, b) => a.hole - b.hole)
      .map((h) => h.par);
    const result = scoreRound(BANDON, BLACK, 0, 'men', card);
    expect(result.courseHandicap).toBe(2); // 0 * slope + 1.5 -> 2
    expect(result.playingHandicap).toBe(2);
    expect(result.holes.find((h) => h.si === 1)?.points).toBe(3); // net birdie
    expect(result.points).toBe(16 * 2 + 2 * 3);
  });

  it('rejects a card that is not 18 holes', () => {
    expect(() => scoreRound(BANDON, BLACK, 12, 'men', Array(17).fill(4))).toThrowError(
      /Expected 18 hole scores/,
    );
  });

  it('rejects nonsense strokes', () => {
    const card: Strokes[] = Array(18).fill(4);
    card[0] = 0;
    expect(() => scoreRound(BANDON, BLACK, 12, 'men', card)).toThrowError(
      /Hole 1 has strokes 0/,
    );
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
    const r1 = scoreRound(BANDON, BLACK, 12.0, 'men', card);
    const r2 = scoreRound(BANDON, BLACK, 12.0, 'men', card);
    expect(totalPoints([])).toBe(0);
    expect(totalPoints([r1, r2])).toBe(r1.points * 2);
  });
});

describe('getCourse', () => {
  it('names the ids it knows when asked for one it does not', () => {
    expect(() => getCourse('lido')).toThrowError(/bandon-dunes/);
  });
});
