import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION, finalScore, livedStatus, realNetWorth } from '@ratrace/engine';
import { describe, expect, it, vi } from 'vitest';
import { LocalSessions, StaleSession } from './local';
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

/** The same life opened on a second device: a copy of what is stored, so the two can be played side by side and compared. */
async function elsewhere(store: MemoryStore): Promise<GameSession> {
  const copy = new MemoryStore();
  await copy.saveGame(await saveOf(store));
  return (await setup(copy).sessions.resume()).session as GameSession;
}

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
    expect(Object.keys(view).sort()).toEqual(['answered', 'finished', 'hand', 'limits', 'phase', 'player', 'round', 'timeline']);
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

    // A card answered may change the life so that one still waiting no longer fits, and another takes its place:
    // each answer is to the card waiting at that moment.
    while (session.view().phase === 'cards') {
      const waiting = session.view().hand[session.view().answered];
      const next = await session.answerCard(0);
      expect(next.events.filter((e) => e.kind === 'card')).toMatchObject([{ cardId: waiting }]);
    }
    const hand = session.view().hand;
    expect(session.view()).toMatchObject({ phase: 'finance', answered: hand.length });
    const save = await saveOf(store);
    expect(save.log).toEqual([{ picks: hand.map(() => 0), orders: null }]);
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

    const twin = await elsewhere(store);
    const a = await session.playRound({ orders: [] });
    const b = await twin.playRound({ orders: [] });
    expect(b.view).toEqual(a.view);
    expect(b.events).toEqual(a.events);
  });

  it('carries on in the middle of a hand, with the same dice still to roll', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('engineer');
    await playOne(session);
    await session.answerCard(1);
    expect(session.view()).toMatchObject({ phase: 'cards', answered: 1 });

    const again = await elsewhere(store);
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

  it('leaves a save from a newer version of the game where it is, and says so', async () => {
    const { store, sessions } = setup();
    await sessions.start('nurse');
    const ahead = { ...(await saveOf(store)), format: 2 as never };
    await store.saveGame(ahead);
    expect(await sessions.resume()).toEqual({ session: null, lost: 'newer' });
    // Not dropped: the newer page that wrote it can still open it.
    expect(await store.loadGame()).toEqual(ahead);
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

describe('what a life earns', () => {
  /** Plays rounds with the same orders, and collects everything the steps said was new. */
  async function live(session: GameSession, rounds: number, orders: Parameters<GameSession['playRound']>[0]['orders'] = []) {
    const earned: string[] = [];
    const unlocked: string[] = [];
    for (let i = 0; i < rounds && !session.view().finished; i++) {
      while (session.view().phase === 'cards') {
        const card = await session.answerCard(0);
        earned.push(...card.earned);
        unlocked.push(...card.unlocked);
      }
      const round = await session.playRound({ orders });
      earned.push(...round.earned);
      unlocked.push(...round.unlocked);
    }
    return { earned, unlocked };
  }
  const lavish = [{ type: 'setLifestyle' as const, tier: 3 as const }];

  it('says which badges a step earned for the first time, and writes them to the profile with when and where', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    // A lavish life on a nurse's pay ends in bankruptcy within a few rounds.
    const { earned } = await live(session, 10, lavish);
    expect(earned).toContain('bankrupt');
    expect(new Set(earned).size).toBe(earned.length);
    const profile = await store.loadProfile();
    expect(Object.keys(profile.badges).sort()).toEqual([...earned].sort());
    expect(profile.badges.bankrupt.gameId).toBe('id-1');
    expect(profile.badges.bankrupt.at).toBeGreaterThan(1_000);
    expect(session.badges()).toEqual(earned);
    expect((await saveOf(store)).journal.earned).toEqual(earned);
  });

  it('does not celebrate in a second life a badge the first one already earned', async () => {
    const { store, sessions } = setup();
    await live(await sessions.start('nurse'), 10, lavish);
    const first = await store.loadProfile();
    const second = await sessions.start('nurse');
    const { earned } = await live(second, 10, lavish);
    expect(earned).not.toContain('bankrupt');
    // The life itself still earned it, and its own record says so.
    expect(second.badges()).toContain('bankrupt');
    expect((await store.loadProfile()).badges.bankrupt).toEqual(first.badges.bankrupt);
  });

  it('adds everything the life has owned to the gallery', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    await answerAll(session);
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    expect((await store.loadProfile()).gallery).toContain('watch_casio');
    await answerAll(session);
    await session.playRound({ orders: [{ type: 'sellItem', itemId: 'watch_casio' }] });
    expect((await store.loadProfile()).gallery).toContain('watch_casio');
  });

  it('unlocks no life by finishing one: the rider and the others that were earned so are open from the start', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('civil_servant');
    const { unlocked } = await live(session, 20);
    expect(session.view().finished).toBe(true);
    expect(unlocked).toEqual([]);
    expect(Object.keys((await store.loadProfile()).unlocked)).toEqual([]);
  });

  it('unlocks the comeback when a life goes bankrupt, and says so once', async () => {
    const { store, sessions } = setup();
    const { unlocked } = await live(await sessions.start('nurse'), 10, lavish);
    expect(unlocked).toEqual(['comeback']);
    expect((await store.loadProfile()).unlocked.comeback.gameId).toBe('id-1');

    const again = await live(await sessions.start('nurse'), 10, lavish);
    expect(again.unlocked).toEqual([]);
    expect(Object.keys((await store.loadProfile()).unlocked)).toEqual(['comeback']);
  });

  it('records the run with the badges and the cities of the life', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('civil_servant');
    await live(session, 20);
    const [run] = await store.listRuns();
    expect(run.badges).toEqual(session.badges());
    expect(run.cities).toEqual(['madrid']);
    expect(run.badges).toContain('no_credit_card');
  });

  it('leaves the settings alone', async () => {
    const { store, sessions } = setup();
    await store.saveProfile({ ...(await store.loadProfile()), settings: { reducedMotion: true, sound: true } });
    await live(await sessions.start('nurse'), 3, lavish);
    expect((await store.loadProfile()).settings.reducedMotion).toBe(true);
  });

  it('plays on when the profile cannot be written, and records and celebrates the badge as soon as it can', async () => {
    const store = new MemoryStore();
    const { sessions, errors } = setup(store);
    const session = await sessions.start('nurse');
    const save = store.saveProfile;
    store.saveProfile = () => Promise.reject(new Error('no room'));
    const { earned } = await live(session, 10, lavish);
    expect(session.view().round).toBe(10);
    expect(earned).toEqual([]);
    expect(session.badges()).toContain('bankrupt');
    expect(errors.length).toBeGreaterThan(0);
    // The device takes writes again: the very next step tells the profile everything the life has earned.
    store.saveProfile = save;
    const later = await session.answerCard(0);
    expect(later.earned).toContain('bankrupt');
    expect((await store.loadProfile()).badges.bankrupt.gameId).toBe('id-1');
    expect((await session.answerCard(0)).earned).not.toContain('bankrupt');
  });

  it('tells the profile what a life had already earned when it is opened again', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    await live(session, 10, lavish);
    // The profile lost it: written by an older version of the game, or a tab closed at the wrong moment.
    await store.saveProfile({ ...(await store.loadProfile()), badges: {} });
    await sessions.resume();
    await vi.waitFor(async () => expect(Object.keys((await store.loadProfile()).badges)).toContain('bankrupt'));
  });

  it('unlocks the comeback for anyone with the badge on the device, whenever that is noticed', async () => {
    const { store, sessions } = setup();
    await live(await sessions.start('nurse'), 10, lavish);
    // A profile from before lives could be unlocked.
    await store.saveProfile({ ...(await store.loadProfile()), unlocked: {} });
    const next = await sessions.start('nurse');
    const first = await next.answerCard(0);
    expect(first.unlocked).toEqual(['comeback']);
  });

  it('unlocks a life at the step that earns its badge even if the list of lives cannot be read just then', async () => {
    const store = new MemoryStore();
    const { sessions } = setup(store);
    const session = await sessions.start('nurse');
    store.listRuns = () => Promise.reject(new Error('busy'));
    const { unlocked } = await live(session, 10, lavish);
    expect(unlocked).toEqual(['comeback']);
  });

  it('counts a badge of the gallery among the badges of the life that earned it', async () => {
    const { store, sessions } = setup();
    // Nineteen things owned in earlier lives: the twentieth earns the badge.
    const owned = content.items.filter((item) => item.id !== 'watch_casio').slice(0, 19).map((item) => item.id);
    await store.saveProfile({ ...(await store.loadProfile()), gallery: owned });
    const session = await sessions.start('nurse');
    await answerAll(session);
    const round = await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    expect(round.earned).toContain('twenty_items');
    expect(session.badges()).toContain('twenty_items');
    // Opened again, the life still counts it as its own.
    const reopened = (await setup(store).sessions.resume()).session as GameSession;
    await vi.waitFor(() => expect(reopened.badges()).toContain('twenty_items'));
    await live(session, 20);
    expect((await store.listRuns())[0].badges).toContain('twenty_items');
  });

  it('writes the life once on the step that ends it, and its finished record again only for the gallery badges the profile counts as its own', async () => {
    const { store, sessions } = setup();
    const owned = content.items.filter((item) => item.id !== 'watch_casio').slice(0, 19).map((item) => item.id);
    await store.saveProfile({ ...(await store.loadProfile()), gallery: owned });
    const session = await sessions.start('nurse');
    while (session.view().round < content.rounds - 1) await playOne(session);
    await answerAll(session);
    const calls: string[] = [];
    const { saveGame, addRun } = store;
    store.saveGame = (game) => (calls.push('saveGame'), saveGame(game));
    store.addRun = (run) => (calls.push(`addRun ${run.badges.includes('twenty_items') ? 'with' : 'without'} the gallery's badge`), addRun(run));
    // The twentieth thing, bought on the last round: the gallery's badge is earned by the step that ends the life.
    await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
    expect(session.view().finished).toBe(true);
    // The game once; the run first as the step made it, then with the badge of the gallery the profile said is this life's.
    expect(calls).toEqual(['addRun without the gallery\'s badge', 'saveGame', 'addRun with the gallery\'s badge']);
    expect((await store.listRuns())[0].badges).toContain('twenty_items');
  });

  it('refuses to start a life the player has not unlocked', async () => {
    const { store, sessions } = setup();
    await expect(sessions.start('heir')).rejects.toThrow('locked life: heir');
    expect(await store.loadGame()).toBeNull();
    await store.saveProfile({ ...(await store.loadProfile()), unlocked: { heir: { at: 1, gameId: 'g' } } });
    expect((await sessions.start('heir')).lifeId).toBe('heir');
  });

  it('rebuilds the journal with the game when a save is repaired', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    await live(session, 6, lavish);
    const save = await saveOf(store);
    await store.saveGame({ ...save, journal: undefined as never });
    const again = (await sessions.resume()).session as GameSession;
    expect(again.badges()).toEqual(session.badges());
    expect((await saveOf(store)).journal).toEqual(save.journal);
  });
});

