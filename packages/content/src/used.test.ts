import { createGame, quoteItem, viewOf } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { content } from './content';
import { lives } from './lives';

describe('a thing second hand', () => {
  it('never adds more status than the same thing new, for anyone, whatever they own of its kind', () => {
    const nurse = lives.find((life) => life.id === 'nurse');
    if (!nurse) throw new Error('the nurse is a life');
    const state = createGame({ content, start: nurse.start }, 'used');
    const owned = (itemId: string) => ({ itemId, value: 100_000, roundsLeft: null, paid: 100_000, age: 0 });
    // Nothing of a kind owned, and the best of the kind owned: a watch most of all, as a Rolex beside a Submariner.
    for (const holding of [[], [owned('watch_rolex')], [owned('watch_omega')]]) {
      const view = viewOf({ ...state, player: { ...state.player, life: { ...state.player.life, items: holding } } });
      for (const item of content.items) {
        if (holding.some((held) => held.itemId === item.id)) continue;
        const quote = quoteItem(content, view, item.id);
        if (quote.used === null) continue;
        expect(quote.used.statusReal, `${item.id} beside ${holding.map((held) => held.itemId).join(', ')}`).toBeLessThanOrEqual(quote.statusReal);
        expect(quote.used.statusReal, item.id).toBeLessThanOrEqual(quote.used.status);
      }
    }
  });
});
