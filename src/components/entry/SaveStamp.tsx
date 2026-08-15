import { useCountUp } from '../../hooks/useMotion';

/**
 * The payoff for typing eighteen numbers.
 *
 * It takes over the keypad area rather than appearing as a toast: the card is
 * saved, so there is nothing left to type, and the biggest area on screen is
 * where the thumb already is. --fs-num-hero was defined for this screen in the
 * original mock and had been orphaned.
 *
 * Both animations are plain CSS, so the reduced-motion block in index.css
 * neutralises them without any JS involvement.
 */
export function SaveStamp({
  grossTotal,
  points,
  vsPar,
  nextName,
  onNext,
  onDismiss,
}: {
  grossTotal: number;
  points: number;
  vsPar: string;
  nextName?: string;
  onNext?: () => void;
  onDismiss: () => void;
}) {
  const gross = useCountUp(grossTotal);

  return (
    <div className="flex flex-1 flex-col items-center justify-center border-t border-rule-strong bg-paper-2 px-gutter pb-3">
      <div className="stamp-in flex flex-col items-center">
        <div className="font-ui text-micro font-bold uppercase tracking-eyebrow text-turf">
          Card saved
        </div>

        <div className="letterpress font-num text-num-hero font-semibold leading-none text-ink">
          {gross}
        </div>

        {/* Drawn left to right, like a pen ruling off the total. */}
        <div className="rule-draw h-px w-full bg-ink" />

        <div className="pt-1 font-ui text-nano font-bold uppercase tracking-label text-ink-45">
          gross {vsPar} · {points} points
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 pt-5">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-hit-min font-ui text-nano font-semibold uppercase tracking-nav text-ink-45"
        >
          ◀ Back to card
        </button>

        {onNext ? (
          <button
            type="button"
            onClick={onNext}
            className="min-h-hit-min rounded-md bg-turf-deep px-4 font-ui text-micro font-bold uppercase tracking-label text-paper"
          >
            {nextName ? `Next · ${nextName}` : 'Next'} ▶
          </button>
        ) : (
          <span className="font-ui text-nano font-bold uppercase tracking-label text-turf">
            All cards in ✓
          </span>
        )}
      </div>
    </div>
  );
}
