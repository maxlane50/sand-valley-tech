import { useState } from 'react';

import { savePlayers } from '../../lib/entryClient';
import type { PlayerRecord } from '../../lib/types';

/**
 * Pre-trip setup: the field and their frozen handicap indexes.
 *
 * A player who has already posted a score has their index locked, here and
 * again on the server. Everything is recomputed from handicap_index on every
 * read, so changing one mid-trip would silently rescore rounds already played —
 * the leaderboard for round 1 would move. Names stay editable, since nothing
 * scores off them.
 */

interface Draft {
  /** Absent for a row that has not been saved yet. */
  id?: number;
  name: string;
  /** Kept as a string so the field can be empty or mid-typing. */
  index: string;
  locked: boolean;
}

function toDraft(player: PlayerRecord, locked: boolean): Draft {
  return {
    id: player.id,
    name: player.name,
    index: Number(player.handicap_index).toFixed(1),
    locked,
  };
}

export function PlayersEditor({
  players,
  playersWithScores,
  pin,
  onBack,
  onSaved,
  onPinRejected,
}: {
  players: readonly PlayerRecord[];
  playersWithScores: ReadonlySet<number>;
  pin: string;
  onBack: () => void;
  onSaved: () => void;
  onPinRejected: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    players.map((p) => toDraft(p, playersWithScores.has(p.id))),
  );
  const [removed, setRemoved] = useState<number[]>([]);
  const [status, setStatus] = useState<
    { phase: 'idle' } | { phase: 'saving' } | { phase: 'error'; message: string } | { phase: 'saved' }
  >({ phase: 'idle' });

  function update(index: number, patch: Partial<Draft>) {
    setStatus({ phase: 'idle' });
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function remove(index: number) {
    const draft = drafts[index]!;
    if (draft.locked) return;
    setStatus({ phase: 'idle' });
    if (draft.id !== undefined) setRemoved((current) => [...current, draft.id!]);
    setDrafts((current) => current.filter((_, i) => i !== index));
  }

  async function submit() {
    const invalid = drafts.find(
      (d) => !d.name.trim() || !Number.isFinite(Number(d.index)) || d.index.trim() === '',
    );
    if (invalid) {
      setStatus({
        phase: 'error',
        message: 'Every player needs a name and a handicap index.',
      });
      return;
    }

    setStatus({ phase: 'saving' });
    const result = await savePlayers({
      pin,
      players: drafts.map((d) => ({
        ...(d.id === undefined ? {} : { id: d.id }),
        name: d.name.trim(),
        handicapIndex: Number(d.index),
      })),
      deleteIds: removed,
    });

    if (!result.ok) {
      if (result.failure.status === 401) {
        onPinRejected();
        return;
      }
      setStatus({ phase: 'error', message: result.failure.error });
      return;
    }

    setRemoved([]);
    setStatus({ phase: 'saved' });
    onSaved();
  }

  const inputClass =
    'min-h-hit-min w-full rounded-md border border-key-border bg-paper px-2 text-ink focus:border-ink focus:outline-none disabled:bg-paper-2 disabled:text-ink-45';

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="font-ui text-nano font-bold uppercase tracking-eyebrow text-turf"
        >
          ◀ Rounds
        </button>
        <div className="letterpress pt-1 font-display text-card-title leading-tight text-ink">
          Players
        </div>
        <div className="font-display text-list italic leading-name text-ink-70">
          the field and their indexes, set before a ball is struck
        </div>
      </header>

      <div className="px-gutter pt-3 pb-2">
        <div className="grid grid-cols-players gap-2 pb-1 font-ui text-nano font-bold uppercase tracking-label-3 text-ink-45">
          <div>Name</div>
          <div className="text-right">Index</div>
          <div />
        </div>

        {drafts.map((draft, index) => (
          <div
            key={draft.id ?? `new-${index}`}
            className="grid grid-cols-players items-center gap-2 border-b border-rule-soft py-2"
          >
            <input
              value={draft.name}
              onChange={(event) => update(index, { name: event.target.value })}
              aria-label={`Player ${index + 1} name`}
              placeholder="Name"
              className={`${inputClass} font-display text-name`}
            />
            <input
              value={draft.index}
              inputMode="decimal"
              disabled={draft.locked}
              onChange={(event) =>
                update(index, { index: event.target.value.replace(/[^\d.-]/g, '') })
              }
              aria-label={`Player ${index + 1} handicap index`}
              title={draft.locked ? 'Locked — this player has already posted a score' : undefined}
              className={`${inputClass} text-right font-num text-num-m`}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={draft.locked}
              aria-label={`Remove ${draft.name || 'player'}`}
              className="min-h-hit-min font-num text-micro text-flag disabled:text-ink-25"
            >
              {draft.locked ? '🔒' : '✕'}
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => {
            setStatus({ phase: 'idle' });
            setDrafts((current) => [...current, { name: '', index: '', locked: false }]);
          }}
          className="min-h-hit-min font-ui text-nano font-bold uppercase tracking-label text-turf"
        >
          + Add player
        </button>

        <p className="pt-2 font-display text-list italic leading-body text-ink-45">
          A negative index is a plus handicap. Once someone posts a score their
          index locks, because every screen recomputes from it — changing one
          later would rewrite rounds already played.
        </p>

        <div className="flex items-center justify-between gap-3 pt-3">
          <span
            className={`font-ui text-nano font-bold uppercase tracking-label ${
              status.phase === 'saved' ? 'text-turf' : 'text-ink-45'
            }`}
          >
            {status.phase === 'saved' ? 'Saved ✓' : `${drafts.length} players`}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={status.phase === 'saving'}
            className="min-h-hit-min rounded-md bg-turf-deep px-4 font-ui text-micro font-bold uppercase tracking-label text-paper disabled:bg-rule-strong"
          >
            {status.phase === 'saving' ? 'Saving' : 'Save players'}
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
