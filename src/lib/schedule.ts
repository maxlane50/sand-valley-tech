/**
 * Schedule dates.
 *
 * Everything here works on the *local calendar day*, never on clock time. A
 * round is "today" for the whole of that day wherever the phone is, so the
 * comparisons deliberately throw away hours before doing anything.
 *
 * Dates are plain ISO `YYYY-MM-DD` strings. They are parsed by hand rather
 * than with `new Date(iso)`, which reads a bare date as UTC midnight — in
 * Wisconsin that lands at 7pm the evening *before*, so the schedule would
 * light up a day early.
 */

export type DayState = 'past' | 'today' | 'upcoming';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** `YYYY-MM-DD` at local midnight. */
export function parseDate(iso: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Schedule date must be YYYY-MM-DD, got "${iso}".`);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Strips the time, leaving local midnight on the same calendar day. */
export function startOfDay(when: Date): Date {
  return new Date(when.getFullYear(), when.getMonth(), when.getDate());
}

/**
 * Whole calendar days from `from` to `to`. Rounded, not truncated: a spring
 * DST day is 23 hours long, so dividing by 86,400,000 lands just short of a
 * whole number and truncation would report one day fewer.
 */
export function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function dayState(iso: string, today: Date): DayState {
  const diff = daysBetween(today, parseDate(iso));
  if (diff === 0) return 'today';
  return diff < 0 ? 'past' : 'upcoming';
}

/** `{ weekday: 'Fri', date: 'Sep 11' }` — derived, so it can't drift. */
export function formatDay(iso: string): { weekday: string; date: string } {
  const date = parseDate(iso);
  return {
    weekday: WEEKDAYS[date.getDay()]!,
    date: `${MONTHS[date.getMonth()]!} ${date.getDate()}`,
  };
}
