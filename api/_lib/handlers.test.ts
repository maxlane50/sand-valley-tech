/**
 * Server-side write path. The PIN check and the per-hole validation are the
 * only things standing between a bad payload (or a stranger) and the database,
 * so they are tested against the real handlers with PostgREST stubbed at fetch.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveCard, savePlayers, saveTees, verifyPin } from './handlers';

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

describe('savePlayers', () => {
  /** Two existing players; only Marty has posted a score. */
  const EXISTING = [
    { id: 1, name: 'Marty D.', handicap_index: 4.0 },
    { id: 2, name: 'Cheech', handicap_index: 8.0 },
  ];

  function stub({ scored = [1] }: { scored?: number[] } = {}) {
    fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const u = String(url);
      if (init?.method === 'GET' || init === undefined) {
        if (u.includes('/players?select=')) return ok(EXISTING);
        if (u.includes('/scores?select=player_id')) {
          return ok(scored.map((player_id) => ({ player_id })));
        }
      }
      return ok();
    });
  }

  const body = (overrides: Record<string, unknown> = {}) => ({
    pin: PIN,
    players: [
      { id: 1, name: 'Marty D.', handicapIndex: 4.0 },
      { id: 2, name: 'Cheech', handicapIndex: 8.0 },
    ],
    deleteIds: [],
    ...overrides,
  });

  beforeEach(() => stub());

  it('refuses without a valid PIN', async () => {
    const result = await savePlayers(body({ pin: 'nope' }), client());
    expect(result.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('updates names and indexes for players with no scores', async () => {
    const result = await savePlayers(
      body({ players: [{ id: 2, name: 'Cheech Marin', handicapIndex: 7.4 }] }),
      client(),
    );
    expect(result.status).toBe(200);
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(String(patch![0])).toContain('players?id=eq.2');
    expect(JSON.parse(patch![1].body)).toEqual({ name: 'Cheech Marin', handicap_index: 7.4 });
  });

  it('LOCKS the handicap of a player who has already posted a score', async () => {
    const result = await savePlayers(
      body({ players: [{ id: 1, name: 'Marty D.', handicapIndex: 2.0 }] }),
      client(),
    );
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('handicap-locked');
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
  });

  it('still allows renaming a player whose index is locked', async () => {
    const result = await savePlayers(
      body({ players: [{ id: 1, name: 'Martin D.', handicapIndex: 4.0 }] }),
      client(),
    );
    expect(result.status).toBe(200);
  });

  it('refuses to delete a player who has scores', async () => {
    const result = await savePlayers(body({ players: [], deleteIds: [1] }), client());
    expect(result.status).toBe(409);
    expect(result.body.code).toBe('has-scores');
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
  });

  it('deletes a player who has none', async () => {
    const result = await savePlayers(body({ players: [], deleteIds: [2] }), client());
    expect(result.status).toBe(200);
    const del = fetchMock.mock.calls.find(([, i]) => i?.method === 'DELETE');
    expect(String(del![0])).toContain('players?id=eq.2');
  });

  it('inserts a player with no id', async () => {
    const result = await savePlayers(
      body({ players: [{ name: 'Big Wes', handicapIndex: 11.2 }] }),
      client(),
    );
    expect(result.status).toBe(200);
    expect(result.body.inserted).toBe(1);
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/players'),
    );
    expect(JSON.parse(post![1].body)).toEqual([{ name: 'Big Wes', handicap_index: 11.2 }]);
  });

  it('accepts a negative index for a plus handicap', async () => {
    const result = await savePlayers(
      body({ players: [{ name: 'Scratch', handicapIndex: -2.4 }] }),
      client(),
    );
    expect(result.status).toBe(200);
  });

  it('rejects an empty name and an impossible index', async () => {
    expect((await savePlayers(body({ players: [{ name: '  ', handicapIndex: 4 }] }), client())).status).toBe(400);
    expect((await savePlayers(body({ players: [{ name: 'X', handicapIndex: 99 }] }), client())).status).toBe(400);
    expect((await savePlayers(body({ players: [{ name: 'X', handicapIndex: -50 }] }), client())).status).toBe(400);
  });

  it('rounds an index to one decimal, matching numeric(4,1)', async () => {
    await savePlayers(body({ players: [{ name: 'Rounder', handicapIndex: 12.34 }] }), client());
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('/players'),
    );
    expect(JSON.parse(post![1].body)[0].handicap_index).toBe(12.3);
  });

  it('404s on an unknown player id', async () => {
    const result = await savePlayers(
      body({ players: [{ id: 99, name: 'Ghost', handicapIndex: 4 }] }),
      client(),
    );
    expect(result.status).toBe(404);
  });
});

