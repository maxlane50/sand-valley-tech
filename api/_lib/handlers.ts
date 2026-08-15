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

/* ─── POST /api/save-players ─────────────────────────────────────────────── */

export interface PlayerInput {
  /** Absent for a new player. */
  id?: number;
  name: string;
  handicapIndex: number;
}

export interface SavePlayersBody {
  pin: string;
  players: PlayerInput[];
  /** Ids to remove. Refused for anyone who has already posted a score. */
  deleteIds?: number[];
}

/** Plus handicaps are negative; 54.0 is the USGA maximum index. */
const MIN_INDEX = -10;
const MAX_INDEX = 54;
const MAX_NAME = 40;

/** Indexes are stored to one decimal, matching numeric(4,1) in the schema. */
function roundIndex(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function savePlayers(body: unknown, client: string): Promise<ApiResult> {
  const { pin, players, deleteIds } = (body ?? {}) as Partial<SavePlayersBody>;

  const failure = checkPin(pin, client);
  if (failure) return failure;

  if (!Array.isArray(players)) {
    return fail(400, 'players must be an array.');
  }

  const cleaned: PlayerInput[] = [];
  for (const entry of players) {
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    if (!name) return fail(400, 'Every player needs a name.');
    if (name.length > MAX_NAME) {
      return fail(400, `"${name.slice(0, 12)}…" is too long; keep names under ${MAX_NAME} characters.`);
    }
    const index = Number(entry?.handicapIndex);
    if (!Number.isFinite(index) || index < MIN_INDEX || index > MAX_INDEX) {
      return fail(400, `${name} has an impossible handicap index. Use ${MIN_INDEX} to ${MAX_INDEX}, negative for a plus handicap.`);
    }
    if (entry.id !== undefined && !Number.isInteger(entry.id)) {
      return fail(400, 'Player ids must be integers.');
    }
    cleaned.push({ id: entry.id, name, handicapIndex: roundIndex(index) });
  }

  const removing = Array.isArray(deleteIds) ? deleteIds : [];
  if (removing.some((id) => !Number.isInteger(id))) {
    return fail(400, 'Player ids must be integers.');
  }

  const config = getConfig();
  if ('error' in config) return fail(500, config.error);

  const existingResponse = await postgrest(config, 'players?select=id,name,handicap_index', {
    method: 'GET',
  });
  if (!existingResponse.ok) {
    return fail(500, `Could not read players: ${await existingResponse.text()}`);
  }
  const existing = (await existingResponse.json()) as {
    id: number;
    name: string;
    handicap_index: number;
  }[];
  const byId = new Map(existing.map((p) => [p.id, p]));

  // Anyone who has posted a score has a locked index — see the note in
  // schema.sql. Changing it would silently rescore every round already played,
  // because the leaderboard recomputes from handicap_index on every read.
  const scoredResponse = await postgrest(config, 'scores?select=player_id', { method: 'GET' });
  if (!scoredResponse.ok) {
    return fail(500, `Could not read scores: ${await scoredResponse.text()}`);
  }
  const scored = new Set(
    ((await scoredResponse.json()) as { player_id: number }[]).map((s) => s.player_id),
  );

  for (const entry of cleaned) {
    if (entry.id === undefined) continue;
    const current = byId.get(entry.id);
    if (!current) return fail(404, `No player with id ${entry.id}.`);
    const changed = Math.abs(Number(current.handicap_index) - entry.handicapIndex) > 1e-9;
    if (changed && scored.has(entry.id)) {
      return fail(409, `${current.name} has already posted a score, so their handicap index is locked. Names can still be changed.`, {
        code: 'handicap-locked',
      });
    }
  }

  for (const id of removing) {
    if (scored.has(id)) {
      const name = byId.get(id)?.name ?? `id ${id}`;
      return fail(409, `${name} has scores recorded and cannot be removed. Delete their cards first.`, {
        code: 'has-scores',
      });
    }
  }

  // Deletes, then updates, then inserts.
  for (const id of removing) {
    const response = await postgrest(config, `players?id=eq.${id}`, { method: 'DELETE' });
    if (!response.ok) return fail(500, `Could not remove player: ${await response.text()}`);
  }

  let updated = 0;
  for (const entry of cleaned) {
    if (entry.id === undefined) continue;
    const response = await postgrest(config, `players?id=eq.${entry.id}`, {
      method: 'PATCH',
      body: { name: entry.name, handicap_index: entry.handicapIndex },
      prefer: 'return=minimal',
    });
    if (!response.ok) return fail(500, `Could not update player: ${await response.text()}`);
    updated += 1;
  }

  const inserts = cleaned
    .filter((entry) => entry.id === undefined)
    .map((entry) => ({ name: entry.name, handicap_index: entry.handicapIndex }));

  if (inserts.length > 0) {
    const response = await postgrest(config, 'players', {
      method: 'POST',
      body: inserts,
      prefer: 'return=minimal',
    });
    if (!response.ok) return fail(500, `Could not add players: ${await response.text()}`);
  }

  return {
    status: 200,
    body: { ok: true, inserted: inserts.length, updated, deleted: removing.length },
  };
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
