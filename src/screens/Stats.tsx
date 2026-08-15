import { useMemo } from 'react';

import { Notice } from '../components/Notice';
import { ByHoleType } from '../components/stats/ByHoleType';
import { HoleDifficultySection } from '../components/stats/HoleDifficultySection';
import { ScoringCountsSection } from '../components/stats/ScoringCountsSection';
import { Superlatives } from '../components/stats/Superlatives';
import { Trajectory } from '../components/stats/Trajectory';
import { TRIP } from '../config/trip';
import { getCourse } from '../data/courses';
import { useTrip } from '../hooks/useTrip';
import { buildTripStats } from '../lib/stats';

/**
 * Sections A-D follow design.html's stats screen. Two things are additions:
 * the Rounds block, which moved here off the leaderboard, and the Group rows in
 * A and C, which the brief asks for ("per player and group-wide").
 */
export function Stats() {
  const { state } = useTrip();

  const stats = useMemo(() => {
    if (state.status !== 'ready') return null;
    return buildTripStats(
      state.data.rounds,
      state.data.players,
      state.data.scores,
      (courseId) => {
        try {
          return getCourse(courseId);
        } catch {
          return undefined;
        }
      },
    );
  }, [state]);

  if (state.status === 'unconfigured') {
    return (
      <Notice eyebrow="Setup" title="Supabase isn't connected">
        Fill in <code>.env.local</code> and restart the dev server.
      </Notice>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center font-ui text-nano font-bold uppercase tracking-eyebrow text-ink-45">
        Loading
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <Notice eyebrow="Could not load" title="No stats to show" tone="alert">
        {state.message}
      </Notice>
    );
  }

  if (!stats || !stats.hasData) {
    return (
      <Notice eyebrow={`${TRIP.title} · stats`} title="Nothing played yet">
        Enter a card and the splits, the hardest holes and the superlatives all
        follow from it.
      </Notice>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-3 pb-2">
        <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-ink-45">
          {TRIP.title} · {stats.group.holesPlayed} holes played
        </div>
        <h1 className="letterpress font-display text-page leading-tight text-ink">Stats</h1>
      </header>

      {/* Moved off the leaderboard, which is now standings only. */}
      <section className="border-b border-rule px-gutter pt-3 pb-3">
        <div className="pb-1 font-ui text-nano font-bold uppercase tracking-label text-ink-45">
          Rounds
        </div>
        {stats.rounds.map((round) => (
          <div
            key={round.roundId}
            className="flex items-baseline justify-between gap-3 border-b border-dotted border-rule py-2 last:border-b-0"
          >
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="flex-none font-num text-chip text-ink-25">R{round.number}</span>
              <span className="truncate font-display text-list text-ink">
                {round.courseName}
              </span>
            </div>
            <div className="flex-none font-num text-chip text-ink-70">
              {round.par === null
                ? 'card not filled in'
                : round.low
                  ? `par ${round.par} · low ${round.low.name} (${round.low.points})`
                  : `par ${round.par} · not played`}
            </div>
          </div>
        ))}
      </section>

      <ByHoleType players={stats.players} group={stats.group} />

      <HoleDifficultySection
        hardest={stats.hardest}
        easiest={stats.easiest}
        holesRanked={stats.holesRanked}
      />

      <ScoringCountsSection players={stats.players} group={stats.group} />

      <Trajectory players={stats.players} scoredRounds={stats.scoredRounds} />

      {stats.problems.length > 0 ? (
        <div className="border-t border-rule bg-paper-2 px-gutter py-2">
          <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-flag">
            Not counted
          </div>
          <ul className="pt-1">
            {stats.problems.map((problem) => (
              <li key={problem} className="font-num text-chip leading-body text-ink-70">
                {problem}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Superlatives items={stats.superlatives} />
    </div>
  );
}
