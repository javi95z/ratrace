import { content, lives } from '@ratrace/content';
import { applyCard, createGame, escapeProgress, viewOf } from '@ratrace/engine';
import type { GameView, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { escapeShift } from './escapeShift';

/** A nurse at the finances of her first round, with this much in savings and cash enough for anything. */
function nurse(deposit: number): GameView {
  let state = createGame({ content, start: lives[0].start }, 'escape-shift');
  while (state.phase === 'cards') state = applyCard(content, state, 0).state;
  const view = viewOf(state);
  return { ...view, player: { ...view.player, deposit, cash: view.player.cash + 200_000_00 } };
}

/** The nurse with the least savings whose interest covers her life: out of the rat race by a hair. */
function justCovered(): GameView {
  let low = 0;
  let high = 100_000_000_00;
  while (high - low > 100_00) {
    const mid = Math.floor((low + high) / 2);
    const escape = escapeProgress(content, nurse(mid));
    if (escape.passiveAfterTax >= escape.outgoings) high = mid;
    else low = mid;
  }
  return nurse(high);
}

const club: Order = { type: 'buyItem', itemId: 'member_club' };

describe('what a choice does to the way out', () => {
  it('says nothing to a life far from it', () => {
    expect(escapeShift(content, nurse(0), [], [club])).toBeNull();
  });

  it('warns of a purchase whose upkeep sends a covered life back into the rat race', () => {
    const view = justCovered();
    const shift = escapeShift(content, view, [], [club]);
    expect(shift).not.toBeNull();
    expect(shift!.back).toBe(true);
    expect(shift!.passiveAnnual).toBeLessThan(shift!.outgoingsAnnual);
  });

  it('gives the figures plainly where the line is not crossed', () => {
    const view = nurse(justCovered().player.deposit * 3);
    const shift = escapeShift(content, view, [], [club]);
    expect(shift).not.toBeNull();
    expect(shift!.back).toBe(false);
    expect(shift!.passiveAnnual).toBeGreaterThanOrEqual(shift!.outgoingsAnnual);
  });

  it('says nothing of a choice that changes neither side', () => {
    const view = justCovered();
    expect(escapeShift(content, view, [club], [club])).toBeNull();
  });

  it('says nothing outside the finances', () => {
    const view = justCovered();
    expect(escapeShift(content, { ...view, phase: 'cards' }, [], [club])).toBeNull();
  });
});
