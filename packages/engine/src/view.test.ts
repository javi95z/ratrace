// These tests cast views to states and corrupt them on purpose.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { applyCards, applyRound, createGame, previewRound } from './game';
import { assertViewInvariants, findInvariantBreaks, findViewBreaks } from './invariants';
import { previewCard } from './life/cards';
import { cashflow, escapeProgress, finalScore, realNetWorth } from './selectors';
import { fixtureContent, fixtureStart } from './testing/fixture';
import type { CardDef, GameState, GameView, LifeStart, Order } from './types';
import { viewOf } from './view';

const office: LifeStart = { lifeId: 'tester', career: { id: 'office', level: 0 }, careerSkill: 0, financeSkill: 0, focus: 3 };
const content = fixtureContent();
content.cards = ['a', 'b', 'c', 'd'].map((id): CardDef => ({
  id, category: 'luck', weight: 1, cooldown: 0,
  options: [{}, { effects: { cash: 50_000 }, outcomes: [{ weight: 1, effects: { cash: 10_000 } }, { weight: 1, effects: { cash: -10_000 } }] }],
}));

const start = (): GameState => createGame({ content, start: { ...fixtureStart(), cash: 2_000_000, life: office } }, 'view');
const orders: Order[] = [{ type: 'buy', assetId: 'fund_world', amount: 300_000 }, { type: 'depositIn', amount: 100_000 }, { type: 'focus', action: 'overtime' }];

/** Plays `rounds` rounds with the same orders and answers. */
function played(rounds: number): GameState {
  let state = start();
  for (let i = 0; i < rounds; i++) {
    state = applyCards(content, state, Object.fromEntries(state.hand.map((id) => [id, 1]))).state;
    state = applyRound(content, state, { orders }).state;
  }
  return state;
}

