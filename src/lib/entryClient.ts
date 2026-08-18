/** Thin client for the two serverless endpoints in /api. */

export interface ApiFailure {
  status: number;
  error: string;
}

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; failure: ApiFailure };

async function post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      failure: { status: 0, error: 'No connection. Scores are not saved.' },
    };
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // A non-JSON response usually means /api isn't running at all.
  }

  if (!response.ok || payload.ok !== true) {
    return {
      ok: false,
      failure: {
        status: response.status,
        error: (payload.error as string) ?? `Save failed (${response.status}).`,
      },
    };
  }

  return { ok: true, data: payload as T };
}

export function verifyPin(pin: string) {
  return post<{ ok: true }>('/api/verify-pin', { pin });
}

export function saveCard(input: {
  pin: string;
  roundId: number;
  playerId: number;
  strokes: number[];
}) {
  return post<{ ok: true; grossTotal: number }>('/api/save-card', input);
}

export function savePlayers(input: {
  pin: string;
  players: { id?: number; name: string; handicapIndex: number }[];
  deleteIds: number[];
}) {
  return post<{ ok: true; inserted: number; updated: number; deleted: number }>(
    '/api/save-players',
    input,
  );
}

/** `dataUrl` null removes the photo. */
export function savePhoto(input: {
  pin: string;
  playerId: number;
  dataUrl: string | null;
}) {
  return post<{ ok: true; bytes?: number; removed?: boolean }>('/api/save-photo', input);
}

export function saveTees(input: {
  pin: string;
  roundId: number;
  defaultTee: string;
  assignments: { playerId: number; teeName: string }[];
}) {
  return post<{ ok: true; assigned: number }>('/api/save-tees', input);
}

/* ─── PIN storage ─────────────────────────────────────────────────────────
   sessionStorage, so it clears when the tab closes. This is a convenience
   gate on the UI — the PIN is checked server-side on every write, which is
   the boundary that actually matters.                                      */

const PIN_KEY = 'sv:entry-pin';

export function loadPin(): string | null {
  try {
    return sessionStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

export function storePin(pin: string): void {
  try {
    sessionStorage.setItem(PIN_KEY, pin);
  } catch {
    // Private browsing; the PIN just won't persist across reloads.
  }
}

export function clearPin(): void {
  try {
    sessionStorage.removeItem(PIN_KEY);
  } catch {
    // Nothing to do.
  }
}
