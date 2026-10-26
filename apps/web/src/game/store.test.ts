import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { GameEvent, GameView, Order } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from '@ratrace/core/session/local';
import { RankedSessions } from '@ratrace/core/session/ranked';
import { GameSessions } from '@ratrace/core/session/sessions';
import { rankedServer } from '@/testing/rankedServer';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { SavedGame } from '@ratrace/core/session/types';
import { memoryBasket } from '@ratrace/core/game/basket';
import { createGameStore, PENDING_AFTER_MS } from '@ratrace/core/game/store';
import { Refused } from '@ratrace/core/session/errors';

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
    // A life that has to be unlocked is unlocked first, as it would be for a player who may choose it.
    await ctx.store.saveProfile({ ...(await ctx.store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'earlier' } } });
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
    // The nurse knows nothing of money yet: a fund is open to her, a coin is not.
    expect(get().addOrder({ type: 'buy', assetId: 'bitcoin', amount: 100_00 })).toBe(false);
    expect(get().refusal).toBe('needs-finance-skill');
    expect(get().addOrder({ type: 'depositIn', amount: 999_999_999_00 })).toBe(false);
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
    // The player is told that another order went with the one they removed.
    expect(get().alsoRemoved).toBe(1);
    get().removeOrder(5);
    expect(get().orders).toEqual([study]);
    expect(get().alsoRemoved).toBe(0);
    get().removeOrder(0);
    expect(get()).toMatchObject({ orders: [], alsoRemoved: 0 });
  });

  it('puts back what was taken out of the basket, until the basket changes again', async () => {
    const { get } = await inFinance('engineer');
    expect(get().addOrder(study)).toBe(true);
    expect(get().addOrder(overtime)).toBe(true);
    get().removeOrder(0);
    expect(get().orders).toEqual([overtime]);
    get().undoRemove();
    expect(get()).toMatchObject({ orders: [study, overtime], undo: null });
    // A change made after taking one out is the one kept.
    get().removeOrder(1);
    expect(get().setOrder(isLifestyle, { type: 'setLifestyle', tier: 0 })).toBe(true);
    expect(get().undo).toBeNull();
    get().undoRemove();
    expect(get().orders).toEqual([study, { type: 'setLifestyle', tier: 0 }]);
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

describe('when the round\'s time is up', () => {
  it('plays the basket from the finances, exactly as playing the round would, and shows what it did', async () => {
    const [timed, played] = [setup(), setup()];
    for (const { get } of [timed, played]) {
      await get().start('engineer');
      await answerHand(get);
      expect(get().addOrder(study)).toBe(true);
    }
    await timed.get().timeUp();
    await played.get().play();
    expect(timed.get()).toMatchObject({ stage: 'resolve', orders: [], busy: false });
    expect(timed.get().view?.round).toBe(1);
    expect(timed.get().view).toEqual(played.get().view);
    expect(timed.get().resolved).toEqual(played.get().resolved);
  });

  it('plays it with no orders from the cards, the cards still waiting taking their first option', async () => {
    const { get, sessions } = setup();
    await get().start('nurse');
    get().leaveNews();
    expect(get().stage).toBe('cards');
    await get().timeUp();
    expect(get()).toMatchObject({ stage: 'resolve', cardEvents: [], offered: null });
    const { session } = await sessions.resume();
    expect(session?.view().round).toBe(1);
  });

  it('plays it from the news, and from a card\'s result', async () => {
    const one = setup();
    await one.get().start('nurse');
    await one.get().timeUp();
    expect(one.get().stage).toBe('resolve');
    const two = setup();
    await two.get().start('nurse');
    two.get().leaveNews();
    await two.get().pick(0);
    expect(two.get().stage).toBe('outcome');
    await two.get().timeUp();
    expect(two.get()).toMatchObject({ stage: 'resolve', cardEvents: [] });
  });

  it('leaves a round already being played, a ledger and an end as they are', async () => {
    const { get } = setup();
    await get().start('nurse');
    await answerHand(get);
    const first = get().play();
    await get().timeUp();
    await first;
    expect(get().view?.round).toBe(1);
    expect(get().stage).toBe('resolve');
    await get().timeUp();
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

    // Leaving the end screen of the old life lets go of nothing: another has taken its place.
    await again.get().closeFinished(get().gameId ?? '');
    expect(again.get()).toMatchObject({ status: 'playing', lifeId: 'nurse' });
  });

  it('lets a finished life go once its end screen is left, and keeps it among the finished lives', async () => {
    const { store, get } = setup();
    await get().start('civil_servant');
    for (let round = 0; round < 20; round++) {
      await answerHand(get, 0);
      get().toFinance();
      await get().play();
      get().next();
    }
    expect(get().view?.finished).toBe(true);
    await get().closeFinished(get().gameId ?? '');
    expect(get()).toMatchObject({ status: 'none', view: null });
    expect(await store.loadGame()).toBeNull();
    expect(await store.listRuns()).toHaveLength(1);
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

  it('opens the life as it now stands when it is told the device\'s copy has changed, and says so', async () => {
    // The account brought a further copy from another device: no step was refused, nothing was pressed.
    const here = setup();
    await here.get().start('nurse');
    const there = setup(here.store);
    await there.get().boot();
    await answerHand(here.get);
    await here.get().play();
    await there.get().reopen();
    expect(there.get()).toMatchObject({ status: 'playing', moved: true });
    expect(there.get().view?.round).toBe(1);
  });

  it('says nothing when a life appears where there was none: the front door simply offers it', async () => {
    const here = setup();
    await here.get().boot();
    const there = setup(here.store);
    await there.get().start('nurse');
    await here.get().reopen();
    expect(here.get()).toMatchObject({ status: 'playing', moved: false, lifeId: 'nurse' });
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
            gameId: 'x', lifeId: 'nurse', view: () => get().view as never, history: () => [], bankruptcies: () => 0, story: () => [], badges: () => [],
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

  it('keeps the life and the basket when the server refuses a round, and says so: not that it moved', async () => {
    const { sessions, get } = setup();
    await get().start('nurse');
    const refusing = createGameStore({
      content,
      sessions: {
        ...sessions,
        start: () => sessions.start('nurse'),
        abandon: () => sessions.abandon(),
        resume: async () => {
          const found = await sessions.resume();
          const held = found.session;
          if (held === null) return found;
          // The same session, but the server refuses its round.
          const refuses = new Proxy(held, {
            get: (target, key) => {
              if (key === 'playRound') return () => Promise.reject(new Refused('the server answered 422: cannot-play'));
              const value: unknown = Reflect.get(target, key, target);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
          return { ...found, session: refuses };
        },
      },
    });
    await refusing.getState().boot();
    await answerHand(refusing.getState, 0);
    refusing.getState().toFinance();
    refusing.getState().addOrder(study);
    await refusing.getState().play();
    expect(refusing.getState()).toMatchObject({ rejected: true, moved: false, fault: false, stage: 'finance', status: 'playing' });
    expect(refusing.getState().orders).toHaveLength(1);
    refusing.getState().clearRejected();
    expect(refusing.getState().rejected).toBe(false);
  });

  /** A life as a server shows it, with `change` made to every view of it: the life of a room on rules other than the page's. */
  function shownAs(change: (player: GameView['player']) => void) {
    const { sessions } = setup();
    const as = (view: GameView): GameView => {
      const shown = structuredClone(view);
      change(shown.player);
      return shown;
    };
    const game = createGameStore({
      content,
      sessions: {
        ...sessions,
        start: () => sessions.start('nurse'),
        abandon: () => sessions.abandon(),
        resume: async () => {
          const real = (await sessions.resume()).session ?? (await sessions.start('nurse'));
          return {
            lost: null,
            session: {
              gameId: real.gameId, lifeId: real.lifeId, rules: '0.37.0', served: true, view: () => as(real.view()), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [],
              answerCard: async (option: number) => {
                const result = await real.answerCard(option);
                return { ...result, view: as(result.view) };
              },
              playRound: async (choices) => {
                const result = await real.playRound(choices);
                return { ...result, view: as(result.view) };
              },
            },
          };
        },
      },
    });
    return game.getState;
  }

  it('goes from the last card to the finances of a life a server plays on older rules, whose standing its own content worked out', async () => {
    // Older content scored the player's standing otherwise: the view is the server's, and this page's figure for it is not.
    const get = shownAs((player) => {
      player.statusPoints += 7;
    });
    await get().boot();
    get().leaveNews();
    while (get().stage === 'cards') {
      await get().pick(0);
      expect(get().cardEvents.length).toBeGreaterThan(0);
      get().afterCard();
    }
    expect(get()).toMatchObject({ stage: 'finance', fault: false });
    expect(get().preview).not.toBeNull();
    await get().play();
    expect(get()).toMatchObject({ stage: 'resolve', fault: false });
  });

  it('says so, rather than leave a card\'s result with a button that does nothing, when this page cannot judge the round at all', async () => {
    const get = shownAs((player) => {
      player.cash = -1;
    });
    await get().boot();
    get().leaveNews();
    while (get().stage === 'cards') {
      await get().pick(0);
      get().afterCard();
    }
    expect(get()).toMatchObject({ fault: true, busy: false });
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

  it('is shown for the answer to a card as well as for a round', async () => {
    const { sessions } = setup();
    const real = await sessions.start('nurse');
    // A session whose next card earns a badge and unlocks a life, whatever is answered.
    const game = createGameStore({
      content,
      sessions: {
        ...sessions,
        start: () => sessions.start('nurse'),
        abandon: () => sessions.abandon(),
        resume: async () => ({
          lost: null,
          session: {
            gameId: real.gameId, lifeId: real.lifeId, view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => ['mba'],
            answerCard: async (option: number) => ({ ...(await real.answerCard(option)), earned: ['mba'], unlocked: ['heir'] }),
            playRound: (choices) => real.playRound(choices),
          },
        }),
      },
    });
    await game.getState().boot();
    game.getState().leaveNews();
    await game.getState().pick(0);
    expect(game.getState()).toMatchObject({ stage: 'outcome', earned: ['mba'], unlocked: ['heir'], badges: ['mba'] });
    game.getState().afterCard();
    expect(game.getState()).toMatchObject({ earned: [], unlocked: [] });
  });

  it('never sends a life on older rules an order those rules do not know', async () => {
    const { sessions } = setup();
    const real = await sessions.start('nurse');
    const sent: Order[][] = [];
    // A life begun under the rules of 0.38, before careers had moves of their own.
    const game = createGameStore({
      content,
      sessions: {
        ...sessions,
        start: () => sessions.start('nurse'),
        abandon: () => sessions.abandon(),
        resume: async () => ({
          lost: null,
          session: {
            gameId: real.gameId, lifeId: real.lifeId, rules: '0.38.0', view: () => real.view(), history: () => real.history(), bankruptcies: () => 0, story: () => [], badges: () => [],
            answerCard: (option: number) => real.answerCard(option),
            playRound: (choices) => (sent.push(choices.orders), real.playRound(choices)),
          },
        }),
      },
    });
    await game.getState().boot();
    expect(game.getState().rules).toBe('0.38.0');
    await answerHand(game.getState);
    game.getState().setOrder(isFocus('overtime'), overtime);
    game.getState().setOrder(isFocus('careerMove'), { type: 'focus', action: 'careerMove', move: 'anything' } as Order);
    await game.getState().play();
    expect(sent).toHaveLength(1);
    expect(sent[0].map((order) => (order.type === 'focus' ? order.action : order.type))).toEqual(['overtime']);
  });

  it('keeps the orders of a round not yet played for a page opened again, and forgets them once it is played', async () => {
    const store = new MemoryStore();
    const basket = memoryBasket();
    const page = () => {
      let ids = 0;
      const sessions = new LocalSessions(store, content, lives, { newId: () => `kept-${(ids += 1)}`, newSeed: () => 'basket-seed', now: () => (ids += 1) });
      return createGameStore({ sessions, content, basket });
    };
    const first = page();
    await first.getState().start('nurse');
    await answerHand(first.getState);
    first.getState().setOrder(isLifestyle, { type: 'setLifestyle', tier: 2 });
    expect(first.getState().orders).toHaveLength(1);

    // The page is reloaded before the round is played.
    const second = page();
    await second.getState().boot();
    expect(second.getState().stage).toBe('finance');
    expect(second.getState().orders).toEqual([{ type: 'setLifestyle', tier: 2 }]);

    await second.getState().play();
    expect(basket.kept).toBeNull();
    const third = page();
    await third.getState().boot();
    expect(third.getState().orders).toEqual([]);
  });

  it('remembers whether the player had a partner when a card was answered, for a card that brings one in', async () => {
    const { get } = setup();
    await get().start('nurse');
    get().leaveNews();
    const before = get().view?.player.life.partner;
    await get().pick(0);
    expect(get().offered?.partnered).toBe(before);
  });

  it('unlocks nothing by finishing a first life: the lives that were earned that way are open from the start', async () => {
    const { get } = setup();
    await get().start('civil_servant');
    for (let round = 0; round < 20; round++) {
      await answerHand(get);
      await get().play();
      if (round < 19) get().next();
    }
    expect(get()).toMatchObject({ stage: 'resolve', unlocked: [] });
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

describe('a ranked life on screen', { timeout: 60_000 }, () => {
  /** The round store over the sessions of both kinds, and a server of ranked lives the test holds. */
  function rankedSetup(server = rankedServer(), versions = { engine: ENGINE_VERSION, content: CONTENT_VERSION }) {
    const store = new MemoryStore();
    let ids = 0;
    let clock = 0;
    const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
    const sessions = new GameSessions(store, new LocalSessions(store, content, lives, deps), new RankedSessions(() => server.api, store, content, lives, versions, deps), versions);
    const game = createGameStore({ sessions, content });
    return { server, store, game, get: game.getState };
  }

  it('starts nothing, and asks, when the player has a ranked life in progress on another device', async () => {
    const phone = rankedSetup();
    expect(await phone.get().start('nurse', { ranked: true })).toBe(true);
    await answerHand(phone.get);
    await phone.get().play();
    const there = phone.get().gameId as string;
    // The desk has only last night's finished life, or nothing: it knows nothing of the one on the phone.
    const desk = rankedSetup(phone.server);
    expect(await desk.get().start('engineer', { ranked: true })).toBe(false);
    expect(desk.get()).toMatchObject({ status: 'booting', elsewhere: { gameId: there, lifeId: 'nurse', round: 1, here: true } });
    expect(phone.server.games.get(there)?.status).toBe('playing');
    expect(await desk.store.loadGame()).toBeNull();
    // Left as it is: the question goes away, and nothing has changed anywhere.
    desk.get().clearElsewhere();
    expect(desk.get().elsewhere).toBeNull();
    expect(phone.server.games.get(there)?.status).toBe('playing');
    // Asked again, and told to end it: the new life begins and the other is given up.
    expect(await desk.get().start('engineer', { ranked: true })).toBe(false);
    expect(await desk.get().start('engineer', { ranked: true, replace: there })).toBe(true);
    expect(desk.get()).toMatchObject({ status: 'playing', ranked: true, lifeId: 'engineer', elsewhere: null });
    expect(phone.server.games.get(there)?.status).toBe('abandoned');
  });

  it('takes up on this device the ranked life in progress elsewhere, when the player would rather go on with it', async () => {
    const phone = rankedSetup();
    await phone.get().start('nurse', { ranked: true });
    await answerHand(phone.get);
    await phone.get().play();
    const desk = rankedSetup(phone.server);
    await desk.get().start('engineer', { ranked: true });
    expect(await desk.get().continueElsewhere()).toBe('taken');
    expect(desk.get()).toMatchObject({ status: 'playing', ranked: true, lifeId: 'nurse', gameId: phone.get().gameId, elsewhere: null });
    expect(desk.get().view).toEqual(phone.get().view);
    expect(phone.server.games.get(phone.get().gameId as string)?.status).toBe('playing');
    // With nothing asked about, there is nothing to take up.
    expect(await desk.get().continueElsewhere()).toBe('gone');
  });

  it('finds the life in the way gone when it was given up elsewhere meanwhile, and asks no more about it', async () => {
    const phone = rankedSetup();
    await phone.get().start('nurse', { ranked: true });
    const desk = rankedSetup(phone.server);
    await desk.get().start('engineer', { ranked: true });
    await phone.get().abandon();
    expect(await desk.get().continueElsewhere()).toBe('gone');
    expect(desk.get().elsewhere).toBeNull();
    expect(desk.get().status).not.toBe('playing');
    // Nothing is in the way now.
    expect(await desk.get().start('engineer', { ranked: true })).toBe(true);
  });

  it('says that a ranked life in progress elsewhere cannot be continued here when it was begun under other rules', async () => {
    const phone = rankedSetup();
    await phone.get().start('nurse', { ranked: true });
    // The same life, as a page of a later build would be told of it.
    const game = phone.server.games.get(phone.get().gameId as string) as { engine_version: string };
    game.engine_version = '0.0.1';
    const desk = rankedSetup(phone.server);
    expect(await desk.get().start('nurse', { ranked: true })).toBe(false);
    expect(desk.get().elsewhere).toMatchObject({ here: false });
    expect(await desk.get().continueElsewhere()).toBe('gone');
    expect(desk.get().status).not.toBe('playing');
  });

  it('says so, and changes nothing, when the server could not be reached to take that life up', async () => {
    const phone = rankedSetup();
    await phone.get().start('nurse', { ranked: true });
    const desk = rankedSetup(phone.server);
    await desk.get().start('engineer', { ranked: true });
    phone.server.state.down = true;
    expect(await desk.get().continueElsewhere()).toBe('away');
    expect(desk.get().status).not.toBe('playing');
    expect(await desk.store.loadGame()).toBeNull();
    // The question is still there to be answered when the server is.
    expect(desk.get().elsewhere).not.toBeNull();
  });

  it('says which kind of life it is, and plays it like any other', async () => {
    const { get, server } = rankedSetup();
    await get().start('nurse', { ranked: true });
    expect(get()).toMatchObject({ status: 'playing', ranked: true, fellBack: false, unreachable: false, lifeId: 'nurse' });
    await answerHand(get);
    expect(get().stage).toBe('finance');
    await get().play();
    expect(get()).toMatchObject({ stage: 'resolve', ranked: true });
    expect(get().view?.round).toBe(1);
    expect(server.games.get(get().gameId as string)?.round).toBe(1);
    // A life the device plays is not one.
    await get().start('nurse', { ranked: false });
    expect(get().ranked).toBe(false);
  });

  it('says so when a life asked for as ranked began as a casual one, once', async () => {
    const { get, server } = rankedSetup();
    server.state.down = true;
    await get().start('nurse', { ranked: true });
    expect(get()).toMatchObject({ status: 'playing', ranked: false, fellBack: true });
    get().clearFellBack();
    expect(get().fellBack).toBe(false);
    // Asked for as casual, there is nothing to say.
    await get().start('nurse', { ranked: false });
    expect(get().fellBack).toBe(false);
  });

  it('does not take a step that did not get through for a fault: it says so, and the step can be taken again', async () => {
    const { get, server } = rankedSetup();
    await get().start('nurse', { ranked: true });
    get().leaveNews();
    const before = get().view;
    server.state.down = true;
    await get().pick(0);
    expect(get()).toMatchObject({ unreachable: true, fault: false, busy: false, stage: 'cards', moved: false });
    expect(get().view).toBe(before);
    server.state.down = false;
    await get().pick(0);
    expect(get()).toMatchObject({ unreachable: false, stage: 'outcome' });
    expect(get().view?.answered).toBe(1);
    // The same for a round.
    get().afterCard();
    while (get().stage === 'cards') {
      await get().pick(0);
      get().afterCard();
    }
    server.state.down = true;
    await get().play();
    expect(get()).toMatchObject({ unreachable: true, fault: false, stage: 'finance' });
    get().clearUnreachable();
    expect(get().unreachable).toBe(false);
    server.state.down = false;
    await get().play();
    expect(get()).toMatchObject({ stage: 'resolve', unreachable: false });
  });

  /** A server that holds every answer to a card until the test lets it go. */
  function slowServer() {
    const server = rankedServer();
    let release = () => {};
    const held = () => new Promise<void>((resolve) => (release = resolve));
    let gate = held();
    const api = { ...server.api, card: async (...args: Parameters<typeof server.api.card>) => {
      await gate;
      gate = held();
      return server.api.card(...args);
    } };
    return { server: { ...server, api }, release: () => release() };
  }
  const later = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it('shows the option tapped at once, then the card answered with its choice, while a slow server rolls the dice', async () => {
    const { server, release } = slowServer();
    const { get } = rankedSetup(server);
    await get().start('nurse', { ranked: true });
    get().leaveNews();
    const answering = get().pick(1);
    expect(get()).toMatchObject({ busy: true, picked: 1, stage: 'cards', pending: false });
    await later(PENDING_AFTER_MS + 30);
    expect(get()).toMatchObject({ stage: 'outcome', pending: true, picked: 1, cardEvents: [] });
    expect(get().offered?.cardId).toBe(get().view?.hand[0]);
    // Nothing to go on to until the result is in.
    get().afterCard();
    expect(get().stage).toBe('outcome');
    release();
    await answering;
    expect(get()).toMatchObject({ stage: 'outcome', pending: false, picked: null, busy: false });
    expect(get().cardEvents.some((event) => event.kind === 'card')).toBe(true);
    expect(get().view?.answered).toBe(1);
  });

  it('puts the card back to be answered again when the slow server does not answer', async () => {
    const { server, release } = slowServer();
    const { get } = rankedSetup(server);
    await get().start('nurse', { ranked: true });
    get().leaveNews();
    const before = get().view;
    const answering = get().pick(0);
    await later(PENDING_AFTER_MS + 30);
    expect(get().pending).toBe(true);
    server.state.down = true;
    release();
    await answering;
    expect(get()).toMatchObject({ stage: 'cards', pending: false, picked: null, busy: false, unreachable: true, offered: null });
    expect(get().view).toBe(before);
  });

  it('never shows a quick answer waiting', async () => {
    const { get } = rankedSetup();
    await get().start('nurse', { ranked: true });
    get().leaveNews();
    const answering = get().pick(0);
    expect(get().picked).toBe(0);
    await answering;
    await later(PENDING_AFTER_MS + 30);
    expect(get()).toMatchObject({ stage: 'outcome', pending: false, picked: null });
    expect(get().cardEvents.length).toBeGreaterThan(0);
  });

  it('opens the life as it stands, and says it moved, when the server is further along than the screen', async () => {
    const { get, server, store } = rankedSetup();
    await get().start('nurse', { ranked: true });
    get().leaveNews();
    // Another device takes a step of the same life.
    await server.call({ action: 'card', gameId: get().gameId, step: 0, option: 0 });
    await get().pick(1);
    expect(get()).toMatchObject({ status: 'playing', moved: true, fault: false, unreachable: false });
    expect(get().view?.answered).toBe(1);
    expect(((await store.loadGame()) as { step: number }).step).toBe(1);
  });
});

