import { useMemo, useState } from 'react';

import { Notice } from '../components/Notice';
import { getCourse } from '../data/courses';
import { useTrip } from '../hooks/useTrip';
import { buildRoundGrid, orderRounds, type GridPlayer, type Subtotal } from '../lib/roundGrid';
import { buildTeeMap } from '../lib/tees';
import type { HoleResult } from '../scoring/types';

/**
 * design.html has no round-detail screen, so this is derived from the patterns
 * it does establish: the score-entry card list for the row rhythm, the stats
 * table for the good/bad cell tints, the leaderboard for the header.
 *
 * Holes run down and players run across, rather than the printed-scorecard
 * orientation. Seven players fit across 390px; eighteen holes do not, and this
 * way nothing scrolls sideways and you can read one hole across the whole
 * group — which is the question actually being asked at the bar.
 */

/** Tints match the stats screen: good scoring green, blow-ups red. */
function cellTint(hole: HoleResult): string {
  if (hole.strokes === null) return '';
  if (hole.points === 0) return 'bg-tint-bad';
  if (hole.points >= 3) return 'bg-tint-good';
  return '';
}

function Cell({ hole }: { hole: HoleResult }) {
  const blank = hole.strokes === null;
  return (
    <div
      className={`flex flex-col items-center justify-center py-1 ${cellTint(hole)}`}
      title={
        blank
          ? 'No score'
          : `${hole.strokes} gross, net ${hole.net}, ${hole.points} pt${hole.points === 1 ? '' : 's'}`
      }
    >
      <span
        className={`font-num text-strip font-semibold leading-none ${
          blank ? 'text-ink-25' : 'text-ink'
        }`}
      >
        {hole.strokes ?? '·'}
      </span>
      <span className="font-num text-nano leading-none text-ink-45">
        {blank ? (
          '·'
        ) : (
          <>
            {hole.strokesReceived > 0 ? (
              <span className="text-flag">{'•'.repeat(hole.strokesReceived)}</span>
            ) : null}
            {hole.points}
          </>
        )}
      </span>
    </div>
  );
}

function TotalCell({ value, strong }: { value: Subtotal; strong?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-1">
      <span
        className={`font-num leading-none text-ink ${
          strong ? 'text-strip font-semibold' : 'text-cell font-semibold'
        }`}
      >
        {value.gross ?? '–'}
      </span>
      <span className="font-num text-nano leading-none text-turf">{value.points}</span>
    </div>
  );
}

