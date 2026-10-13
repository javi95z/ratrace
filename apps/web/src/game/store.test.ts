import { content, lives } from '@ratrace/content';
import type { GameEvent, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import type { SavedGame } from '@/session/types';
import { createGameStore } from './store';

/** `guardMs` and `clock` are for the tests of taps that come too soon; without them no tap is ever too soon. */
function setup(store = new MemoryStore(), guardMs = 0, clock = { at: 0 }) {
  let ids = 0;
  let saved = 0;
  const sessions = new LocalSessions(store, content, lives, { newId: () => `id-${(ids += 1)}`, newSeed: () => `store-seed-${ids}`, now: () => (saved += 1) });
  const game = createGameStore({ sessions, content, now: () => clock.at, guardMs });
  return { store, sessions, game, get: game.getState, clock };
}

/** Answers every card of the hand with the given option, falling back as the engine does, and goes on to the finances. */
async function answerHand(get: ReturnType<typeof setup>['get'], option = 0) {
  get().leaveNews();
  while (get().stage === 'cards') {
    await get().pick(option);
    get().afterCard();
  }
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
  const cardsIn = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { kind: 'card' }> => e.kind === 'card');

  it('settles each card and shows what it did before the next one', async () => {
    const { get } = setup();
    await get().start('nurse');
    get().leaveNews();
    const hand = get().view?.hand ?? [];
    expect(hand.length).toBeGreaterThan(1);
    expect(get().stage).toBe('cards');

    for (let i = 0; i < hand.length; i++) {
      expect(get().view).toMatchObject({ phase: 'cards', answered: i });
      await get().pick(0);
      const s = get();
      expect(s.stage).toBe('outcome');
      expect(s.view?.answered).toBe(i + 1);
      expect(cardsIn(s.cardEvents).map((e) => e.cardId)).toEqual([hand[i]]);
      get().afterCard();
      expect(get().cardEvents).toEqual([]);
      if (i < hand.length - 1) expect(get().stage).toBe('cards');
    }
    expect(get()).toMatchObject({ stage: 'finance', orders: [] });
    expect(get().view?.phase).toBe('finance');
    expect(get().preview).not.toBeNull();
  });

  it('passes on the option the player chose', async () => {
    const { get } = setup();
    await get().start('nurse');
    get().leaveNews();
    await get().pick(1);
    expect(cardsIn(get().cardEvents)).toMatchObject([{ picked: 1 }]);
  });

  it('ignores a tap that comes at the wrong moment', async () => {
    const { get } = setup();
    await get().start('nurse');
    // Still on the news: there is no card on screen to answer, no result to leave, and no finances yet.
    await get().pick(1);
    get().afterCard();
    expect(() => get().toFinance()).not.toThrow();
    expect(get()).toMatchObject({ stage: 'news', preview: null });
    expect(get().view?.answered).toBe(0);
    get().leaveNews();
    get().afterCard();
    get().toFinance();
    expect(get()).toMatchObject({ stage: 'cards', preview: null });
    const first = get().pick(0);
    expect(get().busy).toBe(true);
    await get().pick(1);
    await first;
    expect(get().view?.answered).toBe(1);
    // The result is on screen: a second answer must wait for the next card.
    await get().pick(1);
    expect(get().view?.answered).toBe(1);
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
    expect(get()).toMatchObject({ stage: 'news', cardEvents: [], resolved: null });
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

    // Opened again, the device shows how the life ended, until another one begins.
    const again = setup(store);
    await again.get().boot();
    expect(again.get()).toMatchObject({ status: 'playing', stage: 'end' });
    expect(again.get().view).toEqual(get().view);
    expect(again.get().history).toEqual(get().history);
    await again.get().start('nurse');
    expect(again.get()).toMatchObject({ status: 'playing', stage: 'news', lifeId: 'nurse' });
  });
});

