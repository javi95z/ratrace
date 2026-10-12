import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION, finalScore, livedStatus, realNetWorth } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from './local';
import { MemoryStore } from './memory';
import type { GameSession, SavedGame } from './types';

function setup(store = new MemoryStore()) {
  let ids = 0;
  let clock = 1_000;
  const errors: unknown[] = [];
  const sessions = new LocalSessions(store, content, lives, {
    newId: () => `id-${(ids += 1)}`,
    newSeed: () => `seed-${ids}`,
    now: () => (clock += 1),
    onSaveError: (error) => errors.push(error),
  });
  return { store, sessions, errors };
}

const saveOf = async (store: MemoryStore) => (await store.loadGame()) as SavedGame;

/** Answers every card still waiting with the option given. */
async function answerAll(session: GameSession, option = 0) {
  while (session.view().phase === 'cards') await session.answerCard(option);
}

/** Answers every card with its first option and plays the round with no orders. */
async function playOne(session: GameSession) {
  await answerAll(session);
  return session.playRound({ orders: [] });
}

describe('starting a life', () => {
  it('makes a game with its own id and seed and saves it at once', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    expect(session.gameId).toBe('id-1');
    expect(session.lifeId).toBe('nurse');
    const save = await saveOf(store);
    expect(save).toMatchObject({
      format: 1, gameId: 'id-1', lifeId: 'nurse', seed: 'seed-1', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION,
      log: [], bankruptcies: 0, updatedAt: 1_001,
    });
    expect(save.history).toEqual([realNetWorth(save.state)]);
    expect(session.history()).toEqual(save.history);
  });

  it('shows the player a view: no seed, no random stream, no future', async () => {
    const { sessions } = setup();
    const view = (await sessions.start('engineer')).view();
    expect(Object.keys(view).sort()).toEqual(['answered', 'finished', 'hand', 'phase', 'player', 'round', 'timeline']);
    expect(view.timeline).toHaveLength(1);
    expect(view.hand.length).toBeGreaterThan(0);
    expect(JSON.stringify(view)).not.toContain('seed-1');
  });

  it('refuses a life that does not exist', async () => {
    const { store, sessions } = setup();
    await expect(sessions.start('pirate')).rejects.toThrow('unknown life: pirate');
    expect(await store.loadGame()).toBeNull();
  });

  it('replaces a life in progress', async () => {
    const { store, sessions } = setup();
    const first = await sessions.start('nurse');
    await playOne(first);
    const second = await sessions.start('civil_servant');
    expect(second.gameId).toBe('id-2');
    expect(await saveOf(store)).toMatchObject({ gameId: 'id-2', lifeId: 'civil_servant', log: [] });
  });
});

