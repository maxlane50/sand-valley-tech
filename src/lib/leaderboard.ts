/**
 * Turns raw Supabase rows into the leaderboard the design draws.
 *
 * Pure: no React, no Supabase, no fetch. Every number here comes from
 * src/scoring/scoring.ts, so the leaderboard can never disagree with a round
 * detail card or the stats screen.
 */

import type { Course } from '../scoring/types';
import {
  HOLES_PER_ROUND,
  assertPlayableCourse,
  scoreRound,
  strokesFromRows,
} from '../scoring/scoring';
import { resolveTee, type TeeMap } from './tees';
import type { PlayerRecord, RoundRecord, ScoreRecord } from './types';

export type Movement = 'leader' | 'up' | 'down' | 'same';

export interface RoundCell {
  roundId: number;
  /** null when this player has no scores for the round yet. */
  points: number | null;
  /** True for the single best round of the trip by any player. */
  isBestOfTrip: boolean;
}

export interface LeaderRow {
  playerId: number;
  name: string;
  handicapIndex: number;
  /** 1-based, ties share a position (1, 2, 2, 4). */
  position: number;
  isLeader: boolean;
  totalPoints: number;
  /** null for the leader, otherwise a positive number of points behind. */
  pointsBack: number | null;
  /**
   * Gross strokes across the trip, or null if any card the player has started
   * is incomplete. Cards are expected to be complete 18-hole totals; a partial
   * sum would read as a real score, so we show a dash instead.
   */
  grossTotal: number | null;
  rounds: RoundCell[];
  movement: Movement;
}

export interface RoundSummary {
  roundId: number;
  /** 1-based, in date order. */
  number: number;
  date: string;
  courseId: string;
  courseName: string;
  teeName: string;
  /** null when the course is still a stub in courses.json. */
  par: number | null;
  /** Furthest any player has got in this round, 0-18. */
  holesPlayed: number;
  low: { name: string; points: number } | null;
  /** Set when the round cannot be scored; explains why. */
  problem: string | null;
}

export interface Leaderboard {
  rows: LeaderRow[];
  rounds: RoundSummary[];
  /** Group holes completed across the trip, e.g. 72 after four full rounds. */
  holesPlayed: number;
  /** The most recent round with any scores, for the header. */
  current: { number: number; holesPlayed: number } | null;
  /** Human-readable reasons a round could not be scored. */
  problems: string[];
}

/** Standard competition ranking: equal totals share a position. */
function positionOf(total: number, allTotals: number[]): number {
  return 1 + allTotals.filter((t) => t > total).length;
}

