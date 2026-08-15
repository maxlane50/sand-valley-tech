import type { GroupStats, PlayerStats } from '../../lib/stats';
import { SECTION_LETTER } from './format';

export function ScoringCountsSection({
  players,
  group,
}: {
  players: readonly PlayerStats[];
  group: GroupStats;
}) {
  // Ordered by birdies, as design.html does, rather than inheriting section A's
  // points-per-hole order.
  const ordered = [...players].sort(
    (a, b) => b.counts.birdies - a.counts.birdies || a.name.localeCompare(b.name),
  );
  const played = ordered.filter((p) => p.holesPlayed > 0);
  const mostBirdies = Math.max(0, ...played.map((p) => p.counts.birdies));
  const mostBlowups = Math.max(0, ...played.map((p) => p.counts.blowups));

  return (
    <section className="px-gutter pt-4 pb-2">
      <div className="flex items-baseline gap-2 pb-3">
        <span className={SECTION_LETTER}>C</span>
        <h2 className="font-display text-section text-ink">Scoring counts</h2>
      </div>

      <div className="grid grid-cols-counts gap-1 border-b-strong border-ink pb-1 font-ui text-nano font-bold uppercase tracking-nav text-ink-45">
        <div>Player</div>
        <div className="text-right">Bird</div>
        <div className="text-right">Par</div>
        <div className="text-right">Bog</div>
        <div className="text-right">Blow</div>
      </div>

      {ordered.map((player) => (
        <div
          key={player.playerId}
          className="grid grid-cols-counts items-center gap-1 border-b border-rule-soft py-2"
        >
          <span className="truncate font-display text-body text-ink">{player.name}</span>
          <span
            className={`text-right font-num text-strip font-semibold ${
              player.counts.birdies === mostBirdies && mostBirdies > 0
                ? 'text-turf'
                : 'text-ink'
            }`}
          >
            {player.counts.birdies}
          </span>
          <span className="text-right font-num text-strip text-ink">{player.counts.pars}</span>
          <span className="text-right font-num text-strip text-ink-70">
            {player.counts.bogeys}
          </span>
          <span
            className={`text-right font-num text-strip font-semibold ${
              player.counts.blowups === mostBlowups && mostBlowups > 0
                ? 'text-flag'
                : 'text-ink-70'
            }`}
          >
            {player.counts.blowups}
          </span>
        </div>
      ))}

      {/* Group totals — the brief asks for these counts group-wide too. */}
      <div className="grid grid-cols-counts items-center gap-1 border-y-strong border-ink bg-paper-2 py-2">
        <span className="font-ui text-micro font-bold uppercase tracking-label text-ink">
          Group
        </span>
        <span className="text-right font-num text-strip font-semibold text-ink">
          {group.counts.birdies}
        </span>
        <span className="text-right font-num text-strip text-ink">{group.counts.pars}</span>
        <span className="text-right font-num text-strip text-ink-70">
          {group.counts.bogeys}
        </span>
        <span className="text-right font-num text-strip font-semibold text-ink-70">
          {group.counts.blowups}
        </span>
      </div>

      <p className="pt-2 font-num text-nano leading-body text-ink-45">
        gross vs par · bird includes eagles · blow = double bogey or worse
      </p>
    </section>
  );
}