describe('a tap that comes too soon', () => {
  const GUARD = 400;
  /** A store whose clock the test moves by hand. `wait` lets a deliberate tap through. */
  async function guarded() {
    const ctx = setup(new MemoryStore(), GUARD);
    const wait = (ms = GUARD) => {
      ctx.clock.at += ms;
    };
    await ctx.get().start('nurse');
    wait();
    return { ...ctx, wait };
  }

  it('is ignored when it lands where the last tap just put something else', async () => {
    const { get, wait } = await guarded();
    // News → cards: the first option now sits under the thumb that pressed the button.
    get().leaveNews();
    await get().pick(1);
    expect(get()).toMatchObject({ stage: 'cards' });
    expect(get().view?.answered).toBe(0);
    wait(GUARD - 1);
    await get().pick(1);
    expect(get().view?.answered).toBe(0);
    wait(1);
    await get().pick(0);
    expect(get()).toMatchObject({ stage: 'outcome' });
    expect(get().view?.answered).toBe(1);

    // Result → next card: the same again.
    get().afterCard();
    expect(get().stage).toBe('outcome');
    wait();
    get().afterCard();
    expect(get().stage).toBe('cards');
    await get().pick(0);
    expect(get().view?.answered).toBe(1);
  });

  it('cannot play the round or skip the ledger by landing twice on the same spot', async () => {
    const { get, wait } = await guarded();
    get().leaveNews();
    while (get().view?.phase === 'cards') {
      wait();
      await get().pick(0);
      wait();
      get().afterCard();
    }
    expect(get().stage).toBe('finance');
    // "To your finances" and "Play the round" share a place.
    await get().play();
    expect(get()).toMatchObject({ stage: 'finance' });
    expect(get().view?.round).toBe(0);
    wait();
    await get().play();
    expect(get().stage).toBe('resolve');
    // So do "Play the round" and "Next round".
    get().next();
    expect(get().stage).toBe('resolve');
    expect(get().resolved).not.toBeNull();
    wait();
    get().next();
    expect(get().stage).toBe('news');
    // And "Next round" and "See what life brings".
    get().leaveNews();
    expect(get().stage).toBe('news');
    wait();
    get().leaveNews();
    expect(get().stage).toBe('cards');
  });

  it('does not stand in the way of the orders, which change no screen', async () => {
    const { get, wait } = await guarded();
    get().leaveNews();
    while (get().view?.phase === 'cards') {
      wait();
      await get().pick(0);
      wait();
      get().afterCard();
    }
    expect(get().addOrder(study)).toBe(true);
    expect(get().addOrder(overtime)).toBe(true);
    get().removeOrder(0);
    expect(get().orders).toEqual([overtime]);
  });
});

describe('when something goes wrong', () => {
  it('shows where the life stands now when another tab has played it on', async () => {
    const here = setup();
    await here.get().start('nurse');
    const there = setup(here.store);
    await there.get().boot();
    await answerHand(here.get);
    await here.get().play();
    here.get().next();

    there.get().leaveNews();
    await there.get().pick(1);
    expect(there.get()).toMatchObject({ status: 'playing', moved: true, busy: false, fault: false, stage: 'news' });
    expect(there.get().view).toEqual(here.get().view);
    expect(there.get().view?.round).toBe(1);
    there.get().clearMoved();
    expect(there.get().moved).toBe(false);
    // And from there it plays on like any other.
    await answerHand(there.get);
    expect(there.get().stage).toBe('finance');
  });

  it('goes home with nothing when the life was abandoned in another tab', async () => {
    const here = setup();
    await here.get().start('nurse');
    const there = setup(here.store);
    await there.get().boot();
    await here.get().abandon();
    there.get().leaveNews();
    await there.get().pick(0);
    expect(there.get()).toMatchObject({ status: 'none', view: null, moved: true });
  });

  it('says so, and stops, when the game itself fails: no button is left that does nothing', async () => {
    const { sessions, get } = setup();
    await get().start('nurse');
    const session = (await sessions.resume()).session;
    expect(session).not.toBeNull();
    // Break the save under the session, so that the engine refuses the next step.
    const broken = createGameStore({
      content,
      sessions: {
        ...sessions,
        start: () => sessions.start('nurse'),
        abandon: () => sessions.abandon(),
        resume: async () => ({
          lost: null,
          session: {
            gameId: 'x', lifeId: 'nurse', view: () => get().view as never, history: () => [], bankruptcies: () => 0, badges: () => [],
            answerCard: () => Promise.reject(new Error('invariant broken: cash is not a whole number')),
            playRound: () => Promise.reject(new Error('invariant broken')),
          },
        }),
      },
    });
    await broken.getState().boot();
    broken.getState().leaveNews();
    await broken.getState().pick(0);
    expect(broken.getState()).toMatchObject({ fault: true, busy: false, moved: false, stage: 'cards' });
  });
});

