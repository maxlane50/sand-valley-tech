import { useMemo, useState } from 'react';

import { DayBlock } from '../components/teesheet/DayBlock';
import { PairingMatrix } from '../components/teesheet/PairingMatrix';
import { PlayerFilter } from '../components/teesheet/PlayerFilter';
import { PlayerRounds } from '../components/teesheet/PlayerRounds';
import { TRIP } from '../config/trip';
import { TEE_SHEET } from '../config/teeSheet';
import { getCourse } from '../data/courses';
import { buildPairings, groupByDay, hasTimes, isCupRound } from '../lib/teeSheet';

/**
 * The tee sheet: five rounds, three days, two groups a side.
 *
 * The only screen in the app that reads nothing from Supabase. The sheet is
 * settled before anyone leaves for Wisconsin, so it is config, not data — which
 * means this tab opens instantly and works with no signal at all, which is the
 * state a phone is usually in on the far side of a golf course.
 *
 * Three of the five rounds are scored for the Cup and two are not, but that is
 * never written down here: a round counts when its date and course match a day
 * on the schedule. The board and the sheet cannot drift.
 *
 * One piece of state, and it is not navigation. Following a player emphasises
 * them in every round, every pairing and every count below at once — which is
 * the question actually being asked, and it is asked while standing up.
 */
/** 'A, B and C' — the courses are read as a sentence, not as a data dump. */
function list(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function TeeTimes() {
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => groupByDay(), []);
  const pairings = useMemo(() => buildPairings(), []);
  const [cupCourses, sideCourses] = useMemo(() => {
    const name = (courseId: string) => {
      try {
        return getCourse(courseId).name;
      } catch {
        return courseId;
      }
    };
    return [
      TEE_SHEET.filter((round) => isCupRound(round)).map((r) => name(r.courseId)),
      TEE_SHEET.filter((round) => !isCupRound(round)).map((r) => name(r.courseId)),
    ];
  }, []);

  const cupRounds = cupCourses.length;
  const rounds = TEE_SHEET.length;

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-3 pb-2">
        <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-ink-45">
          {TRIP.title} · {rounds} rounds, {cupRounds} for the cup
        </div>
        <h1 className="letterpress font-display text-page leading-tight text-ink">
          Tee Sheet
        </h1>
        <div className="font-display text-list italic leading-name text-ink-70">
          {hasTimes()
            ? `${pairings.roster.length} players, two groups a side`
            : `${pairings.roster.length} players, two groups a side · times to be confirmed`}
        </div>
      </header>

      <PlayerFilter
        roster={pairings.roster}
        selected={selected}
        onSelect={setSelected}
      />

      {days.map((day) => (
        <DayBlock key={day.date} day={day} selected={selected} />
      ))}

      <PairingMatrix pairings={pairings} selected={selected} onSelect={setSelected} />

      <PlayerRounds
        pairings={pairings}
        cupRounds={cupRounds}
        selected={selected}
        onSelect={setSelected}
      />

      {/* Derived, like everything else here: name the two sides of the split
          off the schedule rather than writing the courses down twice. */}
      <p className="px-gutter pt-3 pb-5 font-display text-list italic leading-body text-ink-45">
        {list(sideCourses)} {sideCourses.length === 1 ? 'is' : 'are'} played but not
        scored — the Cup runs over {list(cupCourses)}.
      </p>
    </div>
  );
}
