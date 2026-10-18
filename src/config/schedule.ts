import bandonDunesLogo from '../assets/bandon-dunes.png';
import bandonTrailsLogo from '../assets/bandon-trails.png';
import pacificDunesLogo from '../assets/pacific-dunes.png';

/*
 * The marks are the icon only — the puffin, the fish roundel, the butterfly —
 * cut from the resort's sticker sheet (CourseLogos.png, untracked alongside
 * the scorecards). The wordmark that comes with each one is unreadable at
 * --logo-w and only repeats the course name set beside it.
 *
 * Crop boxes on that 1440x1800 sheet, should they ever need recutting:
 *   puffin        (319,162)-(528,283)
 *   fish roundel  (933,987)-(1137,1134)
 *   butterfly    (1012,120)-(1155,259)
 *
 * Each is centred on a white square sized from the geometric mean of its box
 * rather than its longest side, so all three cover the same area in the box
 * and read as a set — squaring on the longest side gives the near-square
 * butterfly half again the weight of the wide puffin.
 */

/**
 * The itinerary: one course per day, in order.
 *
 * Only the date, the course id and the mark live here — the *name* is read
 * from courses.json at render time, so the schedule and the round detail can
 * never disagree about what a course is called. Reordering, adding or dropping
 * a day is an edit to this array and nothing else.
 *
 * `courseId` must match an id in src/data/courses.json.
 */
export interface ScheduleDay {
  /** Local calendar day, `YYYY-MM-DD`. */
  date: string;
  courseId: string;
  logo: string;
}

export const SCHEDULE: readonly ScheduleDay[] = [
  { date: '2026-10-24', courseId: 'bandon-dunes', logo: bandonDunesLogo },
  { date: '2026-10-25', courseId: 'pacific-dunes', logo: pacificDunesLogo },
  { date: '2026-10-26', courseId: 'bandon-trails', logo: bandonTrailsLogo },
];
