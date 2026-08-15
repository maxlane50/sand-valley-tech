import { getCourse } from '../../data/courses';
import { isPlayableCourse } from '../../scoring/scoring';
import type { PlayerRecord, RoundRecord, ScoreRecord } from '../../lib/types';
import { HOLES_PER_ROUND } from '../../scoring/scoring';

function courseFor(courseId: string) {
  try {
    return getCourse(courseId);
  } catch {
    return undefined;
  }
}

/** How many holes this player already has recorded for this round. */
function enteredCount(
  scores: readonly ScoreRecord[],
  roundId: number,
  playerId: number,
): number {
  return scores.filter((s) => s.round_id === roundId && s.player_id === playerId).length;
}

export function CardPicker({
  rounds,
  players,
  scores,
  roundId,
  onPickRound,
  onPickPlayer,
  onManagePlayers,
}: {
  rounds: readonly RoundRecord[];
  players: readonly PlayerRecord[];
  scores: readonly ScoreRecord[];
  roundId: number | null;
  onPickRound: (id: number | null) => void;
  onPickPlayer: (id: number) => void;
  onManagePlayers: () => void;
}) {
  const round = rounds.find((r) => r.id === roundId) ?? null;

  return (
    <div className="flex-1 overflow-auto bg-paper">
      <header className="border-b-strong border-ink bg-paper-2 px-gutter pt-4 pb-3">
        <div className="font-ui text-nano font-bold uppercase tracking-eyebrow text-ink-45">
          Score entry
        </div>
        <div className="pt-1 font-display text-card-title leading-tight text-ink">
          {round ? 'Whose card?' : 'Which round?'}
        </div>
      </header>

      {!round ? (
        <div className="px-gutter pt-3 pb-5">
          {rounds.length === 0 ? (
            <p className="font-num text-chip leading-body text-ink-70">
              No rounds yet. Add one to the rounds table first.
            </p>
          ) : null}

          {rounds.map((item, index) => {
            const course = courseFor(item.course_id);
            const playable = course ? isPlayableCourse(course) : false;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!playable}
                onClick={() => onPickRound(item.id)}
                className="flex min-h-hit-min w-full items-center justify-between gap-3 border-b border-rule-soft py-3 text-left disabled:opacity-45"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="flex-none font-num text-chip text-ink-25">
                    R{index + 1}
                  </span>
                  <span className="truncate font-display text-name text-ink">
                    {course?.name ?? item.course_id}
                  </span>
                </span>
                <span className="flex-none font-num text-chip text-ink-45">
                  {playable ? `${item.tee_name} · ${item.date}` : 'card not filled in'}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onManagePlayers}
            className="min-h-hit-min pt-3 font-ui text-nano font-bold uppercase tracking-label text-turf"
          >
            Players &amp; handicaps ▶
          </button>
        </div>
      ) : (
        <div className="px-gutter pt-3 pb-5">
          <button
            type="button"
            onClick={() => onPickRound(null)}
            className="min-h-hit-min font-ui text-nano font-bold uppercase tracking-label text-turf"
          >
            ◀ {courseFor(round.course_id)?.name ?? round.course_id} · {round.tee_name}
          </button>

          {players.map((player) => {
            const done = enteredCount(scores, round.id, player.id);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => onPickPlayer(player.id)}
                className="flex min-h-hit-min w-full items-center justify-between gap-3 border-b border-rule-soft py-3 text-left"
              >
                <span className="truncate font-display text-name text-ink">
                  {player.name}
                </span>
                <span
                  className={`flex-none font-num text-chip ${
                    done === HOLES_PER_ROUND ? 'text-turf' : 'text-ink-45'
                  }`}
                >
                  {done === HOLES_PER_ROUND
                    ? 'card in ✓'
                    : done > 0
                      ? `${done} of ${HOLES_PER_ROUND}`
                      : 'not entered'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
