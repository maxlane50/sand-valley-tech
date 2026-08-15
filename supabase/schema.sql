-- ═══════════════════════════════════════════════════════════════════════════
-- Sand Valley trip scoreboard — schema.
-- Paste into the Supabase SQL editor and run.
--
-- Raw data only. Course handicaps, net scores, Stableford points and standings
-- are all computed client-side from these three tables plus src/data/courses.json.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists players (
  id             bigint generated always as identity primary key,
  name           text not null,
  -- Frozen snapshot taken before the trip. Not a live GHIN lookup; this must
  -- not change mid-competition. Negative values are plus handicaps.
  handicap_index numeric(4, 1) not null
);

create table if not exists rounds (
  id        bigint generated always as identity primary key,
  date      date not null,
  -- Matches an `id` in src/data/courses.json (lido, sand-valley, ...).
  course_id text not null,
  -- Matches a tee `name` on that course in courses.json (e.g. 'White').
  tee_name  text not null
);

create table if not exists scores (
  round_id  bigint not null references rounds (id) on delete cascade,
  player_id bigint not null references players (id) on delete cascade,
  hole      int not null check (hole between 1 and 18),
  -- NULL means the player picked up. A row must still exist for the hole.
  -- /enter never writes NULL — cards are entered complete — but the column
  -- stays nullable as the fallback if someone ever takes an X, and the scoring
  -- module handles it (0 points for that hole).
  strokes   int check (strokes >= 1),
  -- This primary key is what makes re-entering a card an upsert rather than a
  -- duplicate: /api/save-card conflicts on (round_id, player_id, hole).
  primary key (round_id, player_id, hole)
);

create index if not exists scores_round_idx on scores (round_id);

-- ─── Row level security ────────────────────────────────────────────────────
-- Read-only for the world, and that is deliberate.
--
-- The anon key ships inside the public JS bundle, so any policy granting it
-- insert or update would make the scoreboard world-writable by anyone who
-- opens devtools. There is therefore NO write policy on any table: select
-- only, for anon and authenticated.
--
-- All writes go through the Vercel serverless functions in /api, which hold
-- SUPABASE_SERVICE_ROLE_KEY and check ENTRY_PIN before touching the database.
-- The service role bypasses RLS, and that key never reaches the browser.
--
-- Do not add an anon write policy here. If /enter cannot save, the problem is
-- an env var on the server, not a missing policy.
--
-- Seeding below runs in the SQL editor, which also bypasses RLS.

alter table players enable row level security;
alter table rounds  enable row level security;
alter table scores  enable row level security;

drop policy if exists "public read players" on players;
drop policy if exists "public read rounds"  on rounds;
drop policy if exists "public read scores"  on scores;

create policy "public read players" on players for select to anon, authenticated using (true);
create policy "public read rounds"  on rounds  for select to anon, authenticated using (true);
create policy "public read scores"  on scores  for select to anon, authenticated using (true);
