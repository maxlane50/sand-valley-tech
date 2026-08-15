import { useMemo, useState } from 'react';

import { CardEntry } from '../components/entry/CardEntry';
import { CardPicker } from '../components/entry/CardPicker';
import { PinGate } from '../components/entry/PinGate';
import { Notice } from '../components/Notice';
import { getCourse } from '../data/courses';
import { useTrip } from '../hooks/useTrip';
import { emptyCard } from '../lib/entryCard';
import { clearPin, loadPin } from '../lib/entryClient';
import type { ScoreRecord } from '../lib/types';
import { HOLES_PER_ROUND } from '../scoring/scoring';

/** Existing strokes for one card, as a dense 18-length array. */
function existingCard(
  scores: readonly ScoreRecord[],
  roundId: number,
  playerId: number,
): (number | null)[] {
  const card = emptyCard();
  for (const score of scores) {
    if (score.round_id !== roundId || score.player_id !== playerId) continue;
    if (score.hole >= 1 && score.hole <= HOLES_PER_ROUND) {
      card[score.hole - 1] = score.strokes;
    }
  }
  return card;
}

export function Enter() {
  const { state, refresh } = useTrip();
  const [pin, setPin] = useState<string | null>(() => loadPin());
  const [roundId, setRoundId] = useState<number | null>(null);
  const [playerId, setPlayerId] = useState<number | null>(null);

  const selection = useMemo(() => {
    if (state.status !== 'ready' || roundId === null || playerId === null) return null;

    const rounds = [...state.data.rounds].sort(
      (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
    );
    const index = rounds.findIndex((r) => r.id === roundId);
    const round = rounds[index];
    const player = state.data.players.find((p) => p.id === playerId);
    if (!round || !player) return null;

    let course;
    try {
      course = getCourse(round.course_id);
    } catch (error) {
      return { error: (error as Error).message };
    }

    return {
      round,
      roundNumber: index + 1,
      player,
      course,
      strokes: existingCard(state.data.scores, round.id, player.id),
    };
  }, [state, roundId, playerId]);

  if (!pin) {
    return <PinGate onUnlock={setPin} />;
  }

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
      <Notice eyebrow="Could not load" title="No rounds to enter" tone="alert">
        {state.message}
      </Notice>
    );
  }

  if (selection && 'error' in selection) {
    return (
      <Notice eyebrow="Cannot score this round" title="Course data missing" tone="alert">
        {selection.error}
      </Notice>
    );
  }

  if (!selection) {
    return (
      <CardPicker
        rounds={[...state.data.rounds].sort(
          (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
        )}
        players={state.data.players}
        scores={state.data.scores}
        roundId={roundId}
        onPickRound={setRoundId}
        onPickPlayer={setPlayerId}
      />
    );
  }

  return (
    <CardEntry
      // Remounts on a card change, so strokes and the cursor reset cleanly.
      key={`${selection.round.id}-${selection.player.id}`}
      course={selection.course}
      round={selection.round}
      roundNumber={selection.roundNumber}
      player={selection.player}
      players={state.data.players}
      initialStrokes={selection.strokes}
      pin={pin}
      onSelectPlayer={setPlayerId}
      onBack={() => setPlayerId(null)}
      // Silent, so saving a card doesn't flash the entry screen back to a
      // loading state while the keypad is still open.
      onSaved={refresh}
      onPinRejected={() => {
        clearPin();
        setPin(null);
      }}
    />
  );
}