describe('playing', () => {
  it('answers one card at a time, returns what that card did and saves after each', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    const before = session.view();
    expect(before.hand.length).toBeGreaterThan(1);

    const first = await session.answerCard(0);
    const cards = first.events.filter((e) => e.kind === 'card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ cardId: before.hand[0], option: 0 });
    expect(first.view).toMatchObject({ phase: 'cards', answered: 1 });
    expect(session.view()).toBe(first.view);
    expect(before).toMatchObject({ phase: 'cards', answered: 0 });
    expect((await saveOf(store)).log).toEqual([{ picks: [0], orders: null }]);
    expect((await saveOf(store)).state.answered).toBe(1);

    for (let i = 1; i < before.hand.length; i++) {
      const next = await session.answerCard(0);
      expect(next.events.filter((e) => e.kind === 'card')).toMatchObject([{ cardId: before.hand[i] }]);
    }
    expect(session.view()).toMatchObject({ phase: 'finance', answered: before.hand.length });
    const save = await saveOf(store);
    expect(save.log).toEqual([{ picks: before.hand.map(() => 0), orders: null }]);
    expect(save.state.phase).toBe('finance');
  });

  it('logs the option asked for, so that the life can be played again exactly', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('engineer');
    const hand = session.view().hand;
    await session.answerCard(1);
    await session.answerCard(2);
    // Not a number of an option at all: the engine takes the first option, and that is what is logged.
    await session.answerCard(Number.NaN);
    expect((await saveOf(store)).log[0].picks.slice(0, 3)).toEqual([1, 2, 0].slice(0, hand.length));
  });

  it('plays a round, returns the ledger and saves', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    const hand = session.view().hand;
    await answerAll(session);
    const orders = [{ type: 'focus' as const, action: 'studyCareer' as const }];
    const result = await session.playRound({ orders });
    expect(result.view.round).toBe(1);
    expect(result.view.timeline).toHaveLength(2);
    expect(result.events.some((e) => e.kind === 'ledger' && e.line === 'salary')).toBe(true);
    const save = await saveOf(store);
    expect(save.log).toEqual([{ picks: hand.map(() => 0), orders }]);
    expect(save.history).toHaveLength(2);
    expect(session.history()).toEqual(save.history);
  });

  it('plays a round whose cards were never answered, as the engine does: first options', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    const result = await session.playRound({ orders: [] });
    expect(result.view.round).toBe(1);
    expect(result.events.some((e) => e.kind === 'card')).toBe(true);
    expect((await saveOf(store)).log).toEqual([{ picks: [], orders: [] }]);
  });

  it('plays a round with part of the hand answered: the rest take their first options', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    const hand = session.view().hand;
    await session.answerCard(1);
    const result = await session.playRound({ orders: [] });
    expect(result.events.filter((e) => e.kind === 'card')).toHaveLength(hand.length - 1);
    expect((await saveOf(store)).log).toEqual([{ picks: [1], orders: [] }]);
  });

  it('refuses an answer when no card is waiting, and changes nothing', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    await answerAll(session);
    const view = session.view();
    const saved = JSON.stringify(await saveOf(store));
    await expect(session.answerCard(0)).rejects.toThrow('already answered');
    expect(session.view()).toBe(view);
    expect(JSON.stringify(await saveOf(store))).toBe(saved);
  });

  it('takes one step at a time, in the order asked', async () => {
    const { sessions } = setup();
    const session = await sessions.start('nurse');
    const hand = session.view().hand;
    const steps = await Promise.all([...hand.map(() => session.answerCard(0)), session.playRound({ orders: [] })]);
    hand.forEach((_, i) => expect(steps[i].view).toMatchObject({ round: 0, answered: i + 1 }));
    expect(steps[hand.length - 1].view.phase).toBe('finance');
    expect(steps[hand.length].view.round).toBe(1);
  });

  it('counts bankruptcies', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    // A lavish life on a nurse's pay ends in bankruptcy within a few rounds.
    for (let i = 0; i < 8; i++) {
      await answerAll(session);
      await session.playRound({ orders: [{ type: 'setLifestyle', tier: 3 }] });
    }
    expect((await saveOf(store)).bankruptcies).toBeGreaterThan(0);
    expect(session.bankruptcies()).toBe((await saveOf(store)).bankruptcies);
    expect((await setup(store).sessions.resume()).session?.bankruptcies()).toBe(session.bankruptcies());
  });

  it('keeps playing when the save cannot be written, and says so', async () => {
    const store = new MemoryStore();
    const { sessions, errors } = setup(store);
    const session = await sessions.start('nurse');
    const hand = session.view().hand;
    store.saveGame = () => Promise.reject(new Error('disk full'));
    const result = await playOne(session);
    expect(result.view.round).toBe(1);
    // One save after each card and one after the round: every one of them failed and was reported.
    expect(errors).toHaveLength(hand.length + 1);
    expect(String(errors[0])).toContain('disk full');
  });
});