export function buildLeaderboard(
  players: readonly PlayerRecord[],
  rounds: readonly RoundRecord[],
  scores: readonly ScoreRecord[],
  lookupCourse: (courseId: string) => Course | undefined,
  teeOverrides?: TeeMap,
): Leaderboard {
  const ordered = [...rounds].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );

  // round id -> player id -> score rows
  const byRound = new Map<number, Map<number, ScoreRecord[]>>();
  for (const score of scores) {
    let perPlayer = byRound.get(score.round_id);
    if (!perPlayer) {
      perPlayer = new Map();
      byRound.set(score.round_id, perPlayer);
    }
    const list = perPlayer.get(score.player_id);
    if (list) list.push(score);
    else perPlayer.set(score.player_id, [score]);
  }

  const problems: string[] = [];

  // Score every player in every round up front; null means "not scorable".
  const points = new Map<number, (number | null)[]>();
  // Gross is only reported when every card the player has started is complete.
  const gross = new Map<number, { sum: number; played: boolean; incomplete: boolean }>();
  for (const player of players) {
    points.set(player.id, []);
    gross.set(player.id, { sum: 0, played: false, incomplete: false });
  }

  const summaries: RoundSummary[] = ordered.map((round, index) => {
    const course = lookupCourse(round.course_id);
    const rows = byRound.get(round.id) ?? new Map<number, ScoreRecord[]>();

    let problem: string | null = null;
    if (!course) {
      problem =
        `Round ${index + 1} points to course "${round.course_id}", which is not in ` +
        `src/data/courses.json.`;
    } else {
      try {
        assertPlayableCourse(course);
      } catch (error) {
        problem = `Round ${index + 1}: ${(error as Error).message}`;
      }
    }
    if (problem) problems.push(problem);

    let holesPlayed = 0;
    let low: { name: string; points: number } | null = null;

    for (const player of players) {
      const playerScores = rows.get(player.id) ?? [];
      holesPlayed = Math.max(holesPlayed, playerScores.length);

      if (problem || !course || playerScores.length === 0) {
        points.get(player.id)!.push(null);
        continue;
      }

      let result;
      try {
        result = scoreRound(
          course,
          resolveTee(teeOverrides, round, player.id),
          Number(player.handicap_index),
          strokesFromRows(playerScores),
        );
      } catch (error) {
        // A per-player failure (bad tee name, impossible stroke count) must not
        // take the whole board down.
        const message = `Round ${index + 1}, ${player.name}: ${(error as Error).message}`;
        if (!problems.includes(message)) problems.push(message);
        points.get(player.id)!.push(null);
        continue;
      }

      points.get(player.id)!.push(result.points);

      const tally = gross.get(player.id)!;
      tally.played = true;
      if (playerScores.length === HOLES_PER_ROUND && result.holesPickedUp === 0) {
        tally.sum += result.grossTotal;
      } else {
        tally.incomplete = true;
      }

      if (!low || result.points > low.points) {
        low = { name: player.name, points: result.points };
      }
    }

    return {
      roundId: round.id,
      number: index + 1,
      date: round.date,
      courseId: round.course_id,
      courseName: course?.name ?? round.course_id,
      teeName: round.tee_name,
      par: course?.par ?? null,
      holesPlayed: Math.min(holesPlayed, HOLES_PER_ROUND),
      low,
      problem,
    };
  });

  const bestOfTrip = Math.max(
    -1,
    ...[...points.values()].flat().filter((p): p is number => p !== null),
  );

  const totals = new Map<number, number>();
  const priorTotals = new Map<number, number>();
  // Movement compares standings before and after the latest round that has
  // any scores at all.
  const latestScoredIndex = summaries.reduce(
    (last, s, i) => (s.holesPlayed > 0 ? i : last),
    -1,
  );

  for (const player of players) {
    const perRound = points.get(player.id)!;
    const sum = (upTo: number) =>
      perRound
        .slice(0, upTo)
        .reduce((acc: number, p) => acc + (p ?? 0), 0);
    totals.set(player.id, sum(perRound.length));
    priorTotals.set(player.id, sum(Math.max(latestScoredIndex, 0)));
  }

  const allTotals = [...totals.values()];
  const allPrior = [...priorTotals.values()];
  const leadTotal = allTotals.length ? Math.max(...allTotals) : 0;
  const hasPriorRound = latestScoredIndex > 0;

  const rows: LeaderRow[] = players
    .map((player) => {
      const total = totals.get(player.id)!;
      const position = positionOf(total, allTotals);
      const isLeader = position === 1;
      const tally = gross.get(player.id)!;

      let movement: Movement = 'same';
      if (isLeader) {
        movement = 'leader';
      } else if (hasPriorRound) {
        const before = positionOf(priorTotals.get(player.id)!, allPrior);
        movement = position < before ? 'up' : position > before ? 'down' : 'same';
      }

      return {
        playerId: player.id,
        name: player.name,
        handicapIndex: Number(player.handicap_index),
        position,
        isLeader,
        totalPoints: total,
        pointsBack: isLeader ? null : leadTotal - total,
        grossTotal: tally.played && !tally.incomplete ? tally.sum : null,
        movement,
        rounds: points.get(player.id)!.map((p, i) => ({
          roundId: summaries[i]!.roundId,
          points: p,
          isBestOfTrip: p !== null && p === bestOfTrip && bestOfTrip > 0,
        })),
      };
    })
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const current =
    latestScoredIndex >= 0
      ? {
          number: summaries[latestScoredIndex]!.number,
          holesPlayed: summaries[latestScoredIndex]!.holesPlayed,
        }
      : null;

  return {
    rows,
    rounds: summaries,
    holesPlayed: summaries.reduce((sum, s) => sum + s.holesPlayed, 0),
    current,
    problems,
  };
}
