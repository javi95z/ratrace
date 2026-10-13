import { refreshDerived } from '../life/derive';
import type { Content, GameState, LifeState, PlayerState, Recurring } from '../types';

/**
 * A copy of the state with parts of the player and their life replaced, and the derived fields
 * brought back in step. Tests use it to set up a situation without playing the rounds that lead to it.
 */
export function withPlayer(
  content: Content,
  state: GameState,
  over: Partial<PlayerState>,
  life: Partial<LifeState> = {},
): GameState {
  const next = structuredClone(state);
  Object.assign(next.player, structuredClone(over));
  Object.assign(next.player.life, structuredClone(life));
  refreshDerived(next.player, content, next.round);
  return next;
}

/** A lasting passive income, as a recurring entry. */
export function passive(annual: number): Recurring[] {
  return [{ tag: 'test_income', kind: 'passive', annual, roundsLeft: null }];
}
