import { useCallback, useEffect, useState } from 'react';

import { fetchTrip } from '../lib/queries';
import { isSupabaseConfigured } from '../lib/supabase';
import type { TripData } from '../lib/types';

type State =
  | { status: 'unconfigured' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: TripData };

export function useTrip() {
  const [state, setState] = useState<State>(
    isSupabaseConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  );

  /**
   * `silent` swaps the data underneath the current view without dropping back
   * to a loading state. That matters for two reasons: the rows stay mounted so
   * the leaderboard can animate from the old order to the new one, and a failed
   * background refresh leaves the last known standings on screen rather than
   * blanking the board on patchy course wifi.
   */
  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!isSupabaseConfigured) {
      setState({ status: 'unconfigured' });
      return;
    }
    if (!options?.silent) setState({ status: 'loading' });
    try {
      setState({ status: 'ready', data: await fetchTrip() });
    } catch (error) {
      if (options?.silent) return;
      setState({ status: 'error', message: (error as Error).message });
    }
  }, []);

  const reload = useCallback(() => load(), [load]);
  const refresh = useCallback(() => load({ silent: true }), [load]);

  useEffect(() => {
    void load();
  }, [load]);

  // Someone else entering a card is the usual reason the standings move, so
  // pick up changes whenever the app returns to the foreground.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  return { state, reload, refresh };
}
