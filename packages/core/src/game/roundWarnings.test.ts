import { content, lives } from '@ratrace/content';
import { applyCard, createGame, previewRound, viewOf } from '@ratrace/engine';
import type { GameState } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { roundWarnings } from './roundWarnings';

/** A nurse at the finances of her first round. */
function atFinance(): GameState {
  let state = createGame({ content, start: lives[0].start }, 'warnings');
  while (state.phase === 'cards') state = applyCard(content, state, 0).state;
  return state;
}

describe('the warnings before a round', () => {
  it('say nothing of a round that is fine', () => {
    const view = viewOf(atFinance());
    expect(roundWarnings(content, view, previewRound(content, view, { orders: [] }))).toEqual([]);
  });

  it('tell of cash running out onto the credit card, and how much', () => {
    const view = viewOf(atFinance());
    // A lavish life on a nurse's pay spends far more than she earns.
    const preview = previewRound(content, view, { orders: [{ type: 'setLifestyle', tier: 3 }] });
    const [warning] = roundWarnings(content, view, preview);
    expect(warning).toEqual({ kind: 'card', amount: -preview.cashAfter - preview.player.deposit, rateBp: content.debt.creditCardRateBp });
    expect(warning.kind === 'card' && warning.amount > 0).toBe(true);
  });
});