describe('saveTees', () => {
  function stub(courseId = 'lido') {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/rounds?id=eq.') && u.includes('select=')) {
        return ok([{ id: 1, course_id: courseId }]);
      }
      return ok();
    });
  }

  const body = (overrides: Record<string, unknown> = {}) => ({
    pin: PIN,
    roundId: 1,
    defaultTee: 'White',
    assignments: [{ playerId: 1, teeName: 'White' }],
    ...overrides,
  });

  beforeEach(() => stub());

  it('refuses without a valid PIN', async () => {
    expect((await saveTees(body({ pin: 'no' }), client())).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('replaces the round assignments wholesale', async () => {
    const result = await saveTees(body(), client());
    expect(result.status).toBe(200);
    const del = fetchMock.mock.calls.find(([, i]) => i?.method === 'DELETE');
    expect(String(del![0])).toContain('player_tees?round_id=eq.1');
    const post = fetchMock.mock.calls.find(
      ([u, i]) => i?.method === 'POST' && String(u).includes('player_tees'),
    );
    expect(JSON.parse(post![1].body)).toEqual([
      { round_id: 1, player_id: 1, tee_name: 'White' },
    ]);
  });

  it('rejects a tee that is not on the card, before touching anything', async () => {
    const result = await saveTees(
      body({ assignments: [{ playerId: 1, teeName: 'Gold' }] }),
      client(),
    );
    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/no tee named "Gold"/);
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false);
  });

  it('rejects a default tee that is not on the card', async () => {
    expect((await saveTees(body({ defaultTee: 'Gold' }), client())).status).toBe(422);
  });

  it('refuses a course with no tees filled in yet', async () => {
    stub('mammoth-dunes');
    const result = await saveTees(body(), client());
    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/no tees in courses.json/);
  });

  it('explains the missing migration instead of forwarding PostgREST JSON', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/rounds?id=eq.') && u.includes('select=')) {
        return ok([{ id: 1, course_id: 'lido' }]);
      }
      // What PostgREST answers for a table that isn't in its schema cache.
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
        text: async () =>
          '{"code":"PGRST205","message":"Could not find the table ' +
          "'public.player_tees' in the schema cache\"}",
      };
    });

    const result = await saveTees(body(), client());
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/supabase\/schema\.sql/);
    expect(result.body.error).not.toMatch(/PGRST205/);
  });

  it('leaves the round tee alone when player_tees cannot be written', async () => {
    // Not transactional: if the round were patched first, a failure here
    // would move the whole field onto a tee nobody had agreed to.
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes('/rounds?id=eq.') && u.includes('select=')) {
        return ok([{ id: 1, course_id: 'lido' }]);
      }
      if (u.includes('player_tees')) {
        return { ok: false, status: 404, json: async () => ({}), text: async () => 'PGRST205' };
      }
      return ok();
    });

    await saveTees(body({ defaultTee: 'Navy' }), client());
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false);
  });

  it('404s on an unknown round', async () => {
    fetchMock.mockImplementation(async () => ok([]));
    expect((await saveTees(body(), client())).status).toBe(404);
  });

  it('updates the round default tee', async () => {
    await saveTees(body(), client());
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH');
    expect(String(patch![0])).toContain('rounds?id=eq.1');
    expect(JSON.parse(patch![1].body)).toEqual({ tee_name: 'White' });
  });
});
