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
import type { Course } from '../../scoring/types';
import { Keypad } from './Keypad';

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
    <div className="flex-none border-b border-rule-strong bg-paper-2 px-3 pt-2 pb-3">
      <div className="flex justify-between px-px pb-2 font-ui text-pico font-bold uppercase tracking-label-2 text-ink-45">
        <span>Hole</span>
        <span>● gets a stroke</span>
      </div>
      <div className="flex gap-hair">
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
              <span
                className={`font-num text-pico leading-none ${
                  isActive ? 'text-ink-25' : 'text-rule-strong'
                }`}
              >
                {hole.par}
              </span>
              <span
                className={`text-tiny leading-none ${isActive ? 'text-sand' : 'text-flag'}`}
              >
                {strokeMarks(hole.strokesReceived)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CardEntry({
  course,
  round,
  roundNumber,
  player,
  players,
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
  const playerIndex = players.findIndex((p) => p.id === player.id);

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

  function movePlayer(step: number) {
    const next = players[(playerIndex + step + players.length) % players.length];
    if (next) onSelectPlayer(next.id);
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

  return (
    <>
      <header className="flex-none bg-turf-deep px-gutter pt-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="font-ui text-nano font-bold uppercase tracking-eyebrow text-fescue"
            >
              ◀ R{roundNumber} · {course.name} · PH {card.playingHandicap}
            </button>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="letterpress-dark truncate font-display text-entry-name leading-none text-paper">
                {player.name}
              </span>
              <span className="flex flex-none gap-1">
                <button
                  type="button"
                  onClick={() => movePlayer(-1)}
                  aria-label="Previous player"
                  className="font-num text-chip text-ink-25"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => movePlayer(1)}
                  aria-label="Next player"
                  className="font-num text-chip text-ink-25"
                >
                  ▶
                </button>
              </span>
            </div>
          </div>

          <div className="flex flex-none gap-4 text-right">
            <div>
              <div className="font-num text-num-l font-semibold leading-none text-paper">
                {card.entered === 0 ? '–' : card.runningGross}
              </div>
              <div className="font-ui text-pico font-bold uppercase tracking-label-3 text-ink-25">
                gross {vsPar}
              </div>
            </div>
            <div>
              <div className="font-num text-num-l font-semibold leading-none text-sand">
                {card.points}
              </div>
              <div className="font-ui text-pico font-bold uppercase tracking-label-3 text-ink-25">
                pts · thru {card.entered}
              </div>
            </div>
          </div>
        </div>
      </header>

      <HoleStrip holes={card.holes} activeIndex={activeIndex} onSelect={setActiveIndex} />

      <div className="flex flex-none flex-col items-center justify-center bg-paper py-4">
        <div className="whitespace-nowrap font-ui text-chip font-bold uppercase tracking-eyebrow text-ink-45">
          Hole {active.hole} · par {active.par} · si {active.si}
          {active.strokesReceived !== 0
            ? ` · ${active.strokesReceived > 0 ? '+' : ''}${active.strokesReceived}`
            : ''}
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-num text-num-hero font-semibold leading-none text-ink">
            {active.strokes ?? '–'}
          </span>
          <span className="font-num text-body text-ink-70">
            {active.points === null ? '' : `${active.points} pts`}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-t border-rule bg-paper-sunk">
        <div className="grid grid-cols-card-row gap-1 border-b border-rule px-3 pt-2 pb-1 font-ui text-pico font-bold uppercase tracking-label-3 text-ink-45">
          <div>Hole</div>
          <div>Par / SI</div>
          <div className="text-right">Gr</div>
          <div className="text-right">Net</div>
          <div className="text-right">Pts</div>
        </div>
        {card.holes
          .map((hole, index) => ({ hole, index }))
          .filter(({ hole, index }) => hole.strokes !== null || index === activeIndex)
          .reverse()
          .map(({ hole, index }) => (
            <button
              key={hole.hole}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`grid w-full grid-cols-card-row items-center gap-1 border-b border-paper-shade px-3 py-1 text-left ${
                index === activeIndex ? 'bg-row-active' : ''
              }`}
            >
              <span
                className={`font-num text-micro ${
                  index === activeIndex ? 'text-ink' : 'text-ink-45'
                }`}
              >
                {hole.hole}
              </span>
              <span className="font-num text-chip text-ink-45">
                par {hole.par} · si {hole.si}
                {hole.strokesReceived !== 0
                  ? ` · ${hole.strokesReceived > 0 ? '+' : ''}${hole.strokesReceived}`
                  : ''}
              </span>
              <span className="text-right font-num text-cell font-semibold text-ink">
                {hole.strokes ?? '·'}
              </span>
              <span className="text-right font-num text-micro text-ink-70">
                {hole.net ?? '·'}
              </span>
              <span
                className={`text-right font-num text-cell font-semibold ${
                  hole.points === null
                    ? 'text-ink-25'
                    : hole.points === 0
                      ? 'text-flag'
                      : hole.points >= 3
                        ? 'text-turf'
                        : 'text-ink'
                }`}
              >
                {hole.points ?? '·'}
              </span>
            </button>
          ))}
      </div>

      <div className="flex-none border-t border-rule-strong bg-paper-2 pb-2">
        <Keypad
          activePar={active.par}
          activeValue={active.strokes}
          onDigit={onDigit}
          onTenPlus={onTenPlus}
          onBackspace={onBackspace}
        />

        <div className="flex items-center justify-between gap-3 px-3 pt-2">
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
            <span className="font-ui text-nano font-bold uppercase tracking-label text-turf">
              Saved ✓ · {save.grossTotal} gross
            </span>
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
                  : `${18 - card.entered} holes left`}
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
