/**
 * Server-side write path. Runs only on Vercel (or the local dev middleware in
 * vite.config.ts) — never in the browser.
 *
 * These handlers are deliberately framework-agnostic: they take a parsed body
 * and a client identifier, and return a status plus a JSON body. The thin
 * adapters in api/*.ts and the Vite dev middleware both call into here, so
 * local dev and production run identical logic.
 *
 * PostgREST is called over plain fetch rather than through @supabase/supabase-js.
 * The SDK builds a realtime WebSocket client in its constructor, which throws on
 * Node < 22 ("Node.js 20 detected without native WebSocket support"), and this
 * function does one REST upsert — it has no use for realtime, auth or storage.
 * Talking to the REST endpoint directly avoids the dependency entirely.
 */

import { createHash, timingSafeEqual } from 'node:crypto';

const HOLES = 18;
/** Nobody makes 20 on a hole and still writes it down. Guards typos and abuse. */
const MAX_STROKES = 20;

export interface ApiResult {
  status: number;
  body: Record<string, unknown>;
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}): ApiResult {
  return { status, body: { ok: false, error, ...extra } };
}

/* ─── environment ────────────────────────────────────────────────────────── */

function readEnv(name: string, ...fallbacks: string[]): string | undefined {
  for (const key of [name, ...fallbacks]) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

interface PostgrestConfig {
  url: string;
  serviceKey: string;
}

function getConfig(): PostgrestConfig | { error: string } {
  const url = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url) return { error: 'SUPABASE_URL is not set on the server.' };
  if (!serviceKey) return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server.' };
  return { url: url.replace(/\/+$/, ''), serviceKey };
}

/**
 * One PostgREST request. The service-role key goes in both headers, which is
 * what makes these calls bypass RLS — hence server-only.
 */
async function postgrest(
  config: PostgrestConfig,
  path: string,
  init: { method: string; body?: unknown; prefer?: string },
): Promise<Response> {
  const headers: Record<string, string> = {
    apikey: config.serviceKey,
    authorization: `Bearer ${config.serviceKey}`,
    'content-type': 'application/json',
  };
  if (init.prefer) headers.prefer = init.prefer;

  return fetch(`${config.url}/rest/v1/${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

/* ─── PIN ────────────────────────────────────────────────────────────────── */

/** Compares hashes so neither the PIN's value nor its length leaks via timing. */
function pinMatches(supplied: string, expected: string): boolean {
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Per-instance attempt throttle. Serverless instances are ephemeral and there
 * may be several, so this slows a brute force rather than stopping one — the
 * real defence is a PIN long enough to be worth guessing (6+ non-obvious digits).
 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function throttled(client: string): boolean {
  const now = Date.now();
  const entry = attempts.get(client);
  if (!entry || now > entry.resetAt) {
    attempts.set(client, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

/** Returns null when the PIN is good, or the failure to send back. */
function checkPin(pin: unknown, client: string): ApiResult | null {
  const expected = readEnv('ENTRY_PIN');
  if (!expected) {
    return fail(500, 'ENTRY_PIN is not set on the server.');
  }
  if (typeof pin !== 'string' || pin.length === 0) {
    return fail(400, 'Enter the PIN.');
  }
  if (throttled(client)) {
    return fail(429, 'Too many attempts. Wait a few minutes and try again.');
  }
  if (!pinMatches(pin, expected)) {
    return fail(401, 'Wrong PIN.');
  }
  attempts.delete(client);
  return null;
}

/* ─── POST /api/verify-pin ───────────────────────────────────────────────── */

export async function verifyPin(body: unknown, client: string): Promise<ApiResult> {
  const { pin } = (body ?? {}) as { pin?: unknown };
  const failure = checkPin(pin, client);
  if (failure) return failure;
  return { status: 200, body: { ok: true } };
}

/* ─── POST /api/save-card ────────────────────────────────────────────────── */

export interface SaveCardBody {
  pin: string;
  roundId: number;
  playerId: number;
  /** 18 gross strokes, hole 1 first. */
  strokes: number[];
}

/** True when a row with this id exists. */
async function exists(
  config: PostgrestConfig,
  table: string,
  id: number,
): Promise<boolean | { error: string }> {
  const response = await postgrest(config, `${table}?id=eq.${id}&select=id&limit=1`, {
    method: 'GET',
  });
  if (!response.ok) {
    return { error: `Could not read ${table}: ${await response.text()}` };
  }
  const rows = (await response.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

export async function saveCard(body: unknown, client: string): Promise<ApiResult> {
  const { pin, roundId, playerId, strokes } = (body ?? {}) as Partial<SaveCardBody>;

  const failure = checkPin(pin, client);
  if (failure) return failure;

  if (!Number.isInteger(roundId) || !Number.isInteger(playerId)) {
    return fail(400, 'roundId and playerId must be integers.');
  }

  if (!Array.isArray(strokes) || strokes.length !== HOLES) {
    return fail(400, `Expected ${HOLES} hole scores, got ${Array.isArray(strokes) ? strokes.length : 'none'}.`);
  }
  for (const [i, value] of strokes.entries()) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_STROKES) {
      return fail(400, `Hole ${i + 1} has an impossible score.`);
    }
  }

  // Derived server-side and echoed back for the "saved" confirmation. There is
  // no typed checksum to compare it against any more: cards save as entered, so
  // a mis-keyed hole saves silently. Per-hole validation above is what remains.
  const grossTotal = strokes.reduce((sum, s) => sum + s, 0);

  const config = getConfig();
  if ('error' in config) return fail(500, config.error);

  // Both ids must exist, or the FK violation would surface as an opaque 500.
  for (const [table, id, label] of [
    ['rounds', roundId as number, 'round'],
    ['players', playerId as number, 'player'],
  ] as const) {
    const found = await exists(config, table, id);
    if (typeof found === 'object') return fail(500, found.error);
    if (!found) return fail(404, `No ${label} with id ${id}.`);
  }

  const rows = strokes.map((value, i) => ({
    round_id: roundId,
    player_id: playerId,
    hole: i + 1,
    strokes: value,
  }));

  // resolution=merge-duplicates is PostgREST's upsert: re-entering a card
  // corrects it in place rather than colliding on the primary key.
  const response = await postgrest(config, 'scores?on_conflict=round_id,player_id,hole', {
    method: 'POST',
    body: rows,
    prefer: 'resolution=merge-duplicates,return=minimal',
  });

  if (!response.ok) {
    return fail(500, `Could not save the card: ${await response.text()}`);
  }

  return { status: 200, body: { ok: true, grossTotal } };
}
