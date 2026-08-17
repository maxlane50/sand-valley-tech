/**
 * Trip statistics. Everything here derives from one input — gross strokes per
 * hole — plus the course card. No putts, no fairways, no GIR.
 *
 * Pure: no React, no Supabase. Built on top of buildRoundGrid so a figure here
 * can never disagree with the round detail screen or the leaderboard.
 */

import type { Course } from '../scoring/types';
import { buildRoundGrid, orderRounds } from './roundGrid';
import type { TeeMap } from './tees';
import type { PlayerRecord, RoundRecord, ScoreRecord } from './types';

/** The hole types the splits are reported over. */
export const HOLE_TYPES = [3, 4, 5] as const;

export interface HoleTypeStat {
  par: number;
  holes: number;
  /** Mean gross strokes over par. Null when no holes of this type were played. */
  averageVsPar: number | null;
  /** Mean net Stableford points. Null when no holes of this type were played. */
  pointsPerHole: number | null;
}

export interface ScoringCounts {
  /** Gross two under par or better, so an ace on a par 3 lands here. */
  eagles: number;
  /** Gross exactly one under par. Eagles are counted separately. */
  birdies: number;
  pars: number;
  bogeys: number;
  /** Gross double bogey or worse. */
  blowups: number;
}

export interface PlayerStats {
  playerId: number;
  name: string;
  handicapIndex: number;
  holesPlayed: number;
  totalPoints: number;
  /** Always three entries, in HOLE_TYPES order. */
  byType: HoleTypeStat[];
  counts: ScoringCounts;
  longestPointStreak: number;
  /** Earned label such as "best par 5s". Null when the player has no claim. */
  tag: { text: string; tone: 'good' | 'bad' } | null;
  /**
   * Standing after each round that has been played — one entry per scored
   * round, cumulative, 1 = leading. This is the shape of their trip, which a
   * cumulative total cannot show: 3rd on the way up and 3rd on the way down
   * look identical on the leaderboard.
   */
  trajectory: number[];
}

export interface GroupStats {
  holesPlayed: number;
  byType: HoleTypeStat[];
  counts: ScoringCounts;
}

export interface HoleDifficulty {
  roundId: number;
  roundNumber: number;
  courseName: string;
  hole: number;
  par: number;
  si: number;
  /** Group mean gross strokes over par. This is what the ranking is built on. */
  averageVsPar: number;
  playersCounted: number;
  /** 1 = played hardest of every hole in the trip so far. */
  actualRank: number;
}

export interface Superlative {
  label: string;
  /** Winner, "A & B" for a pair, or "N-way tie". */
  name: string;
  value: number;
  note: string;
}

export interface RoundLine {
  roundId: number;
  number: number;
  courseName: string;
  par: number | null;
  low: { name: string; points: number } | null;
  problem: string | null;
}

export interface TripStats {
  /** Ordered by points per hole, best first — the design's ordering for section A. */
  players: PlayerStats[];
  /** Same figures over every player's holes combined. */
  group: GroupStats;
  hardest: HoleDifficulty[];
  easiest: HoleDifficulty[];
  /** How many holes the ranking covers, e.g. 72 after four full rounds. */
  holesRanked: number;
  /** Rounds with at least one card in. Trajectories have this many points. */
  scoredRounds: number;
  superlatives: Superlative[];
  rounds: RoundLine[];
  problems: string[];
  hasData: boolean;
}

/** One hole a player actually completed. */
interface Played {
  playerId: number;
  roundId: number;
  roundNumber: number;
  courseName: string;
  hole: number;
  par: number;
  si: number;
  strokes: number;
  points: number;
}

function typeStats(holes: readonly Played[]): HoleTypeStat[] {
  return HOLE_TYPES.map((par) => {
    const list = holes.filter((h) => h.par === par);
    if (list.length === 0) {
      return { par, holes: 0, averageVsPar: null, pointsPerHole: null };
    }
    return {
      par,
      holes: list.length,
      averageVsPar:
        list.reduce((sum, h) => sum + (h.strokes - h.par), 0) / list.length,
      pointsPerHole: list.reduce((sum, h) => sum + h.points, 0) / list.length,
    };
  });
}

function countScores(holes: readonly Played[]): ScoringCounts {
  const counts: ScoringCounts = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, blowups: 0 };
  for (const hole of holes) {
    const delta = hole.strokes - hole.par;
    if (delta <= -2) counts.eagles += 1;
    else if (delta === -1) counts.birdies += 1;
    else if (delta === 0) counts.pars += 1;
    else if (delta === 1) counts.bogeys += 1;
    else counts.blowups += 1;
  }
  return counts;
}

