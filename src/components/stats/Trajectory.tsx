import type { PlayerStats } from '../../lib/stats';
import { SECTION_LETTER } from './format';

/**
 * Word-sized position charts: where each player stood after every round.
 *
 * The leaderboard can only show where someone finished. Third on the way up
 * and third on the way down are the same number there, and completely
 * different stories.
 */

/**
 * The SVG's internal coordinate space. Matched to --rounds-col and --spark-h
 * so the drawing is never scaled unevenly; the element itself is sized by those
 * tokens, not by these numbers.
 */
const VIEW_W = 76;
const VIEW_H = 20;
const PAD = 3;

function Spark({
  positions,
  fieldSize,
  name,
}: {
  positions: readonly number[];
  fieldSize: number;
  name: string;
}) {
  const count = positions.length;

  const x = (index: number) =>
    count === 1 ? VIEW_W / 2 : PAD + (index / (count - 1)) * (VIEW_W - PAD * 2);

  // Position 1 sits at the top, last place at the bottom. Clamped so a
  // position outside the field can never draw beyond the viewBox.
  const y = (position: number) => {
    if (fieldSize <= 1) return VIEW_H / 2;
    const bounded = Math.min(Math.max(position, 1), fieldSize);
    return PAD + ((bounded - 1) / (fieldSize - 1)) * (VIEW_H - PAD * 2);
  };

  const path = positions
    .map((position, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(position).toFixed(1)}`)
    .join(' ');

  const last = positions[count - 1]!;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-spark-h w-rounds-col overflow-visible"
      role="img"
      aria-label={`${name}: position after each round, ${positions.join(', then ')}`}
    >
      <path
        d={path}
        fill="none"
        stroke="var(--ink-45)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {positions.slice(0, -1).map((position, i) => (
        <circle key={i} cx={x(i)} cy={y(position)} r="1.2" fill="var(--ink-25)" />
      ))}
      {/* Where they stand now. */}
      <circle cx={x(count - 1)} cy={y(last)} r="2.2" fill="var(--flag)" />
    </svg>
  );
}

export function Trajectory({
  players,
  scoredRounds,
}: {
  players: readonly PlayerStats[];
  scoredRounds: number;
}) {
  // Ordered by where they stand now, so the chart reads top to bottom like the
  // leaderboard does.
  const ordered = [...players]
    .filter((player) => player.trajectory.length > 0)
    .sort(
      (a, b) =>
        a.trajectory[a.trajectory.length - 1]! - b.trajectory[b.trajectory.length - 1]! ||
        a.name.localeCompare(b.name),
    );

  return (
    <section className="px-gutter pt-4 pb-2">
      <div className="flex items-baseline gap-2 pb-3">
        <span className={SECTION_LETTER}>D</span>
        <h2 className="letterpress font-display text-section text-ink">Trajectory</h2>
      </div>

      {scoredRounds < 2 ? (
        <p className="font-num text-chip leading-body text-ink-45">
          One round in. This fills out once a second set of cards is entered —
          it needs at least two standings to draw a line between.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-trajectory gap-2 border-b-strong border-ink pb-1 font-ui text-nano font-bold uppercase tracking-label-3 text-ink-45">
            <div>Player</div>
            <div className="text-center">R1 → R{scoredRounds}</div>
            <div className="text-right">+/−</div>
          </div>

          {ordered.map((player) => {
            const first = player.trajectory[0]!;
            const now = player.trajectory[player.trajectory.length - 1]!;
            const moved = first - now; // positive means they climbed

            return (
              <div
                key={player.playerId}
                className="grid grid-cols-trajectory items-center gap-2 border-b border-rule-soft py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-display text-body leading-name text-ink">
                    {player.name}
                  </div>
                  <div className="font-ui text-pico font-semibold uppercase tracking-nav text-ink-45">
                    {first} → {now}
                  </div>
                </div>

                <div className="flex justify-center">
                  <Spark
                    positions={player.trajectory}
                    fieldSize={players.length}
                    name={player.name}
                  />
                </div>

                <div
                  className={`text-right font-num text-strip font-semibold ${
                    moved > 0 ? 'text-turf' : moved < 0 ? 'text-flag' : 'text-ink-25'
                  }`}
                >
                  {moved > 0 ? `+${moved}` : moved < 0 ? String(moved) : '–'}
                </div>
              </div>
            );
          })}

          <p className="pt-2 font-num text-nano leading-body text-ink-45">
            standing after each round · top of the box is 1st · red dot is now
          </p>
        </>
      )}
    </section>
  );
}
