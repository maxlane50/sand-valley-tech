import { useMemo, useState } from 'react';

import {
  buildEntryCard,
  clampStrokes,
  emptyCard,
  nextHoleIndex,
  type EntryHole,
} from '../../lib/entryCard';
import { saveCard } from '../../lib/entryClient';
import type { PlayerRecord, RoundRecord } from '../../lib/types';
import { HOLES_PER_ROUND } from '../../scoring/scoring';
import type { Course } from '../../scoring/types';
import { Keypad } from './Keypad';
import { PlayerChips } from './PlayerChips';

/**
 * Score entry is an input surface, not a review surface.
 *
 * It used to show the same card three ways at once — the 18-hole strip, a
 * scrolling hole-by-hole list, and a large active-hole readout. The Rounds tab
 * now does review properly, so all that is gone. What is left is the strip
 * (progress, and tap to jump), one line of context for the hole you are on,
 * and a keypad that takes whatever height is left over.
 */

type SaveState =
  | { phase: 'entering'; error: string | null }
  | { phase: 'saving' }
  | { phase: 'saved'; grossTotal: number };

/** '●●' for two strokes received, '○' for one given back by a plus handicap. */
function strokeMarks(received: number): string {
  if (received > 0) return '●'.repeat(received);
  if (received < 0) return '○'.repeat(-received);
  return '';
}

