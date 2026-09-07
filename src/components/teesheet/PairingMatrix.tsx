import { shortLabels } from '../../lib/roundGrid';
import type { Pairings } from '../../lib/teeSheet';
import { SECTION_LETTER } from '../stats/format';

/**
 * How many rounds each pair share a group.
 *
 * The workbook keeps this on its own tab; nothing here reads those figures.
 * They are recomputed from the groups, so moving a name moves the grid.
 *
 * Drawn in full rather than as a triangle: on a phone you find your row and
 * read across, and having to work out which half of a triangle your pair falls
 * in is exactly the friction this is meant to remove. The cost is that every
 * figure appears twice, which nobody has ever noticed on a printed sheet.
 */
function cellTint(count: number, most: number): string {
  if (count === 0) return 'bg-tint-bad text-flag';
  if (count >= most && most > 1) return 'bg-tint-good text-turf';
  if (count > 1) return 'bg-paper-shade text-ink';
  return 'text-ink-70';
}

export function PairingMatrix({
  pairings,
  selected,
  onSelect,
}: {
  pairings: Pairings;
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const { roster, together, most } = pairings;
  if (roster.length === 0) return null;

  const labels = shortLabels([...roster], 3);
  const columns = `var(--cell-col) repeat(${roster.length}, minmax(0, 1fr))`;

  return (
    <section className="border-b border-rule px-gutter pt-3 pb-3">
      <div className="flex items-baseline gap-2 pb-1">
        <span className={SECTION_LETTER}>A</span>
        <h2 className="font-display text-section leading-name text-ink">
          Rounds together
        </h2>
      </div>
      <p className="pb-2 font-display text-list italic leading-body text-ink-45">
        Of the five rounds, how many each pair share a group.
      </p>

      <div className="grid items-stretch" style={{ gridTemplateColumns: columns }}>
        <div />
        {roster.map((name, index) => (
          <div
            key={name}
            className={`pb-1 text-center font-ui text-pico font-bold uppercase tracking-nav ${
              name === selected ? 'text-turf' : 'text-ink-45'
            }`}
          >
            {labels[index]}
          </div>
        ))}

        {roster.map((rowName, rowIndex) => {
          const rowFollowed = rowName === selected;
          return (
            <div key={rowName} className="contents">
              <button
                type="button"
                onClick={() => onSelect(rowFollowed ? null : rowName)}
                aria-pressed={rowFollowed}
                className={`border-r border-rule pr-1 text-right font-ui text-pico font-bold uppercase tracking-nav ${
                  rowFollowed ? 'text-turf' : 'text-ink-45'
                }`}
              >
                {labels[rowIndex]}
              </button>

              {roster.map((colName) => {
                if (colName === rowName) {
                  return (
                    <div
                      key={colName}
                      className="border-b border-rule-soft bg-paper-2 py-1 text-center font-num text-chip text-ink-25"
                    >
                      —
                    </div>
                  );
                }
                const count = together(rowName, colName);
                // With somebody followed, only their cross stays inked — the
                // rest of the grid is still there, just out of the way.
                const inCross =
                  selected === null || rowFollowed || colName === selected;
                return (
                  <div
                    key={colName}
                    title={`${rowName} and ${colName}: ${count} of 5 rounds`}
                    className={`border-b border-rule-soft py-1 text-center font-num text-chip leading-none ${
                      inCross ? cellTint(count, most) : 'text-ink-25'
                    }`}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {pairings.neverTogether.map(([a, b]) => (
        <p key={`${a}-${b}`} className="pt-2 font-num text-chip leading-body text-ink-70">
          <span className="text-flag">0</span> — {a} and {b} never share a group.
        </p>
      ))}

      {pairings.players
        .filter((player) => player.reachable < roster.length - 1)
        .map((player) => (
          <p
            key={player.name}
            className="pt-1 font-num text-chip leading-body text-ink-70"
          >
            {player.name} plays {player.rounds}{' '}
            {player.rounds === 1 ? 'round' : 'rounds'}, so can meet at most{' '}
            {player.reachable} of the other {roster.length - 1}.
          </p>
        ))}
    </section>
  );
}
