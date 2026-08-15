const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function relativeToPar(value: number, par: number): string {
  const delta = value - par;
  if (delta === 0) return 'par';
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * 1-9 set the score and auto-advance. "10+" sets 10 and then increments on
 * repeat taps without advancing, since a score above 9 is rare and worth a
 * second tap rather than a second screen.
 *
 * There is no "no score" key: every player holes out, so cards are entered
 * complete. The NULL path stays live in the scoring module and schema as the
 * fallback if someone ever takes an X.
 *
 * The grid fills whatever height is left over, so on a taller phone the keys
 * simply get bigger — this is the screen where 126 numbers get typed.
 */
export function Keypad({
  activePar,
  activeValue,
  onDigit,
  onTenPlus,
  onBackspace,
}: {
  activePar: number;
  activeValue: number | null;
  onDigit: (value: number) => void;
  onTenPlus: () => void;
  onBackspace: () => void;
}) {
  const keyClass =
    'flex h-full min-h-key-h flex-col items-center justify-center rounded-md border border-key-border active:translate-y-px';

  return (
    // min-h-0 lets the keypad absorb the squeeze on a very short viewport, so
    // Save stays reachable rather than being pushed off the bottom.
    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-2 overflow-hidden px-3 pt-2">
      {DIGITS.map((digit) => {
        const isPar = digit === activePar;
        return (
          <button
            key={digit}
            type="button"
            onClick={() => onDigit(digit)}
            aria-label={`Score ${digit}, ${relativeToPar(digit, activePar)}`}
            className={`${keyClass} ${
              isPar ? 'border-turf-deep bg-turf-deep text-paper' : 'bg-paper text-ink'
            }`}
          >
            <span className="font-num text-pts font-semibold leading-none">{digit}</span>
            <span className="pt-px font-ui text-pico font-bold uppercase tracking-nav opacity-60">
              {relativeToPar(digit, activePar)}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={onTenPlus}
        aria-label="Ten or more"
        className={`${keyClass} bg-paper-2 text-ink-70`}
      >
        <span className="font-num text-num-m font-semibold leading-none">
          {activeValue !== null && activeValue >= 10 ? activeValue + 1 : '10+'}
        </span>
        <span className="pt-px font-ui text-pico font-bold uppercase tracking-nav opacity-60">
          tap again
        </span>
      </button>

      <button
        type="button"
        onClick={onBackspace}
        aria-label="Delete score"
        className={`${keyClass} col-span-2 bg-paper-2 text-flag`}
      >
        <span className="font-num text-pts font-semibold leading-none">⌫</span>
        <span className="pt-px font-ui text-pico font-bold uppercase tracking-nav opacity-60">
          clear hole
        </span>
      </button>
    </div>
  );
}
