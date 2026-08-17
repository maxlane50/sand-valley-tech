import { describe, expect, it } from 'vitest';

import { SCHEDULE } from '../config/schedule';
import { COURSES } from '../data/courses';
import { dayState, daysBetween, formatDay, parseDate, startOfDay } from './schedule';

/** Local wall-clock time, which is what the schedule is compared against. */
const at = (
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): Date => new Date(year, month - 1, day, hour, minute);

describe('parseDate', () => {
  it('reads an ISO date as local midnight, not UTC midnight', () => {
    const date = parseDate('2026-09-11');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8); // September
    expect(date.getDate()).toBe(11);
    expect(date.getHours()).toBe(0);
  });

  it('rejects anything that is not YYYY-MM-DD', () => {
    expect(() => parseDate('9/11/2026')).toThrow(/YYYY-MM-DD/);
  });
});

describe('daysBetween', () => {
  it('ignores the clock', () => {
    expect(daysBetween(at(2026, 9, 11, 23, 59), at(2026, 9, 12, 0, 1))).toBe(1);
  });

  it('counts backwards as negative', () => {
    expect(daysBetween(at(2026, 9, 13), at(2026, 9, 11))).toBe(-2);
  });

  it('is zero across a single day', () => {
    expect(daysBetween(at(2026, 9, 12, 0, 0), at(2026, 9, 12, 23, 59))).toBe(0);
  });

  it('still counts one day across a DST change', () => {
    // 8 March 2026 is the US spring-forward: a 23-hour local day. Truncating
    // the division would report 0.
    expect(daysBetween(at(2026, 3, 7), at(2026, 3, 8))).toBe(1);
  });
});

describe('startOfDay', () => {
  it('keeps the calendar day and drops the time', () => {
    const start = startOfDay(at(2026, 9, 12, 22, 45));
    expect(start.getDate()).toBe(12);
    expect(start.getHours()).toBe(0);
  });
});

describe('formatDay', () => {
  it('derives the weekday rather than trusting a hand-typed label', () => {
    expect(formatDay('2026-09-11')).toEqual({ weekday: 'Fri', date: 'Sep 11' });
    expect(formatDay('2026-09-12')).toEqual({ weekday: 'Sat', date: 'Sep 12' });
    expect(formatDay('2026-09-13')).toEqual({ weekday: 'Sun', date: 'Sep 13' });
  });
});

describe('dayState', () => {
  it('holds a day at "today" from midnight to midnight', () => {
    expect(dayState('2026-09-12', at(2026, 9, 12, 0, 0))).toBe('today');
    expect(dayState('2026-09-12', at(2026, 9, 12, 23, 59))).toBe('today');
  });

  it('separates played days from days to come', () => {
    const duringRound2 = at(2026, 9, 12);
    expect(dayState('2026-09-11', duringRound2)).toBe('past');
    expect(dayState('2026-09-13', duringRound2)).toBe('upcoming');
  });
});

describe('the configured schedule', () => {
  it('points every day at a course that exists in courses.json', () => {
    for (const day of SCHEDULE) {
      expect(COURSES.map((course) => course.id)).toContain(day.courseId);
    }
  });

  it('is in date order and has no repeated day', () => {
    const dates = SCHEDULE.map((day) => day.date);
    expect(dates).toEqual([...dates].sort());
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('falls on the days the trip was booked for', () => {
    expect(SCHEDULE.map((day) => formatDay(day.date))).toEqual([
      { weekday: 'Fri', date: 'Sep 11' },
      { weekday: 'Sat', date: 'Sep 12' },
      { weekday: 'Sun', date: 'Sep 13' },
    ]);
  });
});
