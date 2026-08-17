import { getCourse } from '../data/courses';
import { SCHEDULE, type ScheduleDay } from '../config/schedule';
import { dayState, formatDay, type DayState } from '../lib/schedule';

/** The name comes from courses.json, so it always matches the round detail. */
function courseName(courseId: string): string {
  try {
    return getCourse(courseId).name;
  } catch {
    // A schedule entry pointing at an id that isn't in courses.json yet. Show
    // the id rather than blowing up the whole board over a header.
    return courseId;
  }
}

function Day({ day, state }: { day: ScheduleDay; state: DayState }) {
  const { weekday, date } = formatDay(day.date);
  const played = state === 'past';
  const playing = state === 'today';

  return (
    <li
      className={[
        // Rows run to the page edge and pad their contents back, so every
        // divider is one full-width rule and the day being played can carry a
        // band across the sheet without its edges going ragged.
        'flex min-h-sched-h items-center gap-2 border-t border-rule-soft px-gutter first:border-t-0',
        playing ? 'bg-paper' : '',
      ].join(' ')}
    >
      <img
        src={day.logo}
        alt=""
        // Intrinsic size, so the aspect ratio is known before the file lands.
        // The box itself is --logo-w square; object-contain does the fitting.
        width={180}
        height={178}
        decoding="async"
        className={`logo-print h-logo-w w-logo-w flex-none object-contain ${
          played ? 'logo-spent' : ''
        }`}
      />

      <span
        className={`min-w-0 flex-1 truncate font-display text-name leading-name ${
          played ? 'text-ink-45' : 'text-ink'
        }`}
      >
        {courseName(day.courseId)}
      </span>

      <span
        className={`flex-none font-num text-chip uppercase tracking-caption ${
          playing ? 'font-medium text-turf' : played ? 'text-ink-25' : 'text-ink-45'
        }`}
      >
        {weekday} · {date}
      </span>
    </li>
  );
}

/**
 * The itinerary, set as a fixture list under the masthead: a course mark, the
 * course, and the day right-aligned in mono so the three dates form a column —
 * the same right edge the points column makes on the board below.
 *
 * The three states are carried by ink rather than by extra furniture: a played
 * day greys out, the day being played sits on lighter stock with its date in
 * turf, and days still to come are plain.
 *
 * `today` is injectable so the states can be looked at without waiting for
 * September.
 */
export function ScheduleStrip({ today = new Date() }: { today?: Date }) {
  if (SCHEDULE.length === 0) return null;

  return (
    <section className="flex-none border-b border-rule bg-paper-2">
      {/* No heading and no rule of its own: the masthead's border closes off
          the block above, so the first day starts straight underneath it. */}
      <ol>
        {SCHEDULE.map((day) => (
          <Day key={day.date} day={day} state={dayState(day.date, today)} />
        ))}
      </ol>
    </section>
  );
}
