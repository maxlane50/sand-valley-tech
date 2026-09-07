/**
 * The eight names, as a filter over the whole sheet.
 *
 * Tapping one does not navigate anywhere — it emphasises that player
 * everywhere below: their group in each round stays inked while the other
 * dims, rounds they sit out grey off, and their row and column light up in the
 * pairing matrix. Tap again to clear.
 *
 * Four to a row rather than one long scrolling strip: eight short first names
 * fit twice over at 390px, and a name you have to scroll to find is no use as
 * a filter.
 */
export function PlayerFilter({
  roster,
  selected,
  onSelect,
}: {
  roster: readonly string[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  return (
    <div className="flex-none border-b border-rule bg-paper-2 px-gutter pt-2 pb-3">
      <div className="pb-1 font-ui text-nano font-bold uppercase tracking-label text-ink-45">
        {selected ? `Following ${selected} — tap again to clear` : 'Tap a name to follow them'}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {roster.map((name) => {
          const isSelected = name === selected;
          return (
            <button
              key={name}
              type="button"
              onClick={() => onSelect(isSelected ? null : name)}
              aria-pressed={isSelected}
              className={`min-h-hit-min truncate rounded-sm px-1 font-ui text-nano font-bold uppercase tracking-nav ${
                isSelected ? 'bg-turf-deep text-paper' : 'bg-paper text-ink-70'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
