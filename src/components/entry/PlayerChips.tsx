import { shortLabels } from '../../lib/roundGrid';
import type { PlayerRecord } from '../../lib/types';
import { HOLES_PER_ROUND } from '../../scoring/scoring';

/**
 * Direct player switching. Replaces the two arrow glyphs, which were 10px
 * with no padding and effectively untappable — and stepping through seven
 * players one at a time was the wrong interaction anyway when you can just
 * point at the one you want.
 *
 * A tick means that player's card is already saved in full, so this doubles as
 * the answer to "who still needs entering". It reflects what is in the
 * database, not what is on screen unsaved.
 */
export function PlayerChips({
  players,
  currentId,
  entered,
  onSelect,
}: {
  players: readonly PlayerRecord[];
  currentId: number;
  entered: ReadonlyMap<number, number>;
  onSelect: (playerId: number) => void;
}) {
  const labels = shortLabels(players.map((p) => p.name));

  return (
    <div className="flex flex-none gap-hair border-b border-rule-strong bg-paper-2 px-2 py-1">
      {players.map((player, index) => {
        const isCurrent = player.id === currentId;
        const done = (entered.get(player.id) ?? 0) >= HOLES_PER_ROUND;

        return (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelect(player.id)}
            aria-current={isCurrent}
            aria-label={`${player.name}${done ? ', card saved' : ''}`}
            className={`flex min-h-hit-min min-w-0 flex-1 flex-col items-center justify-center rounded-sm px-1 ${
              isCurrent ? 'bg-turf-deep' : done ? 'bg-paper-shade' : ''
            }`}
          >
            <span
              className={`w-full truncate text-center font-ui text-nano font-bold uppercase tracking-nav ${
                isCurrent ? 'text-paper' : done ? 'text-ink-45' : 'text-ink'
              }`}
            >
              {labels[index]}
            </span>
            {/* Non-breaking space keeps every chip the same height. */}
            <span
              className={`font-num text-pico leading-none ${
                isCurrent ? 'text-sand' : 'text-turf'
              }`}
            >
              {done ? '✓' : ' '}
            </span>
          </button>
        );
      })}
    </div>
  );
}
