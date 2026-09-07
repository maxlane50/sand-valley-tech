import { useMemo, useState } from 'react';

import { DayBlock } from '../components/teesheet/DayBlock';
import { PairingMatrix } from '../components/teesheet/PairingMatrix';
import { PlayerFilter } from '../components/teesheet/PlayerFilter';
import { TRIP } from '../config/trip';
import { TEE_SHEET } from '../config/teeSheet';
import { buildPairings, groupByDay, isCupRound } from '../lib/teeSheet';

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
 * them in every round and every pairing below at once — which is the question
 * actually being asked, and it is asked while standing up.
 */
export function TeeTimes() {
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => groupByDay(), []);
  const pairings = useMemo(() => buildPairings(), []);
  const cupRounds = useMemo(() => TEE_SHEET.filter((r) => isCupRound(r)).length, []);

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-3 pb-2">
        <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-ink-45">
          {TRIP.title} · {TEE_SHEET.length} rounds, {cupRounds} for the cup
        </div>
        <h1 className="letterpress font-display text-page leading-tight text-ink">
          Tee Sheet
        </h1>
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
    </div>
  );
}
