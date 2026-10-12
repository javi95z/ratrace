import { content, lives } from '@ratrace/content';
import type { Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import type { SavedGame } from '@/session/types';
import { createGameStore } from './store';

function setup(store = new MemoryStore()) {
  let ids = 0;
  const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => `store-seed-${ids}`, now: () => 1 });
  const game = createGameStore({ sessions, content });
  return { store, sessions, game, get: game.getState };
}

/** Answers every card of the hand with the given option, falling back as the engine does. */
async function answerHand(get: ReturnType<typeof setup>['get'], option = 0) {
  get().leaveNews();
  while (get().stage === 'cards') await get().pick(option);
}

const study: Order = { type: 'focus', action: 'studyCareer' };
const overtime: Order = { type: 'focus', action: 'overtime' };
const isFocus = (action: string) => (order: Order) => order.type === 'focus' && order.action === action;
const isLifestyle = (order: Order) => order.type === 'setLifestyle';

describe('opening the game', () => {
  it('finds no life in progress on a new device', async () => {
    const { get } = setup();
    expect(get().status).toBe('booting');
    await get().boot();
    expect(get()).toMatchObject({ status: 'none', lost: null, view: null, lifeId: null });
  });

  it('says why a saved life is gone', async () => {
    const { store, sessions, get } = setup();
    await sessions.start('nurse');
    await store.saveGame({ ...((await store.loadGame()) as SavedGame), contentVersion: '0.0.1' });
    await get().boot();
    expect(get()).toMatchObject({ status: 'none', lost: 'outdated' });
  });

  it('starts a life at the news of its first round', async () => {
    const { get } = setup();
    await get().start('engineer');
    const s = get();
    expect(s).toMatchObject({ status: 'playing', lifeId: 'engineer', stage: 'news', lost: null, busy: false, orders: [], preview: null });
    expect(s.view?.round).toBe(0);
    expect(s.history).toHaveLength(1);
  });
});

describe('the cards of a round', () => {
  it('shows them one at a time and answers them all at once after the last', async () => {
    const { get } = setup();
    await get().start('nurse');
    get().leaveNews();
    const hand = get().view?.hand ?? [];
    expect(get()).toMatchObject({ stage: 'cards', cardIndex: 0 });
    await get().pick(0);
    expect(get()).toMatchObject({ stage: 'cards', cardIndex: 1 });
    expect(get().view?.phase).toBe('cards');
    while (get().stage === 'cards') await get().pick(0);
    const s = get();
    expect(s.stage).toBe('outcome');
    expect(s.view?.phase).toBe('finance');
    expect(s.handEvents.filter((e) => e.kind === 'card').map((e) => (e.kind === 'card' ? e.cardId : ''))).toEqual(hand);
  });

  it('passes on the option the player chose for each card', async () => {
    const { get } = setup();
    await get().start('nurse');
    await answerHand(get, 1);
    const cards = get().handEvents.filter((e) => e.kind === 'card');
    expect(cards.length).toBeGreaterThan(0);
    for (const event of cards) if (event.kind === 'card') expect(event.picked).toBe(1);
  });
});