/**
 * Longest run of consecutive completed holes worth at least a point.
 * A hole with no score is skipped rather than treated as a zero — an unentered
 * card is missing data, not a failure to score.
 */
function longestStreak(holes: readonly Played[]): number {
  let best = 0;
  let run = 0;
  for (const hole of holes) {
    if (hole.points > 0) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

function pickSuperlative(
  label: string,
  note: string,
  entries: readonly { name: string; value: number }[],
): Superlative | null {
  if (entries.length === 0) return null;
  const best = Math.max(...entries.map((e) => e.value));
  // Nobody has any, so there is nothing to hand out.
  if (best <= 0) return null;

  const winners = entries
    .filter((e) => e.value === best)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const name =
    winners.length === 1
      ? winners[0]!
      : winners.length === 2
        ? `${winners[0]} & ${winners[1]}`
        : `${winners.length}-way tie`;

  return { label, name, value: best, note };
}

export function buildTripStats(
  rounds: readonly RoundRecord[],
  players: readonly PlayerRecord[],
  scores: readonly ScoreRecord[],
  lookupCourse: (courseId: string) => Course | undefined,
  teeOverrides?: TeeMap,
): TripStats {
  const ordered = orderRounds(rounds);
  const problems: string[] = [];
  const played: Played[] = [];
  const roundLines: RoundLine[] = [];
  /** playerId -> round points, for the best-single-round superlative. */
  const roundPoints: { playerId: number; name: string; points: number; roundNumber: number; courseName: string }[] = [];
  /** Points every player took from each round, including zero for a no-show. */
  const perRoundPoints: { scored: boolean; points: Map<number, number> }[] = [];

  for (const [index, round] of ordered.entries()) {
    const grid = buildRoundGrid(
      round,
      index + 1,
      lookupCourse(round.course_id),
      players,
      scores,
      teeOverrides,
    );

    if (grid.problem) problems.push(grid.problem);

    let low: { name: string; points: number } | null = null;
    const roundTally = new Map<number, number>();

    for (const player of grid.players) {
      roundTally.set(player.playerId, player.entered > 0 ? player.total.points : 0);
      if (player.problem) problems.push(player.problem);
      if (player.entered === 0) continue;

      for (const hole of player.holes) {
        if (hole.strokes === null) continue;
        played.push({
          playerId: player.playerId,
          roundId: grid.roundId,
          roundNumber: grid.number,
          courseName: grid.courseName,
          hole: hole.hole,
          par: hole.par,
          si: hole.si,
          strokes: hole.strokes,
          points: hole.points,
        });
      }

      roundPoints.push({
        playerId: player.playerId,
        name: player.name,
        points: player.total.points,
        roundNumber: grid.number,
        courseName: grid.courseName,
      });

      if (!low || player.total.points > low.points) {
        low = { name: player.name, points: player.total.points };
      }
    }

    perRoundPoints.push({
      scored: grid.players.some((p) => p.entered > 0),
      points: roundTally,
    });

    roundLines.push({
      roundId: grid.roundId,
      number: grid.number,
      courseName: grid.courseName,
      par: grid.holes.length > 0 ? grid.parTotal : null,
      low,
      problem: grid.problem,
    });
  }

  /* ─── trajectory ───────────────────────────────────────────────────────── */

  // Standings recomputed after each scored round, so the shape of the race is
  // visible rather than just its finishing order. Unplayed rounds are skipped
  // entirely — a flat segment for a round nobody has entered would be a lie.
  const scored = perRoundPoints.filter((round) => round.scored);
  const trajectories = new Map<number, number[]>(players.map((p) => [p.id, []]));
  const running = new Map<number, number>(players.map((p) => [p.id, 0]));

  for (const round of scored) {
    for (const player of players) {
      running.set(player.id, running.get(player.id)! + (round.points.get(player.id) ?? 0));
    }
    const totals = [...running.values()];
    for (const player of players) {
      const mine = running.get(player.id)!;
      // Standard competition ranking, matching the leaderboard.
      trajectories.get(player.id)!.push(1 + totals.filter((t) => t > mine).length);
    }
  }

  /* ─── per player ───────────────────────────────────────────────────────── */

  const perPlayer = players.map((player) => {
    const mine = played.filter((h) => h.playerId === player.id);
    return {
      playerId: player.id,
      name: player.name,
      handicapIndex: Number(player.handicap_index),
      holesPlayed: mine.length,
      totalPoints: mine.reduce((sum, h) => sum + h.points, 0),
      byType: typeStats(mine),
      counts: countScores(mine),
      longestPointStreak: longestStreak(mine),
      tag: null as PlayerStats['tag'],
      trajectory: trajectories.get(player.id) ?? [],
    };
  });

  // Earned tags, in the design's priority order. Only players who actually
  // played holes of that type can claim one.
  const claim = (par: number, best: boolean) => {
    const eligible = perPlayer.filter((p) => {
      const stat = p.byType.find((t) => t.par === par);
      return stat && stat.holes > 0 && stat.averageVsPar !== null;
    });
    if (eligible.length < 2) return null;
    const avg = (p: (typeof perPlayer)[number]) =>
      p.byType.find((t) => t.par === par)!.averageVsPar!;
    return eligible.reduce((winner, p) =>
      (best ? avg(p) < avg(winner) : avg(p) > avg(winner)) ? p : winner,
    );
  };

  const bestPar5 = claim(5, true);
  const worstPar3 = claim(3, false);
  const bestPar3 = claim(3, true);

  if (bestPar5) bestPar5.tag = { text: 'best par 5s', tone: 'good' };
  if (worstPar3 && !worstPar3.tag) worstPar3.tag = { text: 'worst par 3s', tone: 'bad' };
  if (bestPar3 && !bestPar3.tag) bestPar3.tag = { text: 'best par 3s', tone: 'good' };

  const pointsPerHoleTotal = (p: (typeof perPlayer)[number]) =>
    p.byType.reduce((sum, t) => sum + (t.pointsPerHole ?? 0), 0);

  const sortedPlayers: PlayerStats[] = [...perPlayer].sort(
    (a, b) => pointsPerHoleTotal(b) - pointsPerHoleTotal(a) || a.name.localeCompare(b.name),
  );

  /* ─── hole difficulty ──────────────────────────────────────────────────── */

  const byHole = new Map<string, HoleDifficulty & { total: number }>();
  for (const hole of played) {
    const key = `${hole.roundId}:${hole.hole}`;
    const existing = byHole.get(key);
    if (existing) {
      existing.total += hole.strokes - hole.par;
      existing.playersCounted += 1;
    } else {
      byHole.set(key, {
        roundId: hole.roundId,
        roundNumber: hole.roundNumber,
        courseName: hole.courseName,
        hole: hole.hole,
        par: hole.par,
        si: hole.si,
        total: hole.strokes - hole.par,
        playersCounted: 1,
        averageVsPar: 0,
        actualRank: 0,
      });
    }
  }

  const difficulty = [...byHole.values()];
  for (const entry of difficulty) {
    entry.averageVsPar = entry.total / entry.playersCounted;
  }

  // Hardest first, purely on what the group actually scored. Ties broken by
  // round then hole so the order is stable rather than arbitrary.
  const byActual = [...difficulty].sort(
    (a, b) =>
      b.averageVsPar - a.averageVsPar || a.roundNumber - b.roundNumber || a.hole - b.hole,
  );
  byActual.forEach((entry, i) => {
    entry.actualRank = i + 1;
  });

  const strip = ({ total, ...rest }: HoleDifficulty & { total: number }): HoleDifficulty =>
    rest;

  /* ─── superlatives ─────────────────────────────────────────────────────── */

  const withHoles = perPlayer.filter((p) => p.holesPlayed > 0);
  const bestRound = roundPoints.reduce<(typeof roundPoints)[number] | null>(
    (best, entry) => (!best || entry.points > best.points ? entry : best),
    null,
  );

  const superlatives = [
    bestRound && bestRound.points > 0
      ? pickSuperlative(
          'Most points, one round',
          `Round ${bestRound.roundNumber} · ${bestRound.courseName}`,
          roundPoints
            .filter((r) => r.points === bestRound.points)
            .map((r) => ({ name: r.name, value: r.points })),
        )
      : null,
    pickSuperlative(
      'Longest streak with points',
      'consecutive holes',
      withHoles.map((p) => ({ name: p.name, value: p.longestPointStreak })),
    ),
    pickSuperlative(
      'Most blow-ups',
      'double bogey or worse',
      withHoles.map((p) => ({ name: p.name, value: p.counts.blowups })),
    ),
    pickSuperlative(
      'Most birdies or better',
      'gross, eagles included',
      withHoles.map((p) => ({
        name: p.name,
        value: p.counts.birdies + p.counts.eagles,
      })),
    ),
  ].filter((s): s is Superlative => s !== null);

  return {
    players: sortedPlayers,
    group: {
      holesPlayed: played.length,
      byType: typeStats(played),
      counts: countScores(played),
    },
    hardest: byActual.slice(0, 3).map(strip),
    easiest: byActual.slice(-3).reverse().map(strip),
    holesRanked: difficulty.length,
    scoredRounds: scored.length,
    superlatives,
    rounds: roundLines,
    problems: [...new Set(problems)],
    hasData: played.length > 0,
  };
}
