import { flowsOf } from './flows';
import type { Cents } from './money';
import { newTally } from './tally';
import type { Content, GameView } from './types';

/**
 * The tax a year bears as the player stands now, before any order: on income, on investments and on
 * property, the round's bill spread over its years. Beside `cashflow`, it makes the flow what a round
 * really leaves in cash. Kept out of the selectors so that the server's bundle of the rules is not touched.
 */
export function taxAnnual(content: Content, state: GameView): Cents {
  return Math.floor(flowsOf(content, state.player, state.timeline[state.round], newTally()).bill.total / content.yearsPerRound);
}
