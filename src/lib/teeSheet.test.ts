import { describe, expect, it } from 'vitest';

import { SCHEDULE } from '../config/schedule';
import { TEE_SHEET, TEE_SHEET_ROSTER, type TeeSheetRound } from '../config/teeSheet';
import { COURSES } from '../data/courses';
import {
  buildPairings,
  groupByDay,
  groupFor,
  hasTimes,
  isCupRound,
  rosterFromRounds,
} from './teeSheet';

/**
 * The first block checks the transcription itself against the workbook. The
 * second checks the derivations, using the matrix on the workbook's "Pairings"
 * tab as the expected answer — the one place a hand-copied figure is worth
 * keeping, because it is the independent check on the code that replaces it.
 */

describe('the transcribed tee sheet', () => {
  it('has five rounds over three days', () => {
    expect(TEE_SHEET).toHaveLength(5);
    expect(groupByDay()).toHaveLength(3);
  });

  it('sends two groups off in every round', () => {
    for (const round of TEE_SHEET) expect(round.groups).toHaveLength(2);
  });

  it('numbers the groups in the order they go off', () => {
    for (const round of TEE_SHEET) {
      expect(round.groups.map((group) => group.number)).toEqual([1, 2]);
    }
  });

  it('never puts more than four in a group', () => {
    for (const round of TEE_SHEET) {
      for (const group of round.groups) {
        expect(group.players.length).toBeGreaterThan(0);
        expect(group.players.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('never lists the same player twice in one round', () => {
    for (const round of TEE_SHEET) {
      const names = round.groups.flatMap((group) => group.players);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('points every round at a course in courses.json', () => {
    const ids = new Set(COURSES.map((course) => course.id));
    for (const round of TEE_SHEET) expect(ids).toContain(round.courseId);
  });

  it('lists a roster holding exactly the names in the groups', () => {
    expect([...TEE_SHEET_ROSTER].sort()).toEqual([...rosterFromRounds()].sort());
  });

  it('orders days, and puts AM before PM within a day', () => {
    expect(groupByDay().map((day) => day.date)).toEqual([
      '2026-09-11',
      '2026-09-12',
      '2026-09-13',
    ]);
    expect(groupByDay().map((day) => day.rounds.map((round) => round.slot))).toEqual([
      ['AM', 'PM'],
      ['AM', 'PM'],
      ['AM'],
    ]);
  });
});

describe('isCupRound', () => {
  it('counts exactly the three rounds on the schedule', () => {
    const cup = TEE_SHEET.filter((round) => isCupRound(round));
    expect(cup.map((round) => round.courseId)).toEqual([
      'sand-valley',
      'sedge-valley',
      'lido',
    ]);
  });

  it('leaves the side rounds out', () => {
    const side = TEE_SHEET.filter((round) => !isCupRound(round));
    expect(side.map((round) => round.courseId)).toEqual(['the-commons', 'sandbox']);
  });

  it('needs the course to match as well as the day', () => {
    // Friday is on the schedule, but for Sand Valley — not for the morning
    // twelve at The Commons.
    const commons = TEE_SHEET[0]!;
    expect(commons.date).toBe(SCHEDULE[0]!.date);
    expect(isCupRound(commons)).toBe(false);
  });

  it('is false against an empty schedule', () => {
    for (const round of TEE_SHEET) expect(isCupRound(round, [])).toBe(false);
  });
});

describe('groupFor', () => {
  it('finds the group a player is in', () => {
    expect(groupFor(TEE_SHEET[0]!, 'Lane')?.number).toBe(2);
    expect(groupFor(TEE_SHEET[0]!, 'Leo')?.number).toBe(1);
  });

  it('returns null for somebody sitting the round out', () => {
    expect(groupFor(TEE_SHEET[0]!, 'Henry')).toBeNull();
  });
});

describe('hasTimes', () => {
  it('is true now that the resort has confirmed every group', () => {
    expect(hasTimes()).toBe(true);
    for (const round of TEE_SHEET) {
      for (const group of round.groups) expect(group.time).not.toBeNull();
    }
  });

  it('is false while every group is still waiting on one', () => {
    const pending: TeeSheetRound[] = [
      { ...TEE_SHEET[0]!, groups: [{ number: 1, time: null, players: ['Lane'] }] },
    ];
    expect(hasTimes(pending)).toBe(false);
  });
});

describe('the confirmed times', () => {
  it('puts the earlier group off first in every round', () => {
    // Both groups in a round share a slot, so a plain string compare on
    // zero-padded 24-hour time is enough to catch a transposed pair.
    const minutes = (time: string, slot: 'AM' | 'PM') => {
      const [hour, minute] = time.split(':').map(Number) as [number, number];
      const hour24 = slot === 'PM' && hour !== 12 ? hour + 12 : hour;
      return hour24 * 60 + minute;
    };
    for (const round of TEE_SHEET) {
      const offAt = round.groups.map((group) => minutes(group.time!, round.slot));
      expect(offAt).toEqual([...offAt].sort((a, b) => a - b));
    }
  });

  it('reads the times off the resort booking', () => {
    expect(
      TEE_SHEET.map((round) => round.groups.map((group) => group.time)),
    ).toEqual([
      ['9:50', '10:00'],
      ['3:00', '3:10'],
      ['8:30', '8:42'],
      ['2:20', '2:30'],
      ['9:40', '9:50'],
    ]);
  });
});

describe('buildPairings', () => {
  /**
   * The workbook's Pairings tab, copied out. This is the check on the
   * derivation: the app never reads these numbers, it recomputes them.
   */
  const WORKBOOK: Record<string, Record<string, number>> = {
    Lane: { Leo: 1, Jack: 3, Pat: 1, Bryce: 1, Evan: 2, Raynal: 2, Henry: 1 },
    Leo: { Lane: 1, Jack: 1, Pat: 3, Bryce: 2, Evan: 2, Raynal: 3, Henry: 1 },
    Jack: { Lane: 3, Leo: 1, Pat: 3, Bryce: 1, Evan: 1, Raynal: 1, Henry: 1 },
    Pat: { Lane: 1, Leo: 3, Jack: 3, Bryce: 2, Evan: 1, Raynal: 1, Henry: 0 },
    Bryce: { Lane: 1, Leo: 2, Jack: 1, Pat: 2, Evan: 1, Raynal: 1, Henry: 1 },
    Evan: { Lane: 2, Leo: 2, Jack: 1, Pat: 1, Bryce: 1, Raynal: 1, Henry: 1 },
    Raynal: { Lane: 2, Leo: 3, Jack: 1, Pat: 1, Bryce: 1, Evan: 1, Henry: 1 },
    Henry: { Lane: 1, Leo: 1, Jack: 1, Pat: 0, Bryce: 1, Evan: 1, Raynal: 1 },
  };

  const pairings = buildPairings();

  it('reproduces every figure on the workbook matrix', () => {
    for (const [name, row] of Object.entries(WORKBOOK)) {
      for (const [other, expected] of Object.entries(row)) {
        expect(pairings.together(name, other)).toBe(expected);
      }
    }
  });

  it('is symmetric, and zero against yourself', () => {
    for (const a of TEE_SHEET_ROSTER) {
      expect(pairings.together(a, a)).toBe(0);
      for (const b of TEE_SHEET_ROSTER) {
        expect(pairings.together(a, b)).toBe(pairings.together(b, a));
      }
    }
  });

  it('is zero for a name that is not on the sheet', () => {
    expect(pairings.together('Lane', 'Nobody')).toBe(0);
  });

  it('finds the pair who never share a group', () => {
    expect(pairings.neverTogether).toEqual([['Pat', 'Henry']]);
  });

  it('reports the most rounds any pair share', () => {
    expect(pairings.most).toBe(3);
  });

  it('counts the rounds each player is out for', () => {
    const rounds = Object.fromEntries(
      pairings.players.map((player) => [player.name, player.rounds]),
    );
    expect(rounds).toEqual({
      Lane: 5,
      Leo: 5,
      Jack: 5,
      Pat: 5,
      Bryce: 4,
      Evan: 3,
      Raynal: 4,
      Henry: 2,
    });
  });

  it('counts how many of those are scored for the Cup', () => {
    const cup = Object.fromEntries(
      pairings.players.map((player) => [player.name, player.cupRounds]),
    );
    // Sedge Valley swaps Bryce out for Henry, so neither plays all three.
    expect(cup).toEqual({
      Lane: 3,
      Leo: 3,
      Jack: 3,
      Pat: 3,
      Bryce: 2,
      Evan: 3,
      Raynal: 3,
      Henry: 1,
    });
  });

  it('lines a player up with their group in every round', () => {
    const lane = pairings.players.find((player) => player.name === 'Lane')!;
    expect(lane.groups.map((group) => group?.number ?? null)).toEqual([2, 1, 2, 1, 2]);

    const henry = pairings.players.find((player) => player.name === 'Henry')!;
    expect(henry.groups.map((group) => group?.number ?? null)).toEqual([
      null,
      null,
      1,
      1,
      null,
    ]);
  });

  it('counts distinct partners', () => {
    const partners = Object.fromEntries(
      pairings.players.map((player) => [player.name, player.partners]),
    );
    expect(partners.Pat).toBe(6);
    expect(partners.Henry).toBe(6);
    expect(partners.Evan).toBe(7);
  });

  it('knows when a player could not have met everybody', () => {
    const byName = new Map(pairings.players.map((player) => [player.name, player]));
    // Two rounds in groups of four: six partners at the very most.
    expect(byName.get('Henry')!.reachable).toBe(6);
    // Pat plays all five and could have met the field, but never draws Henry.
    expect(byName.get('Pat')!.reachable).toBe(7);
    expect(byName.get('Pat')!.partners).toBe(6);
  });

  it('handles a sheet with nobody on it', () => {
    const empty = buildPairings([], []);
    expect(empty.players).toEqual([]);
    expect(empty.neverTogether).toEqual([]);
    expect(empty.most).toBe(0);
  });
});