describe('what a step earned', () => {
  it('is on the screen with the result of the step, and gone with the next one', async () => {
    const { get } = setup();
    await get().start('nurse');
    expect(get()).toMatchObject({ gameId: 'id-1', badges: [], earned: [], unlocked: [] });
    // A lavish life on a nurse's pay ends in bankruptcy within a few rounds.
    let seen = false;
    for (let round = 0; round < 10 && !seen; round++) {
      await answerHand(get);
      get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 3 });
      await get().play();
      if (get().earned.includes('bankrupt')) {
        seen = true;
        expect(get().badges).toContain('bankrupt');
        expect(get().stage).toBe('resolve');
      }
      get().next();
      expect(get().earned).toEqual([]);
    }
    expect(seen).toBe(true);
    expect(get().badges).toContain('bankrupt');
  });

  it('includes the life unlocked by finishing a first one', async () => {
    const { get } = setup();
    await get().start('civil_servant');
    for (let round = 0; round < 20; round++) {
      await answerHand(get);
      await get().play();
      if (round < 19) get().next();
    }
    expect(get()).toMatchObject({ stage: 'resolve', unlocked: ['rider'] });
    get().next();
    expect(get()).toMatchObject({ stage: 'end', unlocked: [] });
  });

  it('comes back with the life when the page is opened again', async () => {
    const first = setup();
    await first.get().start('nurse');
    for (let round = 0; round < 8; round++) {
      await answerHand(first.get);
      first.get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 3 });
      await first.get().play();
      first.get().next();
    }
    const again = setup(first.store);
    await again.get().boot();
    expect(again.get().badges).toEqual(first.get().badges);
    expect(again.get().gameId).toBe('id-1');
  });
});

describe('opening the device while a life is being started', () => {
  it('keeps the life that was started, whatever the device then says', async () => {
    const { store, sessions, get } = setup();
    await sessions.start('nurse');
    // The device reads the old life and is slow to hand it over; meanwhile the player starts another.
    const load = store.loadGame;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    store.loadGame = async () => {
      const old = await load();
      await gate;
      return old;
    };
    const booting = get().boot();
    await Promise.resolve();
    store.loadGame = load;
    await get().start('engineer');
    release();
    await booting;
    expect(get()).toMatchObject({ status: 'playing', lifeId: 'engineer' });
    expect(get().view?.round).toBe(0);
  });
});

describe('going bankrupt', () => {
  it('is counted for the end screen', async () => {
    const { get } = setup();
    await get().start('nurse');
    expect(get().bankruptcies).toBe(0);
    // A lavish life on a nurse's pay ends in bankruptcy within a few rounds.
    for (let round = 0; round < 8; round++) {
      await answerHand(get);
      get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 3 });
      await get().play();
      get().next();
    }
    expect(get().bankruptcies).toBeGreaterThan(0);
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

  it('reopens on the next card when the hand was left half answered', async () => {
    const first = setup();
    await first.get().start('nurse');
    first.get().leaveNews();
    await first.get().pick(0);
    const again = setup(first.store);
    await again.get().boot();
    expect(again.get()).toMatchObject({ status: 'playing', stage: 'cards', cardEvents: [] });
    expect(again.get().view).toMatchObject({ phase: 'cards', answered: 1 });
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
