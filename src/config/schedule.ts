import lidoLogo from '../assets/lido.png';
import sandValleyLogo from '../assets/sand-valley.png';
import sedgeValleyLogo from '../assets/sedge-valley.png';

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
  { date: '2026-09-11', courseId: 'sand-valley', logo: sandValleyLogo },
  { date: '2026-09-12', courseId: 'sedge-valley', logo: sedgeValleyLogo },
  { date: '2026-09-13', courseId: 'lido', logo: lidoLogo },
];
