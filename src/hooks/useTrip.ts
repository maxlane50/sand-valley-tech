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

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setState({ status: 'unconfigured' });
      return;
    }
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', data: await fetchTrip() });
    } catch (error) {
      setState({ status: 'error', message: (error as Error).message });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
