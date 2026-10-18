import { describe, expect, it } from 'vitest';

import { getCourse } from '../data/courses';
import type { Course } from '../scoring/types';
import { buildEntryCard, emptyCard, nextHoleIndex } from './entryCard';

const BANDON = getCourse('bandon-dunes');
const BLACK = 'Black';

/** A course with no card filled in yet. */
const STUB: Course = {
  id: 'old-macdonald',
  name: 'Old Macdonald',
  par: null,
  tees: [],
  holes: [],
};

describe('buildEntryCard', () => {
  it('withholds the gross total until all 18 holes are in', () => {
    const strokes = emptyCard();
    for (let i = 0; i < 17; i += 1) strokes[i] = 4;

    const partial = buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes);
    expect(partial.entered).toBe(17);
    expect(partial.complete).toBe(false);
    expect(partial.grossTotal).toBeNull();

    strokes[17] = 4;
    const full = buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes);
    expect(full.complete).toBe(true);
    expect(full.grossTotal).toBe(72);
  });

  it('runs the gross total up as holes are entered', () => {
    const strokes = emptyCard();
    expect(buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes).runningGross).toBe(0);

    strokes[0] = 5;
    expect(buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes).runningGross).toBe(5);

    strokes[1] = 4;
    const two = buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes);
    expect(two.runningGross).toBe(9);
    // Running gross is live; grossTotal stays null until the card is complete.
    expect(two.grossTotal).toBeNull();

    for (let i = 2; i < 18; i += 1) strokes[i] = 4;
    const full = buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes);
    expect(full.runningGross).toBe(5 + 4 * 17);
    expect(full.grossTotal).toBe(full.runningGross);
  });

  it('reports the playing handicap and per-hole strokes for the round', () => {
    const card = buildEntryCard(BANDON, BLACK, 12.0, 'men', emptyCard());
    expect(card.courseHandicap).toBe(17);
    expect(card.playingHandicap).toBe(16);

    // si 1-16 get a stroke; si 17 and 18 do not.
    for (const hole of card.holes) {
      expect(hole.strokesReceived).toBe(hole.si <= 16 ? 1 : 0);
    }
  });

  it('gives strokes back on a plus handicap', () => {
    const card = buildEntryCard(BANDON, BLACK, -2.0, 'men', emptyCard());
    expect(card.playingHandicap).toBe(-1);
    expect(card.holes.find((h) => h.si === 18)!.strokesReceived).toBe(-1);
    expect(card.holes.find((h) => h.si === 17)!.strokesReceived).toBe(0);
  });

  it('scores entered holes and leaves the rest null', () => {
    const strokes = emptyCard();
    strokes[2] = 6; // hole 3, par 5, si 3 -> stroke -> net 5 -> par -> 2 pts

    const card = buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes);
    expect(card.holes[2]!.net).toBe(5);
    expect(card.holes[2]!.points).toBe(2);
    expect(card.holes[0]!.points).toBeNull();
    expect(card.points).toBe(2);
    expect(card.parThru).toBe(5);
  });

  it('accumulates running points as holes go in', () => {
    const strokes = emptyCard();
    strokes[0] = 4; // hole 1, par 4, si 13 -> stroke -> net 3 -> birdie -> 3
    strokes[1] = 3; // hole 2, par 3, si 15 -> stroke -> net 2 -> birdie -> 3
    const card = buildEntryCard(BANDON, BLACK, 12.0, 'men', strokes);
    expect(card.points).toBe(6);
    expect(card.entered).toBe(2);
  });

  it('throws for a course that has not been filled in', () => {
    expect(() => buildEntryCard(STUB, BLACK, 12, 'men', emptyCard())).toThrowError(
      /Old Macdonald.*par is null/s,
    );
  });
});

describe('nextHoleIndex', () => {
  it('advances to the next hole without a score', () => {
    const strokes = emptyCard();
    strokes[0] = 4;
    expect(nextHoleIndex(strokes, 0)).toBe(1);
  });

  it('skips holes that already have a score', () => {
    const strokes = emptyCard();
    strokes[1] = 4;
    strokes[2] = 5;
    expect(nextHoleIndex(strokes, 0)).toBe(3);
  });

  it('wraps around to an earlier gap', () => {
    const strokes = emptyCard().map(() => 4 as number | null);
    strokes[2] = null;
    expect(nextHoleIndex(strokes, 10)).toBe(2);
  });

  it('steps forward when the card is full, and stops at 18', () => {
    const full = emptyCard().map(() => 4 as number | null);
    expect(nextHoleIndex(full, 5)).toBe(6);
    expect(nextHoleIndex(full, 17)).toBe(17);
  });
});