export function RoundDetail() {
  const { state } = useTrip();
  const [picked, setPicked] = useState<number | null>(null);

  const rounds = useMemo(
    () => (state.status === 'ready' ? orderRounds(state.data.rounds) : []),
    [state],
  );

  // Default to the most recent round anyone has played.
  const defaultId = useMemo(() => {
    if (state.status !== 'ready' || rounds.length === 0) return null;
    const scored = new Set(state.data.scores.map((s) => s.round_id));
    const latest = [...rounds].reverse().find((r) => scored.has(r.id));
    return (latest ?? rounds[0]!).id;
  }, [state, rounds]);

  const activeId = picked ?? defaultId;

  const grid = useMemo(() => {
    if (state.status !== 'ready' || activeId === null) return null;
    const index = rounds.findIndex((r) => r.id === activeId);
    const round = rounds[index];
    if (!round) return null;
    let course;
    try {
      course = getCourse(round.course_id);
    } catch {
      course = undefined;
    }
    return buildRoundGrid(
      round,
      index + 1,
      course,
      state.data.players,
      state.data.scores,
      buildTeeMap(state.data.playerTees),
    );
  }, [state, rounds, activeId]);

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
      <Notice eyebrow="Could not load" title="No cards to show" tone="alert">
        {state.message}
      </Notice>
    );
  }

  if (!grid) {
    return (
      <Notice eyebrow="Rounds" title="No rounds yet">
        Add a round to the rounds table, then enter a card.
      </Notice>
    );
  }

  const columns = `var(--cell-col) repeat(${grid.players.length}, minmax(0, 1fr))`;
  const problems = [
    ...(grid.problem ? [grid.problem] : []),
    ...grid.players.map((p) => p.problem).filter((p): p is string => p !== null),
  ];

  // Only name the tee per column when the field actually split; otherwise the
  // round header says it once and the columns stay two lines.
  const teesInRound = new Set(grid.players.map((p) => p.teeName));
  const mixedTees = teesInRound.size > 1;

  const front = grid.holes.slice(0, 9);
  const back = grid.holes.slice(9);

  const holeRow = (holes: typeof grid.holes, offset: number) =>
    holes.map((hole, i) => {
      const index = offset + i;
      return (
        <div
          key={hole.hole}
          className={`grid items-stretch border-b border-rule-soft ${
            index % 2 ? 'bg-row-alt' : 'bg-paper'
          }`}
          style={{ gridTemplateColumns: columns }}
        >
          <div className="flex flex-col items-center justify-center border-r border-rule py-1">
            <span className="font-num text-micro leading-none text-ink">{hole.hole}</span>
            <span className="font-num text-pico leading-none text-ink-45">
              {hole.par}·{hole.si}
            </span>
          </div>
          {grid.players.map((player) => (
            <Cell key={player.playerId} hole={player.holes[index]!} />
          ))}
        </div>
      );
    });

  const totalRow = (
    label: string,
    par: number,
    pick: (p: GridPlayer) => Subtotal,
    strong = false,
  ) => (
    <div
      className={`grid items-stretch bg-paper-2 ${
        strong ? 'border-y-strong border-ink' : 'border-y border-rule-strong'
      }`}
      style={{ gridTemplateColumns: columns }}
    >
      <div className="flex flex-col items-center justify-center border-r border-rule py-1">
        <span className="font-ui text-pico font-bold uppercase tracking-nav text-ink-45">
          {label}
        </span>
        <span className="font-num text-pico leading-none text-ink-45">{par}</span>
      </div>
      {grid.players.map((player) => (
        <TotalCell key={player.playerId} value={pick(player)} strong={strong} />
      ))}
    </div>
  );

  return (
    <>
      <header className="flex-none border-b border-rule bg-paper-2 px-gutter pt-3 pb-2">
        <div className="letterpress font-display text-h2 leading-tight text-ink">
          {grid.courseName}
        </div>
        <div className="font-num text-chip text-ink-45">
          {mixedTees ? `${teesInRound.size} tees` : grid.teeName} · par{' '}
          {grid.parTotal || '–'} · {grid.date}
        </div>
      </header>

      {rounds.length > 1 ? (
        <div className="flex flex-none border-b-strong border-ink bg-paper-2">
          {rounds.map((round, index) => (
            <button
              key={round.id}
              type="button"
              onClick={() => setPicked(round.id)}
              className={`min-h-hit-min flex-1 font-ui text-chip uppercase tracking-nav ${
                round.id === activeId
                  ? 'border-b-2 border-turf font-bold text-ink'
                  : 'font-semibold text-ink-45'
              }`}
            >
              R{index + 1}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-none border-b-strong border-ink" />
      )}

      <div className="flex-1 overflow-auto bg-paper">
        {grid.holes.length === 0 ? (
          <Notice eyebrow="Cannot score this round" title="Course card missing" tone="alert">
            {grid.problem}
          </Notice>
        ) : (
          <>
            <div
              className="sticky top-0 z-10 grid items-stretch border-b-strong border-ink bg-paper-2"
              style={{ gridTemplateColumns: columns }}
            >
              <div className="flex flex-col items-center justify-center border-r border-rule py-1">
                <span className="font-ui text-pico font-bold uppercase tracking-nav text-ink-45">
                  Hole
                </span>
                <span className="font-ui text-pico font-bold uppercase tracking-nav text-ink-25">
                  P·SI
                </span>
              </div>
              {grid.players.map((player) => (
                <div
                  key={player.playerId}
                  className="flex flex-col items-center justify-center py-1"
                  title={`${player.name} · ${player.teeName} tees · playing handicap ${player.playingHandicap}`}
                >
                  <span className="truncate font-ui text-nano font-bold uppercase tracking-nav text-ink">
                    {player.label}
                  </span>
                  <span className="font-num text-pico leading-none text-ink-45">
                    {player.playingHandicap}
                  </span>
                  {mixedTees ? (
                    <span className="w-full truncate text-center font-ui text-tiny font-bold uppercase tracking-nav text-turf">
                      {player.teeName}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {holeRow(front, 0)}
            {totalRow('Out', grid.parFront, (p) => p.front)}
            {holeRow(back, 9)}
            {totalRow('In', grid.parBack, (p) => p.back)}
            {totalRow('Tot', grid.parTotal, (p) => p.total, true)}

            <div className="px-gutter pt-2 pb-4 font-num text-nano leading-body text-ink-45">
              <span className="text-flag">•</span> = handicap stroke
            </div>

            {problems.length > 0 ? (
              <div className="border-t border-rule bg-paper-2 px-gutter py-2">
                <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-flag">
                  Not scored
                </div>
                <ul className="pt-1">
                  {problems.map((problem) => (
                    <li key={problem} className="font-num text-chip leading-body text-ink-70">
                      {problem}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