describe('viewOf', () => {
  it('keeps the game as the player sees it and leaves out the seed, the random stream and every later world', () => {
    const state = played(3);
    const view = viewOf(state);
    expect(Object.keys(view).sort()).toEqual(['answered', 'finished', 'hand', 'phase', 'player', 'round', 'timeline']);
    expect(view.timeline).toEqual(state.timeline.slice(0, 4));
    expect(view.player).toEqual(state.player);
    expect(view).toMatchObject({ round: 3, finished: false, phase: state.phase, hand: state.hand });
  });

  it('holds nothing of the future at any round of a life', () => {
    let state = start();
    while (!state.finished) {
      const view = viewOf(state);
      expect(view.timeline).toHaveLength(state.round + 1);
      const text = JSON.stringify(view);
      expect(text).not.toContain(state.seed);
      const next = state.timeline[state.round + 1];
      expect(text).not.toContain(`"priceLevel":${next.priceLevel},`);
      state = applyRound(content, state, { orders: [] }).state;
    }
    expect(viewOf(state).timeline).toHaveLength(content.rounds + 1);
  });

  it('is a copy: changing the view does not change the game', () => {
    const state = played(1);
    const before = JSON.stringify(state);
    const view = viewOf(state);
    view.player.cash = 1;
    view.timeline[0].priceLevel = 1;
    view.hand.push('zzz');
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('a view is enough to show every number', () => {
  it('previews a round exactly as the full game does', () => {
    for (const rounds of [0, 2, 5]) {
      const state = applyCards(content, played(rounds), {}).state;
      expect(previewRound(content, viewOf(state), { orders })).toEqual(previewRound(content, state, { orders }));
    }
  });

  it('previews a card, and reads cashflow, net worth and score, exactly as the full game does', () => {
    const state = played(2);
    const view = viewOf(state);
    for (const cardId of state.hand) expect(previewCard(content, view, cardId)).toEqual(previewCard(content, state, cardId));
    expect(cashflow(content, view)).toEqual(cashflow(content, state));
    expect(realNetWorth(view)).toBe(realNetWorth(state));
    expect(finalScore(content, view)).toBe(finalScore(content, state));
  });

  it('accepts the full game wherever a view is asked for', () => {
    const state: GameState = played(1);
    const asView: GameView = state;
    expect(findViewBreaks(content, asView)).toEqual([]);
  });
});

describe('a view cannot be played', () => {
  it('is refused by applyCards and applyRound, which need the full game', () => {
    const view = viewOf(start()) as any;
    expect(() => applyCards(content, view, {})).toThrow('invariant broken: the state is not a game state');
    const answered = viewOf(applyCards(content, start(), {}).state) as any;
    expect(() => applyRound(content, answered, { orders: [] })).toThrow('invariant broken: the state is not a game state');
    // A view dressed up with a seed and a stream is still missing the next world.
    const dressed = { ...answered, seed: 'view', rng: { cards: [1, 2, 3, 4] } };
    expect(() => applyRound(content, dressed, { orders: [] })).toThrow(/timeline has 1 states, expected 21/);
  });
});

describe('findViewBreaks', () => {
  it('finds nothing wrong with the view of a sound game, at the start, in the middle and at the end', () => {
    expect(findViewBreaks(content, viewOf(start()))).toEqual([]);
    expect(findViewBreaks(content, viewOf(played(7)))).toEqual([]);
    const done = played(20);
    expect(done.finished).toBe(true);
    expect(findViewBreaks(content, viewOf(done))).toEqual([]);
    expect(() => assertViewInvariants(content, viewOf(done))).not.toThrow();
  });

  it('checks the player as strictly as the full check does', () => {
    const view = viewOf(played(2));
    view.player.cash = -5;
    view.player.life.focusUsed = 1.5;
    expect(findViewBreaks(content, view)).toEqual([
      'cash is not a non-negative whole number: -5',
      'life.focusUsed is not a non-negative whole number: 1.5',
    ]);
    expect(() => assertViewInvariants(content, view)).toThrow(/^invariant broken at round 2 \(state [0-9a-f]{16}\): cash is not/);
  });

  it('needs the timeline to end at the current round, or to be whole', () => {
    const view = viewOf(played(3));
    view.timeline.pop();
    expect(findViewBreaks(content, view)).toEqual(['timeline has 3 states, expected 4 or 21']);
    const padded = viewOf(played(3));
    padded.timeline.push(padded.timeline[3], padded.timeline[3]);
    expect(findViewBreaks(content, padded)).toEqual(['timeline has 6 states, expected 4 or 21']);
  });

  it('does not ask a view for a seed or a random stream, and the full check still does', () => {
    const state = played(1);
    expect(findInvariantBreaks(content, state)).toEqual([]);
    const noStream = { ...state, rng: { cards: [1, 2, 3] } } as any;
    expect(findInvariantBreaks(content, noStream)).toEqual(['rng.cards is not a saved random stream']);
    expect(findViewBreaks(content, noStream)).toEqual([]);
    expect(() => assertViewInvariants(content, null as never)).toThrow('invariant broken: the state is not a game state');
  });
});

describe('escapeProgress', () => {
  it('gives both sides of the escape test at any point of a round, with no orders', () => {
    const waiting = played(2);
    expect(waiting.phase).toBe('cards');
    const answered = applyCards(content, waiting, {}).state;
    const expected = previewRound(content, answered, { orders: [] }).escape;
    expect(escapeProgress(content, viewOf(answered))).toEqual(expected);
    // Before the cards are answered there is no preview to ask, and the figure is still there.
    expect(escapeProgress(content, viewOf(waiting))).toEqual(expected);
    expect(expected.outgoings).toBeGreaterThan(0);
  });

  it('counts passive income after its own tax', () => {
    const state = createGame({ content, start: fixtureStart() }, 'escape');
    const withIncome = { ...state, player: { ...state.player, extraPassiveAnnual: 1_850_000, life: { ...state.player.life, recurring: [{ tag: 'bar', kind: 'passive' as const, annual: 1_850_000, roundsLeft: null }] } } };
    expect(escapeProgress(content, withIncome)).toEqual({ passiveAfterTax: 3_567_000, outgoings: 3_600_000 });
  });
});
