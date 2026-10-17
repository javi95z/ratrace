import { careerOf } from '../lookup';
import type { Rng } from '../rng';
import type { CareerMove, CareerMoveResult, Content, GameEvent, PlayerState, RejectReason } from '../types';
import { addSkillPoints, skillLevel } from './skills';

/** The moves the player's career makes at the rung they are on. None without a career. */
export function movesOpen(p: PlayerState, content: Content): CareerMove[] {
  const career = p.life.career;
  if (career === null) return [];
  return (careerOf(content, career.id).moves ?? []).filter((move) => career.level >= move.fromLevel && career.level <= move.toLevel);
}

/** Why a move of the career cannot be made this round, or null. `round` is the round being played. */
export function moveLock(p: PlayerState, content: Content, moveId: unknown, round: number): RejectReason | null {
  if (p.life.career === null) return 'no-job';
  if (typeof moveId !== 'string' || !movesOpen(p, content).some((move) => move.id === moveId)) return 'no-move';
  const made = p.life.moves?.[moveId];
  if (made && made.restUntil > round) return 'move-resting';
  return null;
}

/** The weights of a move's outcomes for this player: the hoped-for one, first, gains by their skill. */
export function moveWeights(p: PlayerState, content: Content, move: CareerMove): number[] {
  const bonus = move.skill && move.pctPerSkillLevel ? skillLevel(p, move.skill, content) * move.pctPerSkillLevel : 0;
  return move.outcomes.map((outcome, at) => (at === 0 ? outcome.weight + bonus : outcome.weight));
}

/** The chance in percent that a move comes to what is hoped of it. */
export function moveChancePct(p: PlayerState, content: Content, move: CareerMove): number {
  const weights = moveWeights(p, content, move);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? Math.round((weights[0] * 100) / total) : 0;
}

/**
 * A round of focus on a move of the career, as the round ends: put in, and judged once it has had
 * all its rounds. The dice are thrown only then, so a life that makes no move draws the same
 * numbers as before. `round` is the round just played.
 */
export function advanceMove(p: PlayerState, content: Content, moveId: string, round: number, rng: Rng, events: GameEvent[]): void {
  const career = p.life.career;
  const move = movesOpen(p, content).find((one) => one.id === moveId);
  if (career === null || move === undefined) return;
  const moves = (p.life.moves ??= {});
  const made = moves[moveId] ?? { progress: 0, restUntil: 0 };
  const progress = made.progress + 1;
  if (progress < move.rounds) {
    moves[moveId] = { ...made, progress };
    return;
  }
  const weights = moveWeights(p, content, move);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.int(total);
  let outcome = 0;
  while (outcome < weights.length - 1 && roll >= weights[outcome]) roll -= weights[outcome++];
  const levels = applyMove(p, content, move.id, move.outcomes[outcome].result, events);
  moves[moveId] = { progress: 0, restUntil: round + 1 + move.restRounds };
  events.push({ kind: 'careerMove', careerId: career.id, move: move.id, outcome, levels });
}

/** What a move came to, done to the player. Answers how many rungs it climbed. */
function applyMove(p: PlayerState, content: Content, moveId: string, result: CareerMoveResult, events: GameEvent[]): number {
  const life = p.life;
  let levels = 0;
  if (result.rungs && life.career) {
    const ladder = careerOf(content, life.career.id).levels;
    const to = Math.min(ladder.length - 1, life.career.level + result.rungs);
    levels = to - life.career.level;
    if (levels > 0) {
      life.career.level = to;
      life.rungStudy = 0;
      // The experience of the rung reached, so the ladder does not hold the player back below where they stand.
      life.careerSkill = Math.max(life.careerSkill, ladder[to].minSkill);
    }
  }
  if (result.salaryPct) life.salaryModPct += result.salaryPct;
  if (result.status) life.bonusStatus += result.status;
  if (result.passiveAnnual) life.recurring.push({ tag: `move_${moveId.toLowerCase()}`, kind: 'passive', annual: result.passiveAnnual, roundsLeft: null });
  if (result.health) addSkillPoints(p, content, { health: result.health }, events);
  return levels;
}
