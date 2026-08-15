import type { HoleDifficulty } from '../../lib/stats';
import { SECTION_LETTER, signed } from './format';

/**
 * Which holes actually played hardest and easiest — ranked purely on the
 * group's mean gross strokes over par. Nothing here is relative to the card's
 * stroke index; the SI is shown only as context for the hole.
 */
function Group({
  title,
  tone,
  holes,
}: {
  title: string;
  tone: 'hard' | 'easy';
  holes: readonly HoleDifficulty[];
}) {
  const colour = tone === 'hard' ? 'text-flag' : 'text-turf';
  return (
    <div>
      <div className={`pb-1 font-ui text-nano font-bold uppercase tracking-label ${colour}`}>
        {title}
      </div>
      {holes.map((hole) => (
        <div
          key={`${hole.roundId}:${hole.hole}`}
          className="grid grid-cols-difficulty items-center gap-2 border-t border-paper-3 py-2"
        >
          <div className="min-w-0">
            <div className="truncate font-display text-list leading-name text-ink">
              Hole {hole.hole} · par {hole.par}
            </div>
            <div className="truncate font-ui text-pico font-semibold uppercase tracking-caption text-ink-45">
              {hole.courseName} · SI {hole.si}
            </div>
          </div>
          <div className={`text-right font-num text-list font-semibold ${colour}`}>
            {signed(hole.averageVsPar, 2)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HoleDifficultySection({
  hardest,
  easiest,
}: {
  hardest: readonly HoleDifficulty[];
  easiest: readonly HoleDifficulty[];
}) {
  return (
    <section className="mt-3 border-y border-rule-strong bg-paper-2 px-gutter py-4">
      <div className="flex items-baseline gap-2 pb-3">
        <span className={SECTION_LETTER}>B</span>
        <h2 className="letterpress font-display text-section text-ink">Hardest &amp; easiest holes</h2>
      </div>

      <div className="flex flex-col gap-4">
        <Group title="Hardest three" tone="hard" holes={hardest} />
        <Group title="Easiest three" tone="easy" holes={easiest} />
      </div>

    </section>
  );
}
