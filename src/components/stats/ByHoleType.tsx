import type { GroupStats, HoleTypeStat, PlayerStats } from '../../lib/stats';
import { SECTION_LETTER, averageClass, pointsTint, signed } from './format';

/** The centrepiece: who owns which hole type. */
function TypeCell({ stat }: { stat: HoleTypeStat }) {
  return (
    <div
      className={`flex flex-col items-center gap-hair rounded-sm py-1 ${pointsTint(
        stat.pointsPerHole,
      )}`}
    >
      <span
        className={`font-num text-list font-semibold leading-none ${averageClass(
          stat.averageVsPar,
        )}`}
      >
        {stat.averageVsPar === null ? '–' : signed(stat.averageVsPar)}
      </span>
      <span className="font-num text-nano leading-none text-ink-70">
        {stat.pointsPerHole === null ? '–' : `${stat.pointsPerHole.toFixed(1)} pt`}
      </span>
    </div>
  );
}

export function ByHoleType({
  players,
  group,
}: {
  players: readonly PlayerStats[];
  group: GroupStats;
}) {
  return (
    <section className="px-gutter pt-4 pb-2">
      <div className="flex items-baseline gap-2 pb-3">
        <span className={SECTION_LETTER}>A</span>
        <h2 className="letterpress font-display text-section text-ink">By hole type</h2>
      </div>

      <div className="grid grid-cols-hole-type gap-2 border-b-strong border-ink pb-1 font-ui text-nano font-bold uppercase tracking-label-3 text-ink-45">
        <div>Player</div>
        <div className="text-center">Par 3</div>
        <div className="text-center">Par 4</div>
        <div className="text-center">Par 5</div>
      </div>

      {players.map((player) => (
        <div
          key={player.playerId}
          className="grid grid-cols-hole-type items-center gap-2 border-b border-rule-soft py-2"
        >
          <div className="min-w-0">
            <div className="truncate font-display text-body leading-name text-ink">
              {player.name}
            </div>
            <div
              className={`truncate font-ui text-pico font-bold uppercase tracking-nav ${
                player.tag
                  ? player.tag.tone === 'good'
                    ? 'text-turf'
                    : 'text-flag'
                  : 'text-ink-45'
              }`}
            >
              {player.tag ? player.tag.text : `hcp ${player.handicapIndex.toFixed(1)}`}
            </div>
          </div>
          {player.byType.map((stat) => (
            <TypeCell key={stat.par} stat={stat} />
          ))}
        </div>
      ))}

      {/* Group row is not in design.html — added because the brief asks for
          these figures "per player and group-wide".

          It is the only row here with a background, so it bleeds to the screen
          edges and pads its content back in by the same gutter. That keeps the
          columns aligned with the rows above while giving the band breathing
          room, and matches the full-width OUT/IN/TOT bands on round detail. */}
      <div className="-mx-gutter grid grid-cols-hole-type items-center gap-2 border-y-strong border-ink bg-paper-2 px-gutter py-2">
        <div className="min-w-0">
          <div className="font-ui text-micro font-bold uppercase tracking-label text-ink">
            Group
          </div>
          <div className="font-ui text-pico font-semibold uppercase tracking-nav text-ink-45">
            {group.holesPlayed} holes
          </div>
        </div>
        {group.byType.map((stat) => (
          <TypeCell key={stat.par} stat={stat} />
        ))}
      </div>

    </section>
  );
}
