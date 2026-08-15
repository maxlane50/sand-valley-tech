import { useState, type FormEvent } from 'react';

import { TRIP } from '../../config/trip';
import { storePin, verifyPin } from '../../lib/entryClient';

export function PinGate({ onUnlock }: { onUnlock: (pin: string) => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!pin || checking) return;
    setChecking(true);
    setError(null);

    const result = await verifyPin(pin);
    setChecking(false);

    if (!result.ok) {
      setError(result.failure.error);
      setPin('');
      return;
    }
    storePin(pin);
    onUnlock(pin);
  }

  return (
    <div className="flex flex-1 flex-col justify-center bg-turf-deep px-gutter">
      <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-fescue">
        {TRIP.title} · score entry
      </div>
      <div className="letterpress-dark pt-1 font-display text-page leading-tight text-paper">Locked</div>
      <p className="pt-2 font-num text-chip leading-body text-ink-on-turf">
        Everyone can read the board. Only this screen needs the PIN.
      </p>

      <form onSubmit={submit} className="pt-5">
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
          aria-label="Entry PIN"
          placeholder="PIN"
          className="w-full rounded-md border border-turf bg-turf px-3 py-3 text-center font-num text-num-l text-paper placeholder:text-ink-on-turf focus:border-sand focus:outline-none"
        />
        <button
          type="submit"
          disabled={!pin || checking}
          className="mt-2 min-h-hit-min w-full rounded-md bg-sand font-ui text-micro font-bold uppercase tracking-label text-ink disabled:bg-turf disabled:text-ink-on-turf"
        >
          {checking ? 'Checking' : 'Unlock'}
        </button>
      </form>

      {error ? (
        <p role="alert" className="pt-3 font-num text-chip leading-body text-sand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