describe('coming back to a life', () => {
  it('finds nothing when no life is in progress', async () => {
    expect(await setup().sessions.resume()).toEqual({ session: null, lost: null });
  });

  it('carries on exactly where the player left, mid-round or between rounds', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('engineer');
    await playOne(session);
    await playOne(session);
    await answerAll(session);

    const again = await setup(store).sessions.resume();
    expect(again.lost).toBeNull();
    expect(again.session?.gameId).toBe('id-1');
    expect(again.session?.lifeId).toBe('engineer');
    expect(again.session?.view()).toEqual(session.view());
    expect(again.session?.history()).toEqual(session.history());

    const a = await session.playRound({ orders: [] });
    const b = await (again.session as GameSession).playRound({ orders: [] });
    expect(b.view).toEqual(a.view);
    expect(b.events).toEqual(a.events);
  });

  it('carries on in the middle of a hand, with the same dice still to roll', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('engineer');
    await playOne(session);
    await session.answerCard(1);
    expect(session.view()).toMatchObject({ phase: 'cards', answered: 1 });

    const again = (await setup(store).sessions.resume()).session as GameSession;
    expect(again.view()).toEqual(session.view());
    const a = await session.answerCard(2);
    const b = await again.answerCard(2);
    expect(b.view).toEqual(a.view);
    expect(b.events).toEqual(a.events);
  });

  it('rebuilds a state damaged in the middle of a hand', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('engineer');
    await playOne(session);
    await session.answerCard(1);
    const save = await saveOf(store);
    await store.saveGame({ ...save, state: { ...save.state, answered: 0 } });
    const again = await sessions.resume();
    expect(again.session?.view()).toEqual(session.view());
    expect((await saveOf(store)).state.answered).toBe(1);
  });

  it('drops a save it cannot open, and says why', async () => {
    const { store, sessions } = setup();
    await sessions.start('nurse');
    const save = await saveOf(store);
    await store.saveGame({ ...save, contentVersion: '0.0.1' });
    expect(await sessions.resume()).toEqual({ session: null, lost: 'outdated' });
    expect(await store.loadGame()).toBeNull();

    await sessions.start('nurse');
    await store.saveGame({ ...(await saveOf(store)), state: null as never, seed: null as never });
    expect(await sessions.resume()).toEqual({ session: null, lost: 'damaged' });
    expect(await store.loadGame()).toBeNull();
    expect(await sessions.resume()).toEqual({ session: null, lost: null });
  });

  it('rebuilds a damaged state and saves the repair', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    await playOne(session);
    const save = await saveOf(store);
    await store.saveGame({ ...save, state: { ...save.state, player: { ...save.state.player, cash: -1 } } });
    const again = await sessions.resume();
    expect(again.session?.view()).toEqual(session.view());
    expect((await saveOf(store)).state.player.cash).toBe(session.view().player.cash);
  });

  it('abandons a life', async () => {
    const { store, sessions } = setup();
    await sessions.start('nurse');
    await sessions.abandon();
    expect(await store.loadGame()).toBeNull();
    expect(await sessions.resume()).toEqual({ session: null, lost: null });
  });
});

describe('finishing a life', () => {
  it('records the run, with its history and its log, and clears the game in progress', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('civil_servant');
    while (!session.view().finished) await playOne(session);

    expect(await store.loadGame()).toBeNull();
    const runs = await store.listRuns();
    expect(runs).toHaveLength(1);
    const run = runs[0];
    const view = session.view();
    expect(run).toMatchObject({
      format: 1, runId: 'id-1', lifeId: 'civil_servant', seed: 'seed-1', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION,
      score: finalScore(content, view), netWorth: realNetWorth(view), status: livedStatus(view),
      escapedAtRound: view.player.escapedAtRound, verified: false,
    });
    expect(run.history).toHaveLength(21);
    expect(run.history[20]).toBe(run.netWorth);
    expect(run.log).toHaveLength(20);
    expect(run.finishedAt).toBeGreaterThan(1_000);
    expect(await sessions.resume()).toEqual({ session: null, lost: null });
    await expect(session.playRound({ orders: [] })).rejects.toThrow('already finished');
  });
});
