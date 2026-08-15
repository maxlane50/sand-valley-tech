import type { Superlative } from '../../lib/stats';

/** The dark block at the foot of the screen — the argument at the bar. */
export function Superlatives({ items }: { items: readonly Superlative[] }) {
  if (items.length === 0) return null;

  return (
    <section className="bg-turf-deep px-gutter pt-4 pb-6">
      <div className="flex items-baseline gap-2 pb-3">
        <span className="font-num text-micro text-sand">D</span>
        <h2 className="font-display text-section text-paper">Superlatives</h2>
      </div>

      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between gap-3 border-t border-leader-chip py-3"
        >
          <div className="min-w-0">
            <div className="font-ui text-nano font-bold uppercase tracking-label text-fescue">
              {item.label}
            </div>
            <div className="truncate font-display text-section leading-name text-paper">
              {item.name}
            </div>
            <div className="font-num text-chip text-ink-on-turf">{item.note}</div>
          </div>
          <span className="flex-none font-num text-super font-semibold leading-none text-sand">
            {item.value}
          </span>
        </div>
      ))}
    </section>
  );
}
