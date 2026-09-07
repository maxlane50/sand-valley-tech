import { getCourse } from '../../data/courses';
import type { TeeSheetGroup, TeeSheetRound } from '../../config/teeSheet';
import { dayState, formatDay } from '../../lib/schedule';
import { cupNumber, groupFor, type TeeSheetDay } from '../../lib/teeSheet';

/** The name comes from courses.json, so it always matches the rest of the app. */
function courseName(courseId: string): string {
  try {
    return getCourse(courseId).name;
  } catch {
    // A tee sheet pointing at an id that isn't in courses.json yet. Show the
    // id rather than losing the whole sheet over a heading.
    return courseId;
  }
}

/**
 * One group going off.
 *
 * The left column carries the time when there is one and the group number when
 * there isn't, because on a real starting sheet the time *is* the group's
 * name. Either way it is one mono column, so the five rounds keep a single
 * left edge down the page.
 */
function GroupRow({
  group,
  selected,
  dimmed,
}: {
  group: TeeSheetGroup;
  selected: string | null;
  /** True when another group in this round has the followed player. */
  dimmed: boolean;
}) {
  const following = selected !== null && group.players.includes(selected);

  return (
    <div
      className={`grid grid-cols-tee-group items-baseline gap-2 border-t border-rule-soft py-2 ${
        following ? 'bg-paper-shade' : ''
      }`}
    >
      <span
        className={`font-num text-chip uppercase tracking-caption ${
          dimmed ? 'text-ink-25' : following ? 'text-turf' : 'text-ink-45'
        }`}
      >
        {group.time ?? `G${group.number}`}
      </span>

      <span
        className={`font-display text-list leading-body ${
          dimmed ? 'text-ink-25' : 'text-ink'
        }`}
      >
        {group.players.map((player, index) => (
          <span key={player}>
            {index > 0 ? <span className="text-ink-25"> · </span> : null}
            <span className={player === selected ? 'font-semibold text-turf' : undefined}>
              {player}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

function Round({ round, selected }: { round: TeeSheetRound; selected: string | null }) {
  const cup = cupNumber(round);
  // Somebody is being followed and is not on this tee sheet at all: the whole
  // round greys out, so the rounds you are out for are visible at a glance.
  const sittingOut = selected !== null && groupFor(round, selected) === null;

  return (
    <div className="px-gutter pt-2 pb-1">
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`min-w-0 truncate font-display text-name leading-name ${
            sittingOut ? 'text-ink-25' : 'text-ink'
          }`}
        >
          {courseName(round.courseId)}
        </span>

        <span className="flex flex-none items-baseline gap-2 font-num text-chip uppercase tracking-caption">
          {/* Slot first, then what makes the round unusual: "AM · 12 holes"
              reads as a sentence, "12 holes AM" reads as a collision. */}
          <span className={sittingOut ? 'text-ink-25' : 'text-ink-45'}>
            {round.slot}
            {round.note ? ` · ${round.note}` : ''}
          </span>
          {cup !== null ? (
            <span
              className={`rounded-sm px-1 py-chip font-medium ${
                sittingOut ? 'bg-paper-2 text-ink-25' : 'bg-turf-deep text-paper'
              }`}
            >
              R{cup}
            </span>
          ) : null}
        </span>
      </div>

      {round.groups.map((group) => (
        <GroupRow
          key={group.number}
          group={group}
          selected={selected}
          dimmed={sittingOut || (selected !== null && !group.players.includes(selected))}
        />
      ))}
    </div>
  );
}

/**
 * One day of the trip: a dateline, then the rounds played on it.
 *
 * The day rule is the same fixture-list idiom as the schedule strip on the
 * board — weekday and date right-aligned in mono — and carries the same three
 * states, so a day already played reads as spent here too.
 */
export function DayBlock({ day, selected }: { day: TeeSheetDay; selected: string | null }) {
  const { weekday, date } = formatDay(day.date);
  const state = dayState(day.date, new Date());

  return (
    <section className="border-b border-rule">
      <div className="flex items-baseline justify-between gap-2 border-b border-rule bg-paper-2 px-gutter py-1">
        <span
          className={`font-ui text-nano font-bold uppercase tracking-eyebrow ${
            state === 'past' ? 'text-ink-25' : 'text-ink-45'
          }`}
        >
          {weekday}
        </span>
        <span
          className={`font-num text-chip uppercase tracking-caption ${
            state === 'today' ? 'font-medium text-turf' : 'text-ink-45'
          }`}
        >
          {state === 'today' ? 'today · ' : ''}
          {date}
        </span>
      </div>

      {day.rounds.map((round) => (
        <Round key={`${round.date}-${round.slot}`} round={round} selected={selected} />
      ))}
    </section>
  );
}
