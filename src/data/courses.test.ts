import { describe, expect, it } from 'vitest';

import { COURSES, getCourse } from './courses';
import { isPlayableCourse } from '../scoring/scoring';

/**
 * Guards against a mistyped scorecard.
 *
 * The first block is structural and applies to any course anyone ever adds.
 * The second holds the figures *printed on the card* — the OUT / IN / TOTAL
 * boxes — and checks the transcribed holes add up to them. Those totals are
 * the scorecard's own checksum, which is exactly what makes them worth
 * keeping here: a single digit fat-fingered anywhere in a course fails a sum.
 *
 * Cards are the ones in scorecards/, men's rating and slope.
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

    it('has a rating and a slope for every tee', () => {
      expect(course.tees.length).toBeGreaterThan(0);
      for (const tee of course.tees) {
        // The USGA slope range. A slope outside it is a typo, not a course.
        expect(tee.slope).toBeGreaterThanOrEqual(55);
        expect(tee.slope).toBeLessThanOrEqual(155);
        expect(tee.rating).toBeGreaterThan(55);
        expect(tee.rating).toBeLessThan(85);
      }
    });

    it('names every tee exactly once', () => {
      const names = course.tees.map((tee) => tee.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('gets longer as the tees get harder', () => {
      // Rating rises with length. If a rating and a yardage disagree about
      // the order of the tees, one of the two rows was misread.
      const byRating = [...course.tees].sort((a, b) => a.rating - b.rating);
      const yards = byRating.map((tee) => tee.yards ?? 0);
      expect(yards).toEqual([...yards].sort((a, b) => a - b));
    });
  },
);

describe('the figures printed on the cards', () => {
  /** Par OUT / IN, and the tee whose yardages went into holes[].yards. */
  const CARDS = [
    {
      id: 'lido',
      par: [37, 35],
      total: 72,
      yardageTee: 'White',
      yards: [3266, 3238, 6504],
      tees: [
        { name: 'Navy', rating: 75.2, slope: 149, yards: 6990 },
        { name: 'White', rating: 72.5, slope: 144, yards: 6504 },
        { name: 'Green', rating: 69.6, slope: 134, yards: 5943 },
      ],
    },
    {
      id: 'sand-valley',
      par: [35, 37],
      total: 72,
      yardageTee: 'Sand',
      yards: [2806, 3217, 6023],
      tees: [
        { name: 'Black', rating: 74.5, slope: 140, yards: 6959 },
        { name: 'Orange', rating: 72.8, slope: 138, yards: 6551 },
        { name: 'Sand', rating: 70.2, slope: 129, yards: 6023 },
        { name: 'Green', rating: 67.4, slope: 123, yards: 5440 },
        { name: 'Silver', rating: 63.9, slope: 113, yards: 4664 },
        { name: 'Royal Blue', rating: 60.8, slope: 100, yards: 3871 },
      ],
    },
    {
      id: 'sedge-valley',
      par: [33, 35],
      total: 68,
      yardageTee: 'Back',
      yards: [2740, 3068, 5808],
      tees: [
        { name: 'Back', rating: 68.7, slope: 130, yards: 5808 },
        { name: 'Middle', rating: 63.9, slope: 112, yards: 4790 },
        { name: 'Front', rating: 60.2, slope: 100, yards: 3753 },
      ],
    },
  ] as const;

  it.each(CARDS)('$id adds up to the OUT, IN and TOTAL par boxes', (card) => {
    const holes = getCourse(card.id).holes;
    expect(sum(front(holes).map((hole) => hole.par))).toBe(card.par[0]);
    expect(sum(back(holes).map((hole) => hole.par))).toBe(card.par[1]);
    expect(getCourse(card.id).par).toBe(card.total);
  });

  it.each(CARDS)('$id adds up to the printed $yardageTee yardages', (card) => {
    const holes = getCourse(card.id).holes;
    const yards = holes.map((hole) => hole.yards ?? 0);
    expect(sum(front(yards))).toBe(card.yards[0]);
    expect(sum(back(yards))).toBe(card.yards[1]);
    expect(sum(yards)).toBe(card.yards[2]);
  });

  it.each(CARDS)('$id carries every tee off the card, rating and slope', (card) => {
    expect(getCourse(card.id).tees).toEqual(card.tees);
  });
});

describe('courses still to come', () => {
  it('leaves Mammoth Dunes a stub, so a round cannot be scored against it', () => {
    const mammoth = getCourse('mammoth-dunes');
    expect(mammoth.par).toBeNull();
    expect(isPlayableCourse(mammoth)).toBe(false);
  });

  it('has all three courses on the schedule ready to play', () => {
    for (const id of ['sand-valley', 'sedge-valley', 'lido']) {
      expect(isPlayableCourse(getCourse(id))).toBe(true);
    }
  });
});
