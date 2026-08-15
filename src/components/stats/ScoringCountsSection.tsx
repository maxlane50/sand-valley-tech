import type { GroupStats, PlayerStats, ScoringCounts } from '../../lib/stats';
import { SECTION_LETTER } from './format';

/** Eagles are their own column; birdies means exactly one under. */
const COLUMNS: { key: keyof ScoringCounts; label: string }[] = [
  { key: 'eagles', label: 'Eag' },
  { key: 'birdies', label: 'Bird' },
  { key: 'pars', label: 'Par' },
  { key: 'bogeys', label: 'Bog' },
  { key: 'blowups', label: 'Blow' },
];

function figureClass(
  key: keyof ScoringCounts,
  value: number,
  best: { eagles: number; birdies: number; blowups: number },
): string {
  if (key === 'eagles') {
    return value > 0 ? 'text-turf font-semibold' : 'text-ink-25';
  }
  if (key === 'birdies') {
    return value === best.birdies && best.birdies > 0
      ? 'text-turf font-semibold'
      : 'text-ink';
  }
  if (key === 'blowups') {
    return value === best.blowups && best.blowups > 0
      ? 'text-flag font-semibold'
      : 'text-ink-70';
  }
  return key === 'bogeys' ? 'text-ink-70' : 'text-ink';
}

export function ScoringCountsSection({
  players,
  group,
}: {
  players: readonly PlayerStats[];
  group: GroupStats;
}) {
  // Ordered by birdies, as design.html does, rather than inheriting section A's
  // points-per-hole order. Eagles break the tie.
  const ordered = [...players].sort(
    (a, b) =>
      b.counts.birdies - a.counts.birdies ||
      b.counts.eagles - a.counts.eagles ||
      a.name.localeCompare(b.name),
  );
  const played = ordered.filter((p) => p.holesPlayed > 0);
  const best = {
    eagles: Math.max(0, ...played.map((p) => p.counts.eagles)),
    birdies: Math.max(0, ...played.map((p) => p.counts.birdies)),
    blowups: Math.max(0, ...played.map((p) => p.counts.blowups)),
  };

  return (
    <section className="px-gutter pt-4 pb-2">
      <div className="flex items-baseline gap-2 pb-3">
        <span className={SECTION_LETTER}>C</span>
        <h2 className="letterpress font-display text-section text-ink">Scoring counts</h2>
      </div>

      <div className="grid grid-cols-counts gap-1 border-b-strong border-ink pb-1 font-ui text-nano font-bold uppercase tracking-nav text-ink-45">
        <div>Player</div>
        {COLUMNS.map((column) => (
          <div key={column.key} className="text-right">
            {column.label}
          </div>
        ))}
      </div>

      {ordered.map((player) => (
        <div
          key={player.playerId}
          className="grid grid-cols-counts items-center gap-1 border-b border-rule-soft py-2"
        >
          <span className="truncate font-display text-body text-ink">{player.name}</span>
          {COLUMNS.map((column) => (
            <span
              key={column.key}
              className={`text-right font-num text-strip ${figureClass(
                column.key,
                player.counts[column.key],
                best,
              )}`}
            >
              {player.counts[column.key]}
            </span>
          ))}
        </div>
      ))}

      {/* Group totals — the brief asks for these counts group-wide too. */}
      <div className="grid grid-cols-counts items-center gap-1 border-y-strong border-ink bg-paper-2 py-2">
        <span className="font-ui text-micro font-bold uppercase tracking-label text-ink">
          Group
        </span>
        {COLUMNS.map((column) => (
          <span
            key={column.key}
            className={`text-right font-num text-strip font-semibold ${
              column.key === 'bogeys' || column.key === 'blowups' ? 'text-ink-70' : 'text-ink'
            }`}
          >
            {group.counts[column.key]}
          </span>
        ))}
      </div>

      <p className="pt-2 font-num text-nano leading-body text-ink-45">
        gross vs par · eagle = two under or better · blow = double bogey or worse
      </p>
    </section>
  );
}
