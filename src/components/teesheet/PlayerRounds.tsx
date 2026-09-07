import type { Pairings } from '../../lib/teeSheet';
import { SECTION_LETTER } from '../stats/format';

/**
 * Who is out for what.
 *
 * The five marks read in the same order as the sheet above, so a gap is the
 * round somebody sits out and you can see which one without counting. The
 * figure on the right is the part that reaches the leaderboard: not everybody
 * plays all three Cup rounds, and a player who misses one carries a blank
 * round on the board rather than a bad one.
 */
export function PlayerRounds({
  pairings,
  cupRounds,
  selected,
  onSelect,
}: {
  pairings: Pairings;
  /** How many of the rounds on the sheet count for the Cup. */
  cupRounds: number;
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  if (pairings.players.length === 0) return null;
  const total = pairings.players[0]!.groups.length;

  return (
    <section className="border-b border-rule px-gutter pt-3 pb-3">
      <div className="flex items-baseline gap-2 pb-1">
        <span className={SECTION_LETTER}>B</span>
        <h2 className="font-display text-section leading-name text-ink">Who plays what</h2>
      </div>
      <p className="pb-1 font-display text-list italic leading-body text-ink-45">
        Five marks, in the order of the sheet above. A gap is a round sat out.
      </p>

      {pairings.players.map((player) => {
        const following = player.name === selected;
        return (
          <button
            key={player.name}
            type="button"
            onClick={() => onSelect(following ? null : player.name)}
            aria-pressed={following}
            className={`flex w-full items-baseline justify-between gap-2 border-b border-rule-soft py-2 text-left last:border-b-0 ${
              following ? 'bg-paper-shade' : ''
            }`}
          >
            <span
              className={`min-w-0 flex-1 truncate font-display text-list leading-name ${
                following ? 'font-semibold text-turf' : 'text-ink'
              }`}
            >
              {player.name}
            </span>

            <span className="flex flex-none gap-hair font-num text-chip leading-none">
              {player.groups.map((group, index) => (
                <span
                  key={index}
                  className={group ? 'text-ink' : 'text-ink-25'}
                  aria-hidden="true"
                >
                  {group ? '●' : '○'}
                </span>
              ))}
            </span>

            <span className="flex-none font-num text-chip uppercase tracking-caption text-ink-45">
              {player.rounds} of {total} ·{' '}
              <span className={player.cupRounds < cupRounds ? 'text-flag' : 'text-turf'}>
                {player.cupRounds} cup
              </span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
