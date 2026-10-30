import { content, lives } from '@ratrace/content';
import { applyCard, createGame, ENGINE_VERSION, focusLeft, viewOf } from '@ratrace/engine';
import type { Business, GameState, GameView } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { roundDefaults, untouchedRound } from './roundDefaults';

const founder = lives.find((life) => life.id === 'founder');
if (!founder) throw new Error('no founder life');

/** The founder at the finances of her first round, with her shop, changed as a test needs. */
function atFinance(change: (state: GameState) => void = () => undefined): GameView {
  let state = createGame({ content, start: founder!.start }, 'defaults');
  while (state.phase === 'cards') state = applyCard(content, state, 0).state;
  const changed = structuredClone(state);
  change(changed);
  return viewOf(changed);
}

const shop = (state: GameState): Business => state.player.businesses[0];
const tends = (view: GameView) => roundDefaults(content, view, ENGINE_VERSION);

describe('the orders a round begins with', () => {
  it('run a business nobody runs by its owner, when there is focus for it', () => {
    const view = atFinance((state) => {
      shop(state).tended = false;
      state.player.life.focusUsed = 0;
    });
    expect(focusLeft(view.player)).toBeGreaterThan(0);
    expect(tends(view)).toEqual([{ type: 'tendBusiness', businessId: view.player.businesses[0].id }]);
  });

  it('give nothing when no focus is left', () => {
    const view = atFinance((state) => {
      shop(state).tended = false;
      state.player.life.focusUsed = 99;
    });
    expect(focusLeft(view.player)).toBe(0);
    expect(tends(view)).toEqual([]);
  });

  it('leave a business a manager runs, one run full time, and one already run this round alone', () => {
    for (const set of [{ manager: true }, { fullTime: true }, { tended: true }]) {
      const view = atFinance((state) => {
        Object.assign(shop(state), { tended: false, ...set });
        state.player.life.focusUsed = 0;
      });
      expect(tends(view)).toEqual([]);
    }
  });

  it('run as many as the focus allows, the one with the most in it first', () => {
    const view = atFinance((state) => {
      const small = { ...shop(state), id: 'business-small', capital: 1_000_00, tended: false };
      const large = { ...shop(state), id: 'business-large', capital: 90_000_00, tended: false };
      state.player.businesses = [small, large];
      state.player.life.focusUsed = 0;
      state.player.life.focusUsed = Math.max(0, focusLeft(state.player) - 1);
    });
    expect(focusLeft(view.player)).toBe(1);
    expect(tends(view)).toEqual([{ type: 'tendBusiness', businessId: 'business-large' }]);
  });

  it('give nothing outside the finances', () => {
    const state = createGame({ content, start: founder!.start }, 'defaults');
    expect(state.phase).toBe('cards');
    expect(tends(viewOf(state))).toEqual([]);
  });
});

describe('a round the player has not touched', () => {
  const idle = () =>
    atFinance((state) => {
      shop(state).tended = false;
      state.player.life.focusUsed = 0;
    });

  it('is one whose basket holds nothing, or only what the round put in it', () => {
    const view = idle();
    expect(tends(view).length).toBe(1);
    expect(untouchedRound(content, view, ENGINE_VERSION, tends(view))).toBe(true);
    const plain = atFinance((state) => {
      shop(state).tended = true;
    });
    expect(untouchedRound(content, plain, ENGINE_VERSION, [])).toBe(true);
  });

  it('is not one the player added to, or took the round\'s own orders out of', () => {
    const view = idle();
    const deposit = { type: 'depositIn', amount: 100 } as const;
    expect(untouchedRound(content, view, ENGINE_VERSION, [...tends(view), deposit])).toBe(false);
    expect(untouchedRound(content, view, ENGINE_VERSION, [])).toBe(false);
  });
});
