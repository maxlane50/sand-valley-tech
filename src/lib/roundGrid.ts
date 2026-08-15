/**
 * One round as a 7-players x 18-holes grid.
 *
 * Pure: no React, no Supabase. Every figure comes from src/scoring/scoring.ts,
 * so a cell here can never disagree with the leaderboard or the entry screen.
 */

import {
  HOLES_PER_ROUND,
  assertPlayableCourse,
  holesInPlayOrder,
  scoreRound,
  strokesFromRows,
} from '../scoring/scoring';
import type { Course, Hole, HoleResult } from '../scoring/types';
import type { PlayerRecord, RoundRecord, ScoreRecord } from './types';

const FRONT_NINE = 9;

export interface Subtotal {
  /**
   * Null unless every hole in the segment has a score. A partial OUT would read
   * as a real nine-hole total, which is the same trap the leaderboard avoids.
   */
  gross: number | null;
  /** Points are additive, so a partial total is still meaningful. */
  points: number;
}

export interface GridPlayer {
  playerId: number;
  name: string;
  /** Short column heading, e.g. MARTY. Unique within the grid. */
  label: string;
  handicapIndex: number;
  courseHandicap: number;
  playingHandicap: number;
  /** 18 entries in hole order; `strokes: null` means no score entered. */
  holes: HoleResult[];
  entered: number;
  front: Subtotal;
  back: Subtotal;
  total: Subtotal;
  /** Set when this player's card could not be scored at all. */
  problem: string | null;
}

export interface RoundGrid {
  roundId: number;
  /** 1-based, in date order across the trip. */
  number: number;
  date: string;
  courseName: string;
  teeName: string;
  holes: Hole[];
  parFront: number;
  parBack: number;
  parTotal: number;
  players: GridPlayer[];
  /** Set when the round cannot be scored at all (stub or unknown course). */
  problem: string | null;
}

/**
 * Column headings: first name, uppercased, capped at six characters.
 * Collisions get a numeral rather than being silently ambiguous — two players
 * sharing a column heading on a scoreboard is worse than an ugly one.
 */
export function shortLabels(names: readonly string[]): string[] {
  const base = names.map((name) => {
    const first = name.trim().split(/\s+/)[0] ?? '';
    return (first || name.trim() || '?').toUpperCase().slice(0, 6);
  });

  const totals = new Map<string, number>();
  for (const label of base) totals.set(label, (totals.get(label) ?? 0) + 1);

  const seen = new Map<string, number>();
  return base.map((label) => {
    if ((totals.get(label) ?? 0) === 1) return label;
    const nth = (seen.get(label) ?? 0) + 1;
    seen.set(label, nth);
    return `${label.slice(0, 5)}${nth}`;
  });
}

function subtotal(holes: readonly HoleResult[]): Subtotal {
  const complete = holes.every((h) => h.strokes !== null);
  return {
    gross: complete ? holes.reduce((sum, h) => sum + (h.strokes ?? 0), 0) : null,
    points: holes.reduce((sum, h) => sum + h.points, 0),
  };
}

/** An all-blank card, for a player with nothing entered or a round that can't be scored. */
function blankHoles(holes: readonly Hole[]): HoleResult[] {
  return holes.map((hole) => ({
    hole: hole.hole,
    par: hole.par,
    si: hole.si,
    strokes: null,
    strokesReceived: 0,
    net: null,
    points: 0,
  }));
}

export function buildRoundGrid(
  round: RoundRecord,
  roundNumber: number,
  course: Course | undefined,
  players: readonly PlayerRecord[],
  scores: readonly ScoreRecord[],
): RoundGrid {
  const labels = shortLabels(players.map((p) => p.name));

  let problem: string | null = null;
  let playable: ReturnType<typeof assertPlayableCourse> | null = null;

  if (!course) {
    problem =
      `Round ${roundNumber} points to course "${round.course_id}", which is not in ` +
      `src/data/courses.json.`;
  } else {
    try {
      playable = assertPlayableCourse(course);
    } catch (error) {
      problem = (error as Error).message;
    }
  }

  const holes = playable ? holesInPlayOrder(playable) : [];
  const front = holes.slice(0, FRONT_NINE);
  const back = holes.slice(FRONT_NINE);

  // round + player -> score rows
  const byPlayer = new Map<number, ScoreRecord[]>();
  for (const score of scores) {
    if (score.round_id !== round.id) continue;
    const list = byPlayer.get(score.player_id);
    if (list) list.push(score);
    else byPlayer.set(score.player_id, [score]);
  }

  const gridPlayers: GridPlayer[] = players.map((player, index) => {
    const label = labels[index]!;
    const base = {
      playerId: player.id,
      name: player.name,
      label,
      handicapIndex: Number(player.handicap_index),
    };

    const empty = (playerProblem: string | null): GridPlayer => {
      const blank = blankHoles(holes);
      return {
        ...base,
        courseHandicap: 0,
        playingHandicap: 0,
        holes: blank,
        entered: 0,
        front: subtotal(blank.slice(0, FRONT_NINE)),
        back: subtotal(blank.slice(FRONT_NINE)),
        total: subtotal(blank),
        problem: playerProblem,
      };
    };

    if (!playable) return empty(null);

    const rows = byPlayer.get(player.id) ?? [];

    let result;
    try {
      result = scoreRound(
        playable,
        round.tee_name,
        Number(player.handicap_index),
        strokesFromRows(rows),
      );
    } catch (error) {
      // One bad card must not blank the whole grid.
      return empty(`${player.name}: ${(error as Error).message}`);
    }

    return {
      ...base,
      courseHandicap: result.courseHandicap,
      playingHandicap: result.playingHandicap,
      holes: result.holes,
      entered: result.holes.filter((h) => h.strokes !== null).length,
      front: subtotal(result.holes.slice(0, FRONT_NINE)),
      back: subtotal(result.holes.slice(FRONT_NINE)),
      total: subtotal(result.holes),
      problem: null,
    };
  });

  const parOf = (list: readonly Hole[]) => list.reduce((sum, h) => sum + h.par, 0);

  return {
    roundId: round.id,
    number: roundNumber,
    date: round.date,
    courseName: course?.name ?? round.course_id,
    teeName: round.tee_name,
    holes,
    parFront: parOf(front),
    parBack: parOf(back),
    parTotal: playable?.par ?? 0,
    players: gridPlayers,
    problem,
  };
}

/** Rounds in trip order, matching how the leaderboard numbers them. */
export function orderRounds(rounds: readonly RoundRecord[]): RoundRecord[] {
  return [...rounds].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

export { HOLES_PER_ROUND };
