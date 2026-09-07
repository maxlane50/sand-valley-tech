/**
 * The tee sheet: five rounds over three days, two groups a side.
 *
 * Transcribed from sand_valley_tee_sheet.xlsx, "Tee Sheet" tab. Only three of
 * these five rounds are played for the Cup — but which three is *not* recorded
 * here. A round counts when its date and course match a day in
 * src/config/schedule.ts, so the two files can never disagree about what is
 * being scored. See `isCupRound` in src/lib/teeSheet.ts.
 *
 * The workbook's second tab, "Pairings", is deliberately not transcribed: every
 * figure on it is derivable from the groups below, and a copied matrix would go
 * stale the first time somebody moves a name. src/lib/teeSheet.ts computes it.
 *
 * `courseId` must match an id in src/data/courses.json. The Commons and Sandbox
 * are in there as name-only stubs: they are never scored, so they carry no card.
 */

/** One group going off in a round. */
export interface TeeSheetGroup {
  /** 1-based, in the order they go off. */
  number: number;
  /**
   * Clock time, as it would be read off a starting sheet — '8:40', '1:20'.
   * Null until the resort confirms one; the round's AM/PM slot carries the
   * time of day in the meantime, and the column disappears entirely while
   * every group is still null.
   */
  time: string | null;
  /** First names, in the order the sheet lists them. */
  players: readonly string[];
}

export interface TeeSheetRound {
  /** Local calendar day, `YYYY-MM-DD` — the same field the schedule uses. */
  date: string;
  slot: 'AM' | 'PM';
  /** Matches an id in src/data/courses.json. */
  courseId: string;
  /** Set when the round is not a standard 18, e.g. '12 holes', 'par 3'. */
  note?: string;
  groups: readonly TeeSheetGroup[];
}

export const TEE_SHEET: readonly TeeSheetRound[] = [
  {
    date: '2026-09-11',
    slot: 'AM',
    courseId: 'the-commons',
    note: '12 holes',
    groups: [
      { number: 1, time: '9:50', players: ['Leo', 'Jack', 'Pat'] },
      { number: 2, time: '10:00', players: ['Lane', 'Bryce'] },
    ],
  },
  {
    date: '2026-09-11',
    slot: 'PM',
    courseId: 'sand-valley',
    groups: [
      { number: 1, time: '3:00', players: ['Lane', 'Leo', 'Evan', 'Raynal'] },
      { number: 2, time: '3:10', players: ['Jack', 'Pat', 'Bryce'] },
    ],
  },
  {
    date: '2026-09-12',
    slot: 'AM',
    courseId: 'sandbox',
    note: 'par 3',
    groups: [
      { number: 1, time: '8:30', players: ['Leo', 'Bryce', 'Raynal', 'Henry'] },
      { number: 2, time: '8:42', players: ['Lane', 'Jack', 'Pat'] },
    ],
  },
  {
    date: '2026-09-12',
    slot: 'PM',
    courseId: 'sedge-valley',
    groups: [
      { number: 1, time: '2:20', players: ['Lane', 'Jack', 'Evan', 'Henry'] },
      { number: 2, time: '2:30', players: ['Leo', 'Pat', 'Raynal'] },
    ],
  },
  {
    date: '2026-09-13',
    slot: 'AM',
    courseId: 'lido',
    groups: [
      { number: 1, time: '9:40', players: ['Leo', 'Pat', 'Bryce', 'Evan'] },
      { number: 2, time: '9:50', players: ['Lane', 'Jack', 'Raynal'] },
    ],
  },
];

/**
 * The eight on the trip, in the order the workbook's Pairings tab lists them —
 * which is the order the matrix is drawn in.
 *
 * Written out rather than derived so the order is the sheet's own, but a test
 * asserts it holds exactly the names that appear in the groups above. Add
 * somebody to a group without adding them here and that test fails.
 */
export const TEE_SHEET_ROSTER: readonly string[] = [
  'Lane',
  'Leo',
  'Jack',
  'Pat',
  'Bryce',
  'Evan',
  'Raynal',
  'Henry',
];
