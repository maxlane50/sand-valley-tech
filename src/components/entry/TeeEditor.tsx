import { useState } from 'react';

import { getCourse } from '../../data/courses';
import { saveTees } from '../../lib/entryClient';
import { resolveTee, type TeeMap } from '../../lib/tees';
import type { PlayerRecord, RoundRecord } from '../../lib/types';
import { isPlayableCourse } from '../../scoring/scoring';

/**
 * Who is playing which tee, for one round.
 *
 * Every player is shown with an explicit tee rather than a "default vs
 * override" toggle — one less thing to reason about, and what you see is what
 * gets stored. Saving replaces the round's assignments wholesale.
 *
 * Chips rather than a dropdown: a course has two to four tees, they all fit,
 * and nothing is hidden behind a tap.
 */
export function TeeEditor({
  round,
  roundNumber,
  players,
  teeOverrides,
  pin,
  onBack,
  onSaved,
  onPinRejected,
}: {
  round: RoundRecord;
  roundNumber: number;
  players: readonly PlayerRecord[];
  teeOverrides: TeeMap;
  pin: string;
  onBack: () => void;
  onSaved: () => void;
  onPinRejected: () => void;
}) {
  const course = (() => {
    try {
      return getCourse(round.course_id);
    } catch {
      return undefined;
    }
  })();

  const teeNames = course && isPlayableCourse(course) ? course.tees.map((t) => t.name) : [];

  const [defaultTee, setDefaultTee] = useState(round.tee_name);
  const [assigned, setAssigned] = useState<Record<number, string>>(() =>
    Object.fromEntries(players.map((p) => [p.id, resolveTee(teeOverrides, round, p.id)])),
  );
  const [status, setStatus] = useState<
    { phase: 'idle' } | { phase: 'saving' } | { phase: 'error'; message: string } | { phase: 'saved' }
  >({ phase: 'idle' });

  if (teeNames.length === 0) {
    return (
      <div className="flex-1 overflow-auto bg-paper">
        <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-3 pb-2">
          <button
            type="button"
            onClick={onBack}
            className="font-ui text-nano font-bold uppercase tracking-eyebrow text-turf"
          >
            ◀ Back
          </button>
          <div className="letterpress pt-1 font-display text-card-title leading-tight text-ink">
            Tees
          </div>
        </header>
        <p className="px-gutter pt-3 font-display text-list italic leading-body text-ink-70">
          {course?.name ?? round.course_id} has no tees in courses.json yet. Fill in the
          card — rating and slope per tee — and they will appear here.
        </p>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `min-h-hit-min flex-1 rounded-sm px-1 font-ui text-nano font-bold uppercase tracking-nav ${
      active ? 'bg-turf-deep text-paper' : 'bg-paper-2 text-ink-45'
    }`;

  async function submit() {
    setStatus({ phase: 'saving' });
    const result = await saveTees({
      pin,
      roundId: round.id,
      defaultTee,
      assignments: players.map((p) => ({ playerId: p.id, teeName: assigned[p.id] ?? defaultTee })),
    });

    if (!result.ok) {
      if (result.failure.status === 401) {
        onPinRejected();
        return;
      }
      setStatus({ phase: 'error', message: result.failure.error });
      return;
    }
    setStatus({ phase: 'saved' });
    onSaved();
  }

  const inPlay = new Set(Object.values(assigned));

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="font-ui text-nano font-bold uppercase tracking-eyebrow text-turf"
        >
          ◀ R{roundNumber} · {course?.name ?? round.course_id}
        </button>
        <div className="letterpress pt-1 font-display text-card-title leading-tight text-ink">
          Tees
        </div>
        <div className="font-display text-list italic leading-name text-ink-70">
          {inPlay.size > 1
            ? `${inPlay.size} tees in play — handicaps adjust automatically`
            : 'everyone off the same tee'}
        </div>
      </header>

      <div className="px-gutter pt-3 pb-2">
        <div className="pb-1 font-ui text-nano font-bold uppercase tracking-label text-ink-45">
          Round default
        </div>
        <div className="flex gap-1 pb-3">
          {teeNames.map((tee) => (
            <button
              key={tee}
              type="button"
              onClick={() => {
                setStatus({ phase: 'idle' });
                setDefaultTee(tee);
              }}
              className={chip(tee === defaultTee)}
            >
              {tee}
            </button>
          ))}
        </div>

        <div className="border-t border-rule pt-2 font-ui text-nano font-bold uppercase tracking-label text-ink-45">
          Each player
        </div>

        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-2 border-b border-rule-soft py-2"
          >
            <span className="min-w-0 flex-1 truncate font-display text-name text-ink">
              {player.name}
            </span>
            <span className="flex flex-none gap-1">
              {teeNames.map((tee) => (
                <button
                  key={tee}
                  type="button"
                  onClick={() => {
                    setStatus({ phase: 'idle' });
                    setAssigned((current) => ({ ...current, [player.id]: tee }));
                  }}
                  aria-label={`${player.name} off ${tee}`}
                  className={`${chip((assigned[player.id] ?? defaultTee) === tee)} px-2`}
                >
                  {tee}
                </button>
              ))}
            </span>
          </div>
        ))}

        <p className="pt-2 font-display text-list italic leading-body text-ink-45">
          A player off a longer tee gets more strokes: the course handicap
          formula carries a rating-minus-par term precisely so a split field
          competes level.
        </p>

        <div className="flex items-center justify-between gap-3 pt-3">
          <span
            className={`font-ui text-nano font-bold uppercase tracking-label ${
              status.phase === 'saved' ? 'text-turf' : 'text-ink-45'
            }`}
          >
            {status.phase === 'saved' ? 'Saved ✓' : `${players.length} players`}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={status.phase === 'saving'}
            className="min-h-hit-min rounded-md bg-turf-deep px-4 font-ui text-micro font-bold uppercase tracking-label text-paper disabled:bg-rule-strong"
          >
            {status.phase === 'saving' ? 'Saving' : 'Save tees'}
          </button>
        </div>

        {status.phase === 'error' ? (
          <p role="alert" className="pt-2 font-num text-chip leading-body text-flag">
            {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
