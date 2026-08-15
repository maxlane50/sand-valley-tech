import { useMemo } from 'react';

import { Notice } from '../components/Notice';
import { TRIP } from '../config/trip';
import { getCourse } from '../data/courses';
import { buildLeaderboard, type LeaderRow, type Movement } from '../lib/leaderboard';
import { useTrip } from '../hooks/useTrip';

const MOVEMENT: Record<Movement, { glyph: string; className: string }> = {
  leader: { glyph: '★', className: 'text-sand' },
  up: { glyph: '▲', className: 'text-turf' },
  down: { glyph: '▼', className: 'text-flag' },
  same: { glyph: '–', className: 'text-ink-25' },
};

/** Title only. The round/holes readout and the rounds list live on Stats. */
function Header() {
  return (
    <header className="flex-none border-b-strong border-ink bg-paper-2 px-gutter pt-4 pb-3">
      <div className="font-display text-card-title leading-tight text-ink">
        {TRIP.title}
      </div>
      <div className="font-ui text-pico font-semibold uppercase tracking-label-3 text-ink-45">
        {TRIP.presentedBy}
      </div>
    </header>
  );
}

function Row({ row, index }: { row: LeaderRow; index: number }) {
  const { isLeader } = row;
  const move = MOVEMENT[row.movement];

  return (
    <div
      className={[
        'grid min-h-row-h flex-1 grid-cols-board items-center gap-2 border-b border-rule-soft px-gutter',
        // Striping is driven by row index, not :nth-child — the scroll
        // container has other children after the rows.
        isLeader ? 'bg-turf-deep' : index % 2 ? 'bg-row-alt' : 'bg-paper',
      ].join(' ')}
    >
      <div className="flex flex-col items-center">
        <span
          className={`font-num text-num-m font-medium leading-none ${
            isLeader ? 'text-sand' : 'text-ink-45'
          }`}
        >
          {row.position}
        </span>
        <span
          className={`font-num text-nano leading-none ${
            isLeader ? 'text-sand' : move.className
          }`}
        >
          {move.glyph}
        </span>
      </div>

      <div className="min-w-0">
        <div
          className={[
            'truncate font-display leading-name',
            isLeader ? 'text-name-lead text-paper' : 'text-name text-ink',
          ].join(' ')}
        >
          {row.name}
        </div>
        <div
          className={`truncate font-ui text-nano font-semibold uppercase tracking-nav ${
            isLeader ? 'text-fescue' : 'text-ink-45'
          }`}
        >
          hcp {row.handicapIndex.toFixed(1)} · gross {row.grossTotal ?? '–'}
        </div>
      </div>

      <div className="flex justify-end gap-chip">
        {row.rounds.map((cell) => (
          <div
            key={cell.roundId}
            className={[
              'w-chip-w rounded-sm py-chip text-center font-num text-chip font-medium',
              cell.isBestOfTrip
                ? 'bg-sand text-ink'
                : isLeader
                  ? 'bg-leader-chip text-paper'
                  : 'bg-paper-2 text-ink-70',
            ].join(' ')}
          >
            {cell.points ?? '·'}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-end">
        <span
          className={[
            'font-num font-semibold leading-none',
            isLeader ? 'text-pts-lead text-paper' : 'text-pts text-ink',
          ].join(' ')}
        >
          {row.totalPoints}
        </span>
        <span
          className={`font-num text-chip leading-none ${
            isLeader ? 'text-fescue' : 'text-ink-45'
          }`}
        >
          {row.pointsBack === null ? '—' : `-${row.pointsBack}`}
        </span>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { state } = useTrip();

  const board = useMemo(() => {
    if (state.status !== 'ready') return null;
    return buildLeaderboard(
      state.data.players,
      state.data.rounds,
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
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in your project URL
        and anon key, then restart the dev server.
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
      <Notice eyebrow="Could not load" title="The board is offline" tone="alert">
        {state.message}
      </Notice>
    );
  }

  if (!board || board.rows.length === 0) {
    return (
      <Notice eyebrow={TRIP.format} title="No players yet">
        Run <code>supabase/schema.sql</code>, then add players and rounds.
      </Notice>
    );
  }

  return (
    <>
      <Header />

      <div className="flex-none grid grid-cols-board gap-2 border-b border-rule bg-paper px-gutter pt-2 pb-2 font-ui text-nano font-bold uppercase tracking-label-2 text-ink-45">
        <div>Pos</div>
        <div>Player</div>
        <div className="text-right">Rounds</div>
        <div className="text-right">Pts</div>
      </div>

      {/* Rows share the leftover height so the board fills the page. */}
      <div className="flex flex-1 flex-col overflow-auto bg-paper">
        {board.rows.map((row, index) => (
          <Row key={row.playerId} row={row} index={index} />
        ))}

        {board.problems.length > 0 ? (
          <div className="border-b border-rule bg-paper-2 px-gutter py-3">
            <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-flag">
              Not scored
            </div>
            <ul className="pt-1">
              {board.problems.map((problem) => (
                <li key={problem} className="font-num text-chip leading-body text-ink-70">
                  {problem}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

      </div>
    </>
  );
}
