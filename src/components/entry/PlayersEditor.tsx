import { useRef, useState } from 'react';

import { Avatar } from '../Avatar';
import { savePhoto, savePlayers } from '../../lib/entryClient';
import { toAvatarJpeg } from '../../lib/resizeImage';
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

/**
 * The photo button for one saved player.
 *
 * Photos are uploaded on their own, the moment one is picked, rather than
 * riding along with Save players — an unsaved player has no id yet, and the id
 * is the only thing a photo is filed under. Bumping `version` after an upload
 * is what makes the new photo appear immediately instead of when the CDN cache
 * lets go of the old one.
 */
function PhotoButton({
  playerId,
  name,
  pin,
  onPinRejected,
  onError,
}: {
  playerId: number;
  name: string;
  pin: string;
  onPinRejected: () => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await toAvatarJpeg(file);
      const result = await savePhoto({ pin, playerId, dataUrl });
      if (!result.ok) {
        if (result.failure.status === 401) return onPinRejected();
        return onError(result.failure.error);
      }
      setVersion(Date.now());
    } catch (error) {
      onError(error instanceof Error ? error.message : 'That photo could not be read.');
    } finally {
      setBusy(false);
      // Clear the input so picking the same file twice still fires a change.
      if (input.current) input.current.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={`Photo for ${name || 'this player'}`}
        className="relative flex-none rounded-full disabled:opacity-45"
      >
        <Avatar playerId={playerId} name={name} size="lead" version={version} />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </>
  );
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
        <div className="flex items-baseline gap-2 pb-1 font-ui text-nano font-bold uppercase tracking-label-3 text-ink-45">
          <div className="w-avatar-lead flex-none">Photo</div>
          <div className="min-w-0 flex-1">Name</div>
          <div className="w-rounds-col flex-none text-right">Index</div>
          <div className="w-cell-col flex-none" />
        </div>

        {drafts.map((draft, index) => (
          <div
            key={draft.id ?? `new-${index}`}
            className="flex items-center gap-2 border-b border-rule-soft py-2"
          >
            {draft.id === undefined ? (
              // No id yet, and the id is the only thing a photo is filed
              // under. Save the player first, then their photo has somewhere
              // to go.
              <div
                title="Save this player first, then add a photo"
                className="flex h-avatar-lead w-avatar-lead flex-none items-center justify-center rounded-full border border-dashed border-rule-strong font-ui text-nano font-bold uppercase tracking-nav text-ink-25"
              >
                +
              </div>
            ) : (
              <PhotoButton
                playerId={draft.id}
                name={draft.name}
                pin={pin}
                onPinRejected={onPinRejected}
                onError={(message) => setStatus({ phase: 'error', message })}
              />
            )}
            <input
              value={draft.name}
              onChange={(event) => update(index, { name: event.target.value })}
              aria-label={`Player ${index + 1} name`}
              placeholder="Name"
              className={`${inputClass} min-w-0 flex-1 font-display text-name`}
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
              className={`${inputClass} w-rounds-col flex-none text-right font-num text-num-m`}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              disabled={draft.locked}
              aria-label={`Remove ${draft.name || 'player'}`}
              className="min-h-hit-min w-cell-col flex-none font-num text-micro text-flag disabled:text-ink-25"
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
          later would rewrite rounds already played. Tap a photo to change it;
          photos save on their own, not with the button below.
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