function HoleStrip({
  holes,
  activeIndex,
  onSelect,
}: {
  holes: EntryHole[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex flex-none gap-hair border-b border-rule-strong bg-paper-2 px-2 py-2">
      {holes.map((hole, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={hole.hole}
            type="button"
            onClick={() => onSelect(index)}
            aria-label={`Hole ${hole.hole}, par ${hole.par}`}
            aria-current={isActive}
            className={`flex flex-1 flex-col items-center rounded-sm py-1 ${
              isActive
                ? 'bg-turf-deep outline outline-strong outline-ink'
                : hole.strokes !== null
                  ? 'bg-paper-shade'
                  : 'bg-transparent'
            }`}
          >
            <span
              className={`font-num text-pico leading-none ${
                isActive ? 'text-fescue' : 'text-ink-45'
              }`}
            >
              {hole.hole}
            </span>
            <span
              className={`py-px font-num text-strip font-semibold leading-name ${
                isActive
                  ? 'text-paper'
                  : hole.strokes === null
                    ? 'text-ink-25'
                    : hole.points === 0
                      ? 'text-flag'
                      : 'text-ink'
              }`}
            >
              {hole.strokes ?? '·'}
            </span>
            <span className={`text-tiny leading-none ${isActive ? 'text-sand' : 'text-flag'}`}>
              {strokeMarks(hole.strokesReceived)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CardEntry({
  course,
  round,
  roundNumber,
  player,
  players,
  entered,
  initialStrokes,
  pin,
  onSelectPlayer,
  onBack,
  onSaved,
  onPinRejected,
}: {
  course: Course;
  round: RoundRecord;
  roundNumber: number;
  player: PlayerRecord;
  players: readonly PlayerRecord[];
  /** Holes already saved per player for this round, for the chip ticks. */
  entered: ReadonlyMap<number, number>;
  initialStrokes: (number | null)[];
  pin: string;
  onSelectPlayer: (playerId: number) => void;
  onBack: () => void;
  onSaved: () => void;
  onPinRejected: () => void;
}) {
  const [strokes, setStrokes] = useState<(number | null)[]>(initialStrokes);
  const [activeIndex, setActiveIndex] = useState(() => {
    const first = initialStrokes.findIndex((s) => s === null);
    return first === -1 ? 0 : first;
  });
  const [save, setSave] = useState<SaveState>({ phase: 'entering', error: null });

  const card = useMemo(
    () => buildEntryCard(course, round.tee_name, Number(player.handicap_index), strokes),
    [course, round.tee_name, player.handicap_index, strokes],
  );

  const active = card.holes[activeIndex]!;

  /** Writes one hole and leaves the cursor alone. */
  function setHole(index: number, value: number | null) {
    const next = strokes.slice();
    next[index] = value;
    setSave({ phase: 'entering', error: null });
    setStrokes(next);
    return next;
  }

  function onDigit(value: number) {
    const next = setHole(activeIndex, value);
    setActiveIndex(nextHoleIndex(next, activeIndex));
  }

  function onTenPlus() {
    const current = strokes[activeIndex];
    // Stays on the hole so a repeat tap can climb 10 -> 11 -> 12.
    setHole(activeIndex, current !== null && current >= 10 ? clampStrokes(current + 1) : 10);
  }

  function onBackspace() {
    // Clear the hole you're on; if it's already empty, step back and clear that.
    if (strokes[activeIndex] !== null) {
      setHole(activeIndex, null);
      return;
    }
    const previous = Math.max(0, activeIndex - 1);
    setHole(previous, null);
    setActiveIndex(previous);
  }

  /** The next player round the list whose card isn't in yet. */
  function nextIncompletePlayer(): number | null {
    const start = players.findIndex((p) => p.id === player.id);
    for (let step = 1; step <= players.length; step += 1) {
      const candidate = players[(start + step) % players.length]!;
      if ((entered.get(candidate.id) ?? 0) < HOLES_PER_ROUND) return candidate.id;
    }
    return null;
  }

  async function submit() {
    if (!card.complete) return;

    setSave({ phase: 'saving' });
    const result = await saveCard({
      pin,
      roundId: round.id,
      playerId: player.id,
      strokes: card.holes.map((h) => h.strokes as number),
    });

    if (!result.ok) {
      if (result.failure.status === 401) {
        onPinRejected();
        return;
      }
      setSave({ phase: 'entering', error: result.failure.error });
      return;
    }

    setSave({ phase: 'saved', grossTotal: result.data.grossTotal });
    onSaved();
  }

  /** Gross vs par over the holes entered so far. */
  const vsPar =
    card.entered === 0
      ? ''
      : (() => {
          const delta = card.runningGross - card.parThru;
          return delta === 0 ? 'E' : delta > 0 ? `+${delta}` : String(delta);
        })();

  const nextPlayer = save.phase === 'saved' ? nextIncompletePlayer() : null;

  return (
    <>
      <header className="flex-none bg-turf-deep px-gutter pt-2 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="font-ui text-nano font-bold uppercase tracking-eyebrow text-fescue"
        >
          ◀ R{roundNumber} · {course.name} · PH {card.playingHandicap}
        </button>

        <div className="flex items-baseline justify-between gap-3 pt-1">
          <span className="letterpress-dark min-w-0 truncate font-display text-entry-name leading-none text-paper">
            {player.name}
          </span>
          <div className="flex flex-none items-baseline gap-4 text-right">
            <div>
              <div className="font-num text-num-m font-semibold leading-none text-paper">
                {card.entered === 0 ? '–' : card.runningGross}
              </div>
              <div className="font-ui text-pico font-bold uppercase tracking-label-3 text-ink-25">
                gross {vsPar}
              </div>
            </div>
            <div>
              <div className="font-num text-num-m font-semibold leading-none text-sand">
                {card.points}
              </div>
              <div className="font-ui text-pico font-bold uppercase tracking-label-3 text-ink-25">
                pts · thru {card.entered}
              </div>
            </div>
          </div>
        </div>
      </header>

      <PlayerChips
        players={players}
        currentId={player.id}
        entered={entered}
        onSelect={onSelectPlayer}
      />

      <HoleStrip holes={card.holes} activeIndex={activeIndex} onSelect={setActiveIndex} />

      <div className="flex-none px-gutter py-2 text-center font-ui text-micro font-bold uppercase tracking-label text-ink-45">
        Hole {active.hole} · Par {active.par} · SI {active.si}
        {active.strokesReceived !== 0 ? (
          <span className="text-flag">
            {' · '}
            {active.strokesReceived > 0 ? '+' : ''}
            {active.strokesReceived} stroke
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col border-t border-rule-strong bg-paper-2 pb-2">
        <Keypad
          activePar={active.par}
          activeValue={active.strokes}
          onDigit={onDigit}
          onTenPlus={onTenPlus}
          onBackspace={onBackspace}
        />

        <div className="flex flex-none items-center justify-between gap-3 px-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setStrokes(emptyCard());
              setActiveIndex(0);
              setSave({ phase: 'entering', error: null });
            }}
            className="min-h-hit-min font-ui text-nano font-semibold uppercase tracking-nav text-ink-45"
          >
            ↺ Clear card
          </button>

          {save.phase === 'saved' ? (
            <div className="flex items-center gap-3">
              <span className="font-ui text-nano font-bold uppercase tracking-label text-turf">
                Saved ✓ {save.grossTotal}
              </span>
              {nextPlayer !== null ? (
                <button
                  type="button"
                  onClick={() => onSelectPlayer(nextPlayer)}
                  className="min-h-hit-min rounded-md bg-turf-deep px-4 font-ui text-micro font-bold uppercase tracking-label text-paper"
                >
                  Next ▶
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={!card.complete || save.phase === 'saving'}
              onClick={submit}
              className="min-h-hit-min rounded-md bg-turf-deep px-4 font-ui text-micro font-bold uppercase tracking-label text-paper disabled:bg-transparent disabled:text-ink-25"
            >
              {save.phase === 'saving'
                ? 'Saving'
                : card.complete
                  ? 'Save card'
                  : `${HOLES_PER_ROUND - card.entered} left`}
            </button>
          )}
        </div>

        {save.phase === 'entering' && save.error ? (
          <p role="alert" className="px-3 pt-2 font-num text-chip leading-body text-flag">
            {save.error}
          </p>
        ) : null}
      </div>
    </>
  );
}