describe('the finance phase', () => {
  async function inFinance(lifeId = 'nurse') {
    const ctx = setup();
    await ctx.get().start(lifeId);
    await answerHand(ctx.get);
    ctx.get().toFinance();
    return ctx;
  }

  it('opens with an empty basket and the preview of an untouched round', async () => {
    const { get } = await inFinance();
    const s = get();
    expect(s).toMatchObject({ stage: 'finance', orders: [], refusal: null });
    expect(s.preview?.rejected).toEqual([]);
    expect(s.preview?.income.salary).toBeGreaterThan(0);
  });

  it('takes an order that can be done and shows what it changes', async () => {
    const { get } = await inFinance();
    const before = get().preview?.player.life.focusUsed ?? 0;
    expect(get().addOrder(study)).toBe(true);
    expect(get().orders).toEqual([study]);
    expect(get().preview?.player.life.focusUsed).toBe(before + 1);
    expect(get().refusal).toBeNull();
  });

  it('refuses an order that cannot be done, says why, and leaves the basket alone', async () => {
    const { get } = await inFinance();
    get().addOrder(study);
    expect(get().addOrder({ type: 'buy', assetId: 'msci_world', amount: 999_999_999_00 })).toBe(false);
    expect(get().refusal).toBe('not-enough-cash');
    expect(get().orders).toEqual([study]);
    expect(get().addOrder(study)).toBe(false);
    expect(get().refusal).toBe('already-done');
    get().clearRefusal();
    expect(get().refusal).toBeNull();
  });

  it('removes an order, and with it any order that only worked because of it', async () => {
    const { get } = await inFinance('engineer');
    const cash = get().view?.player.cash ?? 0;
    expect(get().addOrder({ type: 'borrow', amount: 500_000 })).toBe(true);
    expect(get().addOrder(study)).toBe(true);
    expect(get().addOrder({ type: 'depositIn', amount: cash + 400_000 })).toBe(true);
    get().removeOrder(0);
    expect(get().orders).toEqual([study]);
    expect(get().preview?.rejected).toEqual([]);
    get().removeOrder(5);
    expect(get().orders).toEqual([study]);
  });

  it('switches a choice on and off, and replaces a setting instead of stacking it', async () => {
    const { get } = await inFinance();
    expect(get().setOrder(isFocus('overtime'), overtime)).toBe(true);
    expect(get().setOrder(isFocus('overtime'), overtime)).toBe(true);
    expect(get().orders).toEqual([overtime]);
    expect(get().setOrder(isFocus('overtime'), null)).toBe(true);
    expect(get().orders).toEqual([]);

    get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 0 });
    get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 2 });
    expect(get().orders).toEqual([{ type: 'setLifestyle', tier: 2 }]);
    expect(get().preview?.player.lifestyleTier).toBe(2);
  });

  it('keeps the old setting when the new one is refused', async () => {
    const { get } = await inFinance('heir');
    get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 3 });
    expect(get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 0 })).toBe(false);
    expect(get().refusal).toBe('below-lifestyle-floor');
    expect(get().orders).toEqual([{ type: 'setLifestyle', tier: 3 }]);
  });

  it('plays the round, keeps what happened for the ledger, and empties the basket', async () => {
    const { get } = await inFinance();
    get().addOrder(study);
    const before = get().view;
    await get().play();
    const s = get();
    expect(s).toMatchObject({ stage: 'resolve', orders: [], preview: null, busy: false });
    expect(s.resolved?.before).toBe(before);
    expect(s.resolved?.events.some((e) => e.kind === 'ledger' && e.line === 'salary')).toBe(true);
    expect(s.view?.round).toBe(1);
    expect(s.view?.player.life.careerSkill).toBe(2);
    expect(s.history).toHaveLength(2);
  });

  it('moves on to the news of the next round', async () => {
    const { get } = await inFinance();
    await get().play();
    get().next();
    expect(get()).toMatchObject({ stage: 'news', cardIndex: 0, picks: {}, handEvents: [], resolved: null });
  });

  it('ignores a second tap while the round is being played', async () => {
    const { get } = await inFinance();
    const first = get().play();
    expect(get().busy).toBe(true);
    await get().play();
    await first;
    expect(get().view?.round).toBe(1);
  });
});

describe('a whole life', () => {
  it('ends on the end screen, with the run recorded and nothing left to resume', async () => {
    const { store, get } = setup();
    await get().start('civil_servant');
    for (let round = 0; round < 20; round++) {
      expect(get().stage).toBe('news');
      await answerHand(get, round % 3);
      get().toFinance();
      get().addOrder(study);
      await get().play();
      expect(get().stage).toBe('resolve');
      get().next();
    }
    expect(get()).toMatchObject({ stage: 'end', status: 'playing' });
    expect(get().view?.finished).toBe(true);
    expect(get().history).toHaveLength(21);
    expect(await store.listRuns()).toHaveLength(1);

    const again = setup(store);
    await again.get().boot();
    expect(again.get().status).toBe('none');
  });
});

describe('coming back', () => {
  it('reopens at the news when the cards are still to be answered', async () => {
    const first = setup();
    await first.get().start('nurse');
    const again = setup(first.store);
    await again.get().boot();
    expect(again.get()).toMatchObject({ status: 'playing', lifeId: 'nurse', stage: 'news' });
    expect(again.get().view).toEqual(first.get().view);
  });

  it('reopens in the finance phase when the cards were already answered', async () => {
    const first = setup();
    await first.get().start('nurse');
    await answerHand(first.get);
    const again = setup(first.store);
    await again.get().boot();
    expect(again.get()).toMatchObject({ status: 'playing', stage: 'finance', orders: [] });
    expect(again.get().preview).not.toBeNull();
  });

  it('can abandon a life', async () => {
    const { store, get } = setup();
    await get().start('nurse');
    await get().abandon();
    expect(get()).toMatchObject({ status: 'none', view: null, lifeId: null, stage: 'news' });
    expect(await store.loadGame()).toBeNull();
  });
});
