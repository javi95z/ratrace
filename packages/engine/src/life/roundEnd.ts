import type { Content, GameEvent, PlayerState } from '../types';

/**
 * Turns the page on a round: a pending move happens, and focus and this round's pay boost reset.
 */
export function finishRound(p: PlayerState, _content: Content, events: GameEvent[]): void {
  const life = p.life;
  if (life.movingTo !== null) {
    p.cityId = life.movingTo;
    life.movingTo = null;
    events.push({ kind: 'moved', cityId: p.cityId });
  }
  life.focusUsed = 0;
  life.salaryBoostPct = 0;
}
