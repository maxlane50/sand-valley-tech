/**
 * Server-side write path. The PIN check and the per-hole validation are the
 * only things standing between a bad payload (or a stranger) and the database,
 * so they are tested against the real handlers with PostgREST stubbed at fetch.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveCard, verifyPin } from './handlers';

const PIN = '246813';
const VALID = Array.from({ length: 18 }, () => 4); // gross 72

/** Unique per test so the attempt throttle doesn't leak between them. */
let clientCounter = 0;
const client = () => `test-${(clientCounter += 1)}`;

const fetchMock = vi.fn();

function ok(body: unknown = []) {
  return { ok: true, status: 200, json: async () => body, text: async () => '' };
}

/** Calls made to a given table, in order. */
function callsTo(table: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(`/rest/v1/${table}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  process.env.ENTRY_PIN = PIN;
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  // Existence lookups find a row; the upsert succeeds.
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes('select=id') ? ok([{ id: 1 }]) : ok(),
  );
});

describe('verifyPin', () => {
  it('accepts the right PIN', async () => {
    expect(await verifyPin({ pin: PIN }, client())).toEqual({
      status: 200,
      body: { ok: true },
    });
  });

  it('rejects the wrong PIN with a 401', async () => {
    const result = await verifyPin({ pin: '000000' }, client());
    expect(result.status).toBe(401);
    expect(result.body.ok).toBe(false);
  });

  it('rejects an empty PIN with a 400', async () => {
    expect((await verifyPin({}, client())).status).toBe(400);
  });

  it('fails loudly when ENTRY_PIN is not set on the server', async () => {
    delete process.env.ENTRY_PIN;
    const result = await verifyPin({ pin: PIN }, client());
    expect(result.status).toBe(500);
    expect(result.body.error).toMatch(/ENTRY_PIN/);
  });

  it('throttles repeated wrong guesses', async () => {
    const attacker = client();
    for (let i = 0; i < 10; i += 1) {
      await verifyPin({ pin: 'wrong' }, attacker);
    }
    expect((await verifyPin({ pin: 'wrong' }, attacker)).status).toBe(429);
  });
});

describe('saveCard', () => {
  const body = (overrides: Record<string, unknown> = {}) => ({
    pin: PIN,
    roundId: 1,
    playerId: 2,
    strokes: VALID,
    ...overrides,
  });

  it('never constructs a realtime client — it only uses fetch', async () => {
    // Regression guard: @supabase/supabase-js builds a WebSocket client in its
    // constructor, which throws on Node < 22. This path must stay SDK-free.
    await saveCard(body(), client());
    expect(fetchMock).toHaveBeenCalled();
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/example\.supabase\.co\/rest\/v1\//);
    }
  });

  it('upserts 18 rows, merging duplicates on the card primary key', async () => {
    const result = await saveCard(body(), client());

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ ok: true, grossTotal: 72 });

    const [url, init] = callsTo('scores')[0]!;
    expect(String(url)).toContain('on_conflict=round_id,player_id,hole');
    expect(init.method).toBe('POST');
    expect(init.headers.prefer).toContain('resolution=merge-duplicates');
    expect(init.headers.authorization).toBe('Bearer service-role-key');
    expect(init.headers.apikey).toBe('service-role-key');

    const rows = JSON.parse(init.body);
    expect(rows).toHaveLength(18);
    expect(rows[0]).toEqual({ round_id: 1, player_id: 2, hole: 1, strokes: 4 });
    expect(rows[17]).toEqual({ round_id: 1, player_id: 2, hole: 18, strokes: 4 });
  });

  it('derives the gross total server-side and ignores any client-supplied one', async () => {
    const strokes = [...VALID];
    strokes[0] = 5; // sums to 73, not 72
    const result = await saveCard(
      body({ strokes, grossTotal: 999, grossChecksum: 72 }),
      client(),
    );

    expect(result.status).toBe(200);
    expect(result.body.grossTotal).toBe(73);
  });

  it('refuses to write without a valid PIN', async () => {
    const result = await saveCard(body({ pin: 'nope' }), client());
    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a card that is not 18 holes', async () => {
    const result = await saveCard(body({ strokes: VALID.slice(0, 17) }), client());
    expect(result.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects impossible hole scores', async () => {
    for (const bad of [0, -1, 21, 4.5, null]) {
      const strokes = [...VALID];
      strokes[5] = bad as number;
      const result = await saveCard(body({ strokes }), client());
      expect(result.status).toBe(400);
      expect(result.body.error).toMatch(/Hole 6/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('404s on an unknown round instead of a raw FK error', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('rounds') ? ok([]) : ok([{ id: 1 }]),
    );
    const result = await saveCard(body(), client());
    expect(result.status).toBe(404);
    expect(result.body.error).toMatch(/No round with id 1/);
    expect(callsTo('scores')).toHaveLength(0);
  });

  it('404s on an unknown player', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('players') ? ok([]) : ok([{ id: 1 }]),
    );
    const result = await saveCard(body(), client());
    expect(result.status).toBe(404);
    expect(result.body.error).toMatch(/No player with id 2/);
  });

  it('surfaces a database failure on the upsert', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('select=id')
        ? ok([{ id: 1 }])
        : { ok: false, status: 500, json: async () => ({}), text: async () => 'deadlock detected' },
    );
    const result = await saveCard(body(), client());
    expect(result.status).toBe(500);
    expect(result.body.error).toMatch(/deadlock detected/);
  });

  it('fails when the service role key is missing rather than falling back', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await saveCard(body(), client());
    expect(result.status).toBe(500);
    expect(result.body.error).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tolerates a trailing slash on SUPABASE_URL', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co/';
    await saveCard(body(), client());
    for (const [url] of fetchMock.mock.calls) {
      expect(String(url)).not.toContain('//rest/v1');
    }
  });
});
