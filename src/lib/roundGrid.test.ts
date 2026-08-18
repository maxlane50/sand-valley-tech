import { describe, expect, it } from 'vitest';

import { getCourse } from '../data/courses';
import { buildRoundGrid, shortLabels } from './roundGrid';
import type { PlayerRecord, RoundRecord, ScoreRecord } from './types';

const LIDO_ROUND: RoundRecord = {
  id: 1,
  date: '2026-08-13',
  course_id: 'lido',
  tee_name: 'White',
};

const PLAYERS: PlayerRecord[] = [
  { id: 1, name: 'Marty D.', handicap_index: 4.0 },
  { id: 2, name: 'Big Wes', handicap_index: 11.0 },
];

function card(playerId: number, strokes: (number | null)[]): ScoreRecord[] {
  return strokes.map((s, i) => ({
    round_id: 1,
    player_id: playerId,
    hole: i + 1,
    strokes: s,
  }));
}

const flat = (n: number) => Array.from({ length: 18 }, () => n as number | null);

const build = (players = PLAYERS, scores: ScoreRecord[] = []) =>
  buildRoundGrid(LIDO_ROUND, 1, getCourse('lido'), players, scores);

describe('shortLabels', () => {
  it('uses the uppercased first name, capped at six characters', () => {
    expect(shortLabels(['Marty D.', 'Cheech', 'Big Wes', 'Tank Reilly'])).toEqual([
      'MARTY',
      'CHEECH',
      'BIG',
      'TANK',
    ]);
  });

  it('numbers collisions rather than repeating a heading', () => {
    expect(shortLabels(['Mike A.', 'Mike B.', 'Dez'])).toEqual(['MIKE1', 'MIKE2', 'DEZ']);
  });

  it('keeps every label unique and within six characters', () => {
    const labels = shortLabels(['Christopher R.', 'Christopher S.', 'Chris']);
    expect(new Set(labels).size).toBe(3);
    for (const label of labels) expect(label.length).toBeLessThanOrEqual(6);
  });

  it('survives an empty name', () => {
    expect(shortLabels(['', '  '])).toEqual(['?1', '?2']);
  });
});

describe('buildRoundGrid', () => {
  it('lays out 18 holes and the card metadata', () => {
    const grid = build();
    expect(grid.holes).toHaveLength(18);
    expect(grid.courseName).toBe('The Lido');
    expect(grid.teeName).toBe('White');
    expect(grid.parFront).toBe(37);
    expect(grid.parBack).toBe(35);
    expect(grid.parTotal).toBe(72);
    expect(grid.problem).toBeNull();
  });

  it('scores every player and matches the scoring module', () => {
    const grid = build(PLAYERS, [...card(1, flat(4)), ...card(2, flat(5))]);

    const marty = grid.players[0]!;
    expect(marty.playingHandicap).toBe(6); // HI 4.0 on 72.5/144 par 72
    expect(marty.total.gross).toBe(72);
    expect(marty.entered).toBe(18);
    expect(marty.holes[3]!.hole).toBe(4);

    const wes = grid.players[1]!;
    expect(wes.playingHandicap).toBe(14);
    expect(wes.total.gross).toBe(90);
    // Same course, worse card, more strokes — points still computed per hole.
    expect(wes.total.points).toBe(wes.holes.reduce((s, h) => s + h.points, 0));
  });

  it('splits front and back nine correctly', () => {
    const strokes = flat(4);
    strokes[0] = 6; // hole 1 -> front only
    const grid = build([PLAYERS[0]!], card(1, strokes));

    const marty = grid.players[0]!;
    expect(marty.front.gross).toBe(6 + 8 * 4);
    expect(marty.back.gross).toBe(9 * 4);
    expect(marty.total.gross).toBe(marty.front.gross! + marty.back.gross!);
    expect(marty.total.points).toBe(marty.front.points + marty.back.points);
  });

  it('withholds a subtotal until that nine is complete, but keeps points', () => {
    const strokes = flat(4);
    strokes[5] = null; // hole 6, front nine
    const grid = build([PLAYERS[0]!], card(1, strokes));

    const marty = grid.players[0]!;
    expect(marty.front.gross).toBeNull(); // partial nine, no fake total
    expect(marty.back.gross).toBe(36); // back nine is intact
    expect(marty.total.gross).toBeNull();
    expect(marty.front.points).toBeGreaterThan(0);
    expect(marty.entered).toBe(17);
  });

  it('renders a player with no card as blank, not as zeros', () => {
    const grid = build(PLAYERS, card(1, flat(4)));

    const wes = grid.players[1]!;
    expect(wes.entered).toBe(0);
    expect(wes.holes).toHaveLength(18);
    expect(wes.holes.every((h) => h.strokes === null)).toBe(true);
    expect(wes.total.gross).toBeNull();
    expect(wes.total.points).toBe(0);
    expect(wes.problem).toBeNull();
  });

  it('carries strokes received per hole so the grid can mark them', () => {
    const grid = build([PLAYERS[1]!], card(2, flat(5)));
    const wes = grid.players[0]!;
    expect(wes.playingHandicap).toBe(14);
    for (const hole of wes.holes) {
      expect(hole.strokesReceived).toBe(hole.si <= 14 ? 1 : 0);
    }
  });

  it('reports a stub course once and leaves the grid empty rather than throwing', () => {
    const grid = buildRoundGrid(
      { ...LIDO_ROUND, course_id: 'mammoth-dunes' },
      2,
      getCourse('mammoth-dunes'),
      PLAYERS,
      [],
    );

    expect(grid.problem).toMatch(/Mammoth Dunes.*par is null/s);
    expect(grid.holes).toEqual([]);
    expect(grid.players).toHaveLength(2);
    expect(grid.players[0]!.holes).toEqual([]);
  });

  it('reports an unknown course id', () => {
    const grid = buildRoundGrid(
      { ...LIDO_ROUND, course_id: 'whistling-straits' },
      2,
      undefined,
      PLAYERS,
      [],
    );
    expect(grid.problem).toMatch(/not in src\/data\/courses\.json/);
  });

  it('isolates a bad tee name to the affected players', () => {
    const grid = buildRoundGrid(
      { ...LIDO_ROUND, tee_name: 'Tips' },
      1,
      getCourse('lido'),
      PLAYERS,
      card(1, flat(4)),
    );
    expect(grid.problem).toBeNull(); // the course itself is fine
    expect(grid.players[0]!.problem).toMatch(/no tee named "Tips"/);
    expect(grid.players[0]!.entered).toBe(0);
  });

  it('ignores scores belonging to a different round', () => {
    const otherRound = card(1, flat(3)).map((s) => ({ ...s, round_id: 99 }));
    const grid = build([PLAYERS[0]!], [...card(1, flat(4)), ...otherRound]);
    expect(grid.players[0]!.total.gross).toBe(72);
  });

  it('treats a picked-up hole as no score for gross but still scores 0 points', () => {
    const strokes = flat(4);
    strokes[10] = null;
    const grid = build([PLAYERS[0]!], card(1, strokes));

    const marty = grid.players[0]!;
    expect(marty.holes[10]!.strokes).toBeNull();
    expect(marty.holes[10]!.points).toBe(0);
    expect(marty.back.gross).toBeNull();
  });
});
