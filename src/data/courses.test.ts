import { describe, expect, it } from 'vitest';

import { COURSES, getCourse } from './courses';
import { isPlayableCourse } from '../scoring/scoring';
import { RATING_SETS } from '../scoring/types';

/**
 * Guards against a mistyped scorecard.
 *
 * The first block is structural and applies to any course anyone ever adds.
 * The second holds the figures *printed on the cards* — the OUT / IN / TOTAL
 * boxes, for every set of tees — and checks the transcribed yardages add up to
 * them. Those totals are the scorecard's own checksum, which is exactly what
 * makes them worth keeping here: a single digit fat-fingered anywhere in a
 * course fails a sum. With five tees a side that is fifteen checksums per
 * course rather than one.
 *
 * Cards are the three Bandon scorecards, rated for both men and women.
 */

const playable = COURSES.filter(isPlayableCourse);

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
const front = <T>(items: readonly T[]) => items.slice(0, 9);
const back = <T>(items: readonly T[]) => items.slice(9);

describe.each(playable.map((course) => [course.name, course] as const))(
  'the %s card',
  (_name, course) => {
    it('has 18 holes, numbered 1 to 18 in order', () => {
      expect(course.holes.map((hole) => hole.hole)).toEqual(
        Array.from({ length: 18 }, (_, i) => i + 1),
      );
    });

    it('uses each stroke index exactly once', () => {
      expect([...course.holes.map((hole) => hole.si)].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 18 }, (_, i) => i + 1),
      );
    });

    it('splits the stroke indexes odd on the front, even on the back', () => {
      // Near-universal convention, and the fastest way to catch a nine that
      // has been transcribed against the wrong row.
      expect(front(course.holes).every((hole) => hole.si % 2 === 1)).toBe(true);
      expect(back(course.holes).every((hole) => hole.si % 2 === 0)).toBe(true);
    });

    it('has pars that sum to the course par', () => {
      expect(sum(course.holes.map((hole) => hole.par))).toBe(course.par);
    });

    it('has a plausible par on every hole', () => {
      for (const hole of course.holes) expect(hole.par).toBeGreaterThanOrEqual(3);
      for (const hole of course.holes) expect(hole.par).toBeLessThanOrEqual(5);
    });

    it('rates every tee for both men and women', () => {
      expect(course.tees.length).toBeGreaterThan(0);
      for (const tee of course.tees) {
        for (const set of RATING_SETS) {
          // The USGA slope range. A slope outside it is a typo, not a course.
          expect(tee[set].slope).toBeGreaterThanOrEqual(55);
          expect(tee[set].slope).toBeLessThanOrEqual(155);
          expect(tee[set].rating).toBeGreaterThan(55);
          expect(tee[set].rating).toBeLessThan(85);
        }
      }
    });

    it("rates every tee higher for women than for men", () => {
      // The same yardage plays longer relative to a women's scratch player, so
      // the women's rating is always the higher of the printed pair. A tee
      // where it is not has had its two rows swapped.
      for (const tee of course.tees) {
        expect(tee.women.rating).toBeGreaterThan(tee.men.rating);
      }
    });

    it('names every tee exactly once', () => {
      const names = course.tees.map((tee) => tee.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('carries 18 yardages for every tee', () => {
      for (const tee of course.tees) {
        expect(tee.yards).toHaveLength(18);
        for (const y of tee.yards) expect(y).toBeGreaterThan(50);
      }
    });

    it('gets longer as the tees get harder', () => {
      // Rating rises with length, for both sets. If a rating and a yardage
      // disagree about the order of the tees, one of the two rows was misread.
      for (const set of RATING_SETS) {
        const byRating = [...course.tees].sort((a, b) => a[set].rating - b[set].rating);
        const yards = byRating.map((tee) => sum(tee.yards));
        expect(yards).toEqual([...yards].sort((a, b) => a - b));
      }
    });

    it('gives any tee with its own handicap row a complete stroke index', () => {
      for (const tee of course.tees) {
        if (!tee.si) continue;
        expect(tee.si).toHaveLength(18);
        expect([...tee.si].sort((a, b) => a - b)).toEqual(
          Array.from({ length: 18 }, (_, i) => i + 1),
        );
        expect(front(tee.si).every((si) => si % 2 === 1)).toBe(true);
        expect(back(tee.si).every((si) => si % 2 === 0)).toBe(true);
        // A row identical to the course's own is a transcription slip, not a
        // second allocation — drop it rather than carry it twice.
        expect(tee.si).not.toEqual(course.holes.map((hole) => hole.si));
      }
    });
  },
);

describe('the figures printed on the cards', () => {
  /**
   * Par OUT / IN and the printed OUT / IN / TOTAL yardage boxes for every set
   * of tees, read straight off the three cards.
   */
  const CARDS = [
    {
      id: 'bandon-dunes',
      par: [36, 36],
      total: 72,
      tees: [
        { name: 'Black', men: [73.5, 143], women: [79.6, 145], yards: [3417, 3315, 6732] },
        { name: 'Green', men: [71.1, 133], women: [76.8, 139], yards: [3145, 3076, 6221] },
        { name: 'Gold', men: [69.1, 124], women: [74.2, 133], yards: [2938, 2778, 5716] },
        { name: 'Orange', men: [65.5, 114], women: [71.6, 126], yards: [2572, 2468, 5040] },
        { name: 'Royal Blue', men: [61.6, 105], women: [64.5, 111], yards: [2044, 1942, 3986] },
      ],
    },
    {
      id: 'pacific-dunes',
      par: [36, 35],
      total: 71,
      tees: [
        { name: 'Black', men: [73.2, 143], women: [78.9, 149], yards: [3485, 3148, 6633] },
        { name: 'Green', men: [70.8, 135], women: [76.1, 145], yards: [3217, 2925, 6142] },
        { name: 'Gold', men: [68.9, 131], women: [74.6, 142], yards: [3041, 2734, 5775] },
        { name: 'Orange', men: [65.8, 126], women: [70.3, 131], yards: [2627, 2461, 5088] },
        { name: 'Royal Blue', men: [61.5, 113], women: [63.9, 115], yards: [2032, 1888, 3920] },
      ],
    },
    {
      id: 'bandon-trails',
      par: [36, 35],
      total: 71,
      tees: [
        { name: 'Black', men: [74.9, 136], women: [80.3, 146], yards: [3419, 3369, 6788] },
        { name: 'Green', men: [72.0, 137], women: [77.4, 140], yards: [3129, 3120, 6249] },
        { name: 'Gold', men: [69.6, 132], women: [75.7, 143], yards: [2859, 2892, 5751] },
        { name: 'Orange', men: [66.6, 125], women: [71.2, 128], yards: [2513, 2584, 5097] },
        { name: 'Royal Blue', men: [63.0, 113], women: [65.2, 114], yards: [2020, 1917, 3937] },
      ],
    },
  ] as const;

  it('covers every course in courses.json', () => {
    expect(CARDS.map((card) => card.id).sort()).toEqual(
      COURSES.map((course) => course.id).sort(),
    );
  });

  it.each(CARDS)('$id adds up to the OUT, IN and TOTAL par boxes', (card) => {
    const course = getCourse(card.id);
    expect(sum(front(course.holes).map((hole) => hole.par))).toBe(card.par[0]);
    expect(sum(back(course.holes).map((hole) => hole.par))).toBe(card.par[1]);
    expect(course.par).toBe(card.total);
  });

  it.each(CARDS)('$id adds up to the printed yardages off every tee', (card) => {
    const course = getCourse(card.id);
    expect(course.tees.map((tee) => tee.name)).toEqual(card.tees.map((tee) => tee.name));

    for (const printed of card.tees) {
      const tee = course.tees.find((t) => t.name === printed.name)!;
      expect(sum(front(tee.yards))).toBe(printed.yards[0]);
      expect(sum(back(tee.yards))).toBe(printed.yards[1]);
      expect(sum(tee.yards)).toBe(printed.yards[2]);
    }
  });

  it.each(CARDS)('$id carries both printed ratings off every tee', (card) => {
    const course = getCourse(card.id);
    for (const printed of card.tees) {
      const tee = course.tees.find((t) => t.name === printed.name)!;
      expect(tee.men).toEqual({ rating: printed.men[0], slope: printed.men[1] });
      expect(tee.women).toEqual({ rating: printed.women[0], slope: printed.women[1] });
    }
  });

  it('gives the Orange tees their own handicap row on all three cards', () => {
    // Every Bandon card prints a second Handicap row under Orange, and none of
    // them repeats the main row.
    for (const card of CARDS) {
      const orange = getCourse(card.id).tees.find((tee) => tee.name === 'Orange')!;
      expect(orange.si).toBeDefined();
      expect(orange.si).toHaveLength(18);
    }
  });
});

describe('the three courses being played', () => {
  it('has all of them ready to score', () => {
    for (const id of ['bandon-dunes', 'pacific-dunes', 'bandon-trails']) {
      expect(isPlayableCourse(getCourse(id))).toBe(true);
    }
  });

  it('names the ids it knows when asked for one it does not', () => {
    expect(() => getCourse('old-macdonald')).toThrowError(/bandon-dunes/);
  });
});