describe('two tabs on one life', () => {
  it('refuses to play on from a tab the life has left behind, and changes nothing', async () => {
    const { store, sessions } = setup();
    const here = await sessions.start('nurse');
    const there = (await setup(store).sessions.resume()).session as GameSession;
    await playOne(here);
    await playOne(here);
    const saved = JSON.stringify(await saveOf(store));
    const view = there.view();

    await expect(there.answerCard(1)).rejects.toBeInstanceOf(StaleSession);
    await expect(there.playRound({ orders: [] })).rejects.toBeInstanceOf(StaleSession);
    expect(there.view()).toBe(view);
    expect(JSON.stringify(await saveOf(store))).toBe(saved);
    // The tab that is ahead plays on undisturbed.
    expect((await playOne(here)).view.round).toBe(3);
  });

  it('refuses to play on once the life was finished, replaced or abandoned elsewhere', async () => {
    const finished = setup();
    const a = await finished.sessions.start('nurse');
    const b = (await setup(finished.store).sessions.resume()).session as GameSession;
    while (!a.view().finished) await playOne(a);
    await expect(b.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    expect(await finished.store.listRuns()).toHaveLength(1);
    expect((await saveOf(finished.store)).state.finished).toBe(true);

    const replaced = setup();
    const old = await replaced.sessions.start('nurse');
    await replaced.sessions.start('engineer');
    await expect(old.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    expect((await saveOf(replaced.store)).lifeId).toBe('engineer');

    const abandoned = setup();
    const gone = await abandoned.sessions.start('nurse');
    await abandoned.sessions.abandon();
    await expect(gone.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    expect(await abandoned.store.loadGame()).toBeNull();
  });

  it('knows another life by its id, even one saved at the very same moment', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('nurse');
    await store.saveGame({ ...(await saveOf(store)), gameId: 'someone-else' });
    await expect(session.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
  });

  it('plays on when not even the first save could be written: nothing stored cannot contradict it', async () => {
    const store = new MemoryStore();
    store.saveGame = () => Promise.reject(new Error('no database'));
    const { sessions, errors } = setup(store);
    const session = await sessions.start('nurse');
    expect(errors).toHaveLength(1);
    expect(await store.loadGame()).toBeNull();
    const result = await playOne(session);
    expect(result.view.round).toBe(1);
  });

  it('is not fooled by its own writes that failed: the device still holds what it last took from this tab', async () => {
    const store = new MemoryStore();
    const { sessions, errors } = setup(store);
    const session = await sessions.start('nurse');
    const save = store.saveGame;
    store.saveGame = () => Promise.reject(new Error('disk full'));
    await playOne(session);
    expect(errors.length).toBeGreaterThan(0);
    store.saveGame = save;
    const result = await playOne(session);
    expect(result.view.round).toBe(2);
    expect((await saveOf(store)).state.round).toBe(2);
  });
});

describe('finishing a life', () => {
  it('records the run, with its history and its log, and keeps the finished life until another begins', async () => {
    const { store, sessions } = setup();
    const session = await sessions.start('civil_servant');
    while (!session.view().finished) await playOne(session);

    // Kept, so that closing the page on the last ledger or on the score does not lose the result.
    expect((await saveOf(store)).state.finished).toBe(true);
    const again = await setup(store).sessions.resume();
    expect(again.lost).toBeNull();
    expect(again.session?.view()).toEqual(session.view());
    expect(again.session?.history()).toEqual(session.history());
    expect(await store.listRuns()).toHaveLength(1);
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
    await expect(session.playRound({ orders: [] })).rejects.toThrow('already finished');

    // A new life takes its place; the run stays in the record.
    await sessions.start('nurse');
    expect((await saveOf(store)).lifeId).toBe('nurse');
    expect(await store.listRuns()).toHaveLength(1);
  });
});
