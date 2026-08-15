-- ═══════════════════════════════════════════════════════════════════════════
-- PLACEHOLDER DATA — replace before the trip.
--
-- Names and scores below are lifted from the design mock; they are not real.
-- Handicap indexes are made up. The point of this file is to give the read
-- path something to render so you can confirm it end to end.
--
-- One round is seeded: The Lido off the White tees, the only course in
-- courses.json with a complete card. Add the other three rounds once you have
-- filled in their pars, tees and stroke indexes.
--
-- To wipe and re-seed:  truncate scores, rounds, players restart identity cascade;
-- ═══════════════════════════════════════════════════════════════════════════

insert into players (name, handicap_index) values
  ('Marty D.',    4.0),
  ('Cheech',      8.0),
  ('Big Wes',    11.0),
  ('Coop',       14.0),
  ('Dez',        16.0),
  ('Hollis',     20.0),
  ('Tank Reilly', 22.0);

insert into rounds (date, course_id, tee_name) values
  ('2026-08-13', 'lido', 'White');

-- 7 cards x 18 holes. Tank picks up on hole 4 (NULL), which must score 0 points
-- rather than blowing anything up.
with card (name, strokes) as (
  values
    ('Marty D.',    array[5,4,3,6,4,5,6,4,4, 4,5,4,4,3,5,3,5,5]::int[]),
    ('Cheech',      array[5,5,4,6,5,6,6,4,4, 5,5,5,4,4,5,4,6,5]::int[]),
    ('Big Wes',     array[5,5,4,7,5,6,6,5,5, 5,6,5,5,4,5,4,6,5]::int[]),
    ('Coop',        array[6,5,4,7,6,6,7,4,5, 5,6,6,5,4,6,4,7,6]::int[]),
    ('Dez',         array[6,6,5,7,6,7,7,5,5, 6,6,6,5,4,6,5,7,6]::int[]),
    ('Hollis',      array[6,6,4,8,6,7,8,5,6, 6,7,6,6,5,6,5,8,6]::int[]),
    ('Tank Reilly', array[7,6,5,null,7,8,8,5,6, 6,7,7,6,5,7,5,8,7]::int[])
)
insert into scores (round_id, player_id, hole, strokes)
select r.id, p.id, s.hole::int, s.strokes
from card c
join players p on p.name = c.name
cross join (select id from rounds where course_id = 'lido' order by date limit 1) r
cross join lateral unnest(c.strokes) with ordinality as s (strokes, hole);
