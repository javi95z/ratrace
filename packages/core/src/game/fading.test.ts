import { content, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame } from '@ratrace/engine';
import type { GameState, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { fadingStatus, wornOff } from './fading';

/** A nurse at the finances of her first round, with cash enough for any trip. */
function atFinance(): GameState {
  let state = createGame({ content, start: lives[0].start }, 'fading');
  while (state.phase === 'cards') state = applyCard(content, state, 0).state;
  return { ...state, player: { ...state.player, cash: state.player.cash + 200_000_00 } };
}

/** Plays a round with these orders, and the cards of the next. */
function round(state: GameState, orders: Order[]): GameState {
  let next = applyRound(content, state, { orders }).state;
  while (next.phase === 'cards' && !next.finished) next = applyCard(content, next, 0).state;
  return next;
}

describe('status that runs out', () => {
  it('is listed with the rounds it still counts, the soonest first', () => {
    const start = atFinance();
    expect(fadingStatus(start.player)).toEqual([]);
    const after = round(start, [{ type: 'buyItem', itemId: 'sea_yacht_charter' }]);
    expect(fadingStatus(after.player)).toEqual([{ itemId: 'sea_yacht_charter', roundsLeft: 1 }]);
  });

  it('is told once it wears off, and not before', () => {
    const start = atFinance();
    const charter: Order[] = [{ type: 'buyItem', itemId: 'sea_yacht_charter' }];
    const second = round(start, charter);
    expect(wornOff(content, start.player, charter, second.player)).toEqual([]);
    const third = round(second, []);
    expect(wornOff(content, second.player, [], third.player)).toEqual(['sea_yacht_charter']);
  });

  it('tells of a trip that lasted only the round it was bought in', () => {
    const start = atFinance();
    const weekend: Order[] = [{ type: 'buyItem', itemId: 'travel_weekend' }];
    const next = round(start, weekend);
    expect(wornOff(content, start.player, weekend, next.player)).toEqual(['travel_weekend']);
  });

});
