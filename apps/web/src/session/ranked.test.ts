import { challengeOf, challengeStart, content, CONTENT_VERSION, lives, replayLife } from '@ratrace/content';
import { ENGINE_VERSION, finalScore, viewOf } from '@ratrace/engine';
import type { LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { rankedServer } from '@/testing/rankedServer';
import { RankedInProgress, StaleSession, Unreachable } from '@ratrace/core/session/errors';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { rankedOf, RankedSessions } from '@ratrace/core/session/ranked';
import type { RankedApi } from '@ratrace/core/session/ranked';
import { GameSessions } from '@ratrace/core/session/sessions';
import type { GameSession, RankedGame, SavedGame } from '@ratrace/core/session/types';

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
const nurse = lives.find((life) => life.id === 'nurse');
const locked = lives.find((life) => life.unlock !== 'default');
if (!nurse || !locked) throw new Error('the content has no nurse, or no locked life');

/** A device: its store, and the sessions the game uses, over a server of ranked lives the test holds. */
function device(server: { api: RankedApi | null } | null, store = new MemoryStore(), versions = VERSIONS) {
  let ids = 0;
  let clock = 1_000;
  const deps = { newId: () => `local-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) };
  const local = new LocalSessions(store, content, lives, deps);
  const api = (): RankedApi | null => server?.api ?? null;
  const ranked = new RankedSessions(api, store, content, lives, versions, deps);
  return { store, sessions: new GameSessions(store, local, ranked, versions) };
}
async function play(session: GameSession, rounds = Number.POSITIVE_INFINITY) {
  for (let i = 0; i < rounds && !session.view().finished; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}
const held = async (store: MemoryStore) => (await store.loadGame()) as RankedGame | SavedGame | null;

describe('a ranked life, as the game plays it', { timeout: 120_000 }, () => {
  it('is played on the server to the very end the engine gives those choices, and is kept in the records as ranked', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    expect(session.ranked).toBe(true);
    expect(session.view().timeline).toHaveLength(1);
    const seed = server.seeds.get(session.gameId) as string;
    // The device holds the game's id and what it may see of it. No seed, and no world to come.
    const record = (await held(d.store)) as RankedGame;
    expect(record).toMatchObject({ ranked: true, gameId: session.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 0 });
    expect(JSON.stringify(record)).not.toContain(seed);

    await play(session);
    const log = server.games.get(session.gameId)?.log as LoggedRound[];
    const whole = replayLife(content, nurse.start, seed, log);
    expect(session.view()).toEqual(viewOf(whole.state));
    expect(session.history()).toEqual(whole.history);
    expect(session.badges().slice(0, whole.journal.earned.length)).toEqual(whole.journal.earned);
    expect(session.story()).toEqual(whole.journal.story.milestones);
    const runs = await d.store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ runId: session.gameId, lifeId: 'nurse', ranked: true, score: finalScore(content, whole.state), history: whole.history, seed: '', log: [] });
    expect(server.runs[0]).toMatchObject({ id: session.gameId, mode: 'ranked', score: runs[0].score });
    // It ended when the server says it did, whatever the clock of the device.
    expect(runs[0].finishedAt).toBe(Date.parse(server.runs[0].finished_at));
    // What the life earned went to the profile, as a casual life's does.
    const profile = await d.store.loadProfile();
    for (const badge of whole.journal.earned) expect(Object.keys(profile.badges)).toContain(badge);
  });

  it('tells each step what happened, and what the life opened for the first time (nothing, for a plain nurse), like any other life', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    let result = await session.answerCard(0);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.view).toBe(session.view());
    expect(result.unlocked).toEqual([]);
    // Finishing a first life opens no other now (the rider is open from the start): the step that ends it says so.
    while (!session.view().finished) result = session.view().phase === 'cards' ? await session.answerCard(0) : await session.playRound({ orders: [] });
    expect(result.unlocked).toEqual([]);
    expect(Object.keys((await d.store.loadProfile()).unlocked)).toEqual([]);
  });

  it('waits on the device with the last view it was given, and is taken up again from the server', async () => {
    const server = rankedServer();
    const first = device(server);
    const session = await first.sessions.start('nurse', { ranked: true });
    await play(session, 2);
    // The page is opened again.
    const again = device(server, first.store);
    const { session: resumed, lost } = await again.sessions.resume();
    expect(lost).toBeNull();
    expect(resumed?.ranked).toBe(true);
    expect(resumed?.gameId).toBe(session.gameId);
    expect(resumed?.view()).toEqual(session.view());
    expect(resumed?.history()).toEqual(session.history());
    await play(resumed as GameSession, 1);
    expect(resumed?.view().round).toBe(3);
  });

  it('can be looked at with no connection, as it was last seen, and a step then says the server could not be reached', async () => {
    const server = rankedServer();
    const first = device(server);
    const session = await first.sessions.start('nurse', { ranked: true });
    await play(session, 1);
    server.state.down = true;
    const { session: resumed } = await device(server, first.store).sessions.resume();
    expect(resumed?.view()).toEqual(session.view());
    await expect((resumed as GameSession).answerCard(0)).rejects.toBeInstanceOf(Unreachable);
    // Nothing was played, and nothing on the device changed.
    expect(resumed?.view()).toEqual(session.view());
    server.state.down = false;
    const result = await (resumed as GameSession).answerCard(0);
    expect(result.view.answered).toBe(1);
  });

  it('takes a step once when its answer is lost on the way and it is asked for again', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    server.state.loseNextAnswer = true;
    await expect(session.answerCard(0)).rejects.toBeInstanceOf(Unreachable);
    expect((server.games.get(session.gameId)?.log as LoggedRound[])[0].picks).toEqual([0]);
    const result = await session.answerCard(0);
    expect(result.view.answered).toBe(1);
    expect((server.games.get(session.gameId)?.log as LoggedRound[])[0].picks).toEqual([0]);
    expect(((await held(d.store)) as RankedGame).step).toBe(1);
  });

  it('finds out that the life has moved on elsewhere, and says so instead of playing over it', async () => {
    const server = rankedServer();
    const phone = device(server);
    const there = await phone.sessions.start('nurse', { ranked: true });
    // Another device takes the same life up, from the server, and plays a card.
    const laptop = device(server);
    await laptop.store.saveGame((await held(phone.store)) as RankedGame);
    const here = (await laptop.sessions.resume()).session as GameSession;
    await here.answerCard(0);
    await expect(there.answerCard(1)).rejects.toBeInstanceOf(StaleSession);
    // Opened again, the phone sees the life as it now stands.
    const { session: again } = await phone.sessions.resume();
    expect(again?.view()).toEqual(here.view());
  });

  it('is refused by the session itself when another tab has put another life on the device', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    await d.sessions.start('nurse', { ranked: false });
    await expect(session.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
  });

  it('is refused when the note on the device is not the one this session wrote, and the server is not asked', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    const note = (await held(d.store)) as RankedGame;
    // The same life, written since by another tab.
    await d.store.saveGame({ ...note, updatedAt: note.updatedAt + 1 });
    await expect(session.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    // Another life, written at the very moment this one was.
    await d.store.saveGame({ ...note, gameId: 'another-life' });
    await expect(session.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    expect(server.state.calls.filter((call) => call === 'card')).toEqual([]);
    // With its own note back, it goes on.
    await d.store.saveGame(note);
    expect((await session.answerCard(0)).view.answered).toBe(1);
  });

  it('is refused in the same way when it was taken up from the note, not started here', async () => {
    const server = rankedServer();
    const d = device(server);
    await d.sessions.start('nurse', { ranked: true });
    const note = (await held(d.store)) as RankedGame;
    const resumed = (await device(server, d.store).sessions.resume()).session as GameSession;
    await d.store.saveGame({ ...note, gameId: 'another-life' });
    await expect(resumed.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    expect(server.state.calls.filter((call) => call === 'card')).toEqual([]);
  });

  it('takes steps asked for at once one after the other, each in its own place', async () => {
    const server = rankedServer();
    const session = await device(server).sessions.start('nurse', { ranked: true });
    expect(session.view().hand.length).toBeGreaterThanOrEqual(2);
    const [first, second] = await Promise.all([session.answerCard(0), session.answerCard(0)]);
    expect([first.view.answered, second.view.answered]).toEqual([1, 2]);
    expect((server.games.get(session.gameId)?.log as LoggedRound[])[0].picks).toEqual([0, 0]);
  });

  it('says the server cannot be reached, not that the life has moved, when nobody is signed in any more', async () => {
    const server = rankedServer();
    const link: { api: RankedApi | null } = { api: server.api };
    const session = await device(link).sessions.start('nurse', { ranked: true });
    link.api = null;
    await expect(session.answerCard(0)).rejects.toBeInstanceOf(Unreachable);
    link.api = server.api;
    expect((await session.answerCard(0)).view.answered).toBe(1);
  });

  it('does not hold a view that is not whole: an answer with a world missing, or with one too many, is not this life', async () => {
    const server = rankedServer();
    // The round turns, and the answer brings no new world.
    const short: RankedApi = { ...server.api, round: async (...asked) => server.api.round(...asked).then((reply) => (reply === 'moved' ? reply : { ...reply, world: null })) };
    const session = await device({ api: short }).sessions.start('nurse', { ranked: true });
    while (session.view().phase === 'cards') await session.answerCard(0);
    const before = session.view();
    await expect(session.playRound({ orders: [] })).rejects.toBeInstanceOf(StaleSession);
    expect(session.view()).toEqual(before);
    // A card is answered, and the answer brings a world as if the round had turned.
    const elsewhere = rankedServer();
    const long: RankedApi = { ...elsewhere.api, card: async (...asked) => elsewhere.api.card(...asked).then((reply) => (reply === 'moved' ? reply : { ...reply, world: before.timeline[0] })) };
    const other = await device({ api: long }).sessions.start('nurse', { ranked: true });
    await expect(other.answerCard(0)).rejects.toBeInstanceOf(StaleSession);
    expect(other.view().answered).toBe(0);
  });

  it('counts a badge of the gallery among the badges of the life that earned it, in the records too', async () => {
    // Nineteen things owned in earlier lives: the twentieth earns the badge. Once in the middle of a life, once with its last round.
    for (const buyAt of [0, content.rounds - 1]) {
      const server = rankedServer();
      const d = device(server);
      const owned = content.items.filter((item) => item.id !== 'watch_casio').slice(0, 19).map((item) => item.id);
      await d.store.saveProfile({ ...(await d.store.loadProfile()), gallery: owned });
      const session = await d.sessions.start('nurse', { ranked: true });
      await play(session, buyAt);
      while (session.view().phase === 'cards') await session.answerCard(0);
      // What the step writes: on the last round, the life's note once, and its record twice (again with the gallery's badge).
      const writes: string[] = [];
      const { saveGame, addRun } = d.store;
      d.store.saveGame = (game) => (writes.push('saveGame'), saveGame(game));
      d.store.addRun = (run) => (writes.push(`addRun ${run.badges.includes('twenty_items') ? 'with' : 'without'} the gallery's badge`), addRun(run));
      const round = await session.playRound({ orders: [{ type: 'buyItem', itemId: 'watch_casio' }] });
      Object.assign(d.store, { saveGame, addRun });
      if (buyAt === content.rounds - 1) expect(writes).toEqual(['addRun without the gallery\'s badge', 'saveGame', 'addRun with the gallery\'s badge']);
      expect(round.earned, `bought in round ${buyAt}`).toContain('twenty_items');
      expect(session.badges()).toContain('twenty_items');
      await play(session);
      expect(session.view().finished).toBe(true);
      const runs = await d.store.listRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0].badges, `bought in round ${buyAt}`).toContain('twenty_items');
      // The server knows nothing of the gallery: the badge is the device's to add.
      expect(server.runs[0].badges).not.toContain('twenty_items');
    }
  });
});

describe('the note a device keeps of a ranked life', () => {
  const note = { format: 1, ranked: true, gameId: 'g-1', lifeId: 'nurse', engineVersion: '0.10.0', contentVersion: '1.9.0', step: 4, view: { round: 1, timeline: [{}, {}], player: {} }, journal: { earned: [] }, history: [100, 250], bankruptcies: 1, updatedAt: 9 };

  it('is read back as it was written', () => {
    expect(rankedOf(structuredClone(note))).toEqual(note);
  });

  it('is not one when it is anything else: a casual save, another format, a note with no life to name', () => {
    for (const raw of [null, 'a note', [note], { ...note, ranked: false }, { ...note, ranked: undefined }, { ...note, format: 99 }, { ...note, gameId: 7 }, { ...note, lifeId: undefined }, { ...note, engineVersion: null }, { ...note, contentVersion: 19 }]) {
      expect(rankedOf(raw), JSON.stringify(raw)).toBeNull();
    }
  });

  it('holds a view seen whole, or none at all: half a view is not one', () => {
    for (const half of [{ journal: null }, { view: null }, { view: { round: 1, player: {} } }, { view: { round: 1, timeline: [{}, {}] } }, { view: 'seen' }, { journal: 'kept' }]) {
      const read = rankedOf({ ...note, ...half });
      expect(read, JSON.stringify(half)).toMatchObject({ gameId: 'g-1', step: 4, view: null, journal: null });
    }
  });

  it('reads nonsense in its numbers as nothing', () => {
    expect(rankedOf({ ...note, step: -1, history: [1, 'two', Number.NaN, 3], bankruptcies: 1.5, updatedAt: 'now' })).toMatchObject({ step: 0, history: [1, 3], bankruptcies: 0, updatedAt: 0 });
    expect(rankedOf({ ...note, step: 2.5, history: 'none', bankruptcies: -1, updatedAt: Number.POSITIVE_INFINITY })).toMatchObject({ step: 0, history: [], bankruptcies: 0, updatedAt: 0 });
  });
});

describe('choosing between a ranked life and a casual one', { timeout: 120_000 }, () => {
  it('starts a casual life when a ranked one was not asked for, or cannot be had', async () => {
    const server = rankedServer();
    const asked = await device(server).sessions.start('nurse', { ranked: false });
    expect(asked.ranked).toBe(false);
    expect(server.state.calls).toEqual([]);
    // No account: there is nobody to ask.
    expect((await device(null).sessions.start('nurse', { ranked: true })).ranked).toBe(false);
    // And by default a life is casual: whoever wants a ranked one says so.
    expect((await device(server).sessions.start('nurse')).ranked).toBe(false);
  });

  it('falls back to a casual life when the server cannot be reached, so that a life always begins', async () => {
    const server = rankedServer();
    server.state.down = true;
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    expect(session.ranked).toBe(false);
    expect(((await held(d.store)) as SavedGame).seed).toBe('seed-1');
    await play(session, 1);
    expect(session.view().round).toBe(1);
  });

  it('begins no casual life in place of a ranked one the server refused for good', async () => {
    const server = rankedServer();
    const refusing: RankedApi = {
      ...server.api,
      start: async () => {
        throw new Error('the server refused to start a ranked life: bad-request');
      },
    };
    const d = device({ api: refusing });
    await expect(d.sessions.start('nurse', { ranked: true })).rejects.toThrow('the server refused to start a ranked life');
    expect(await held(d.store)).toBeNull();
  });

  it('refuses a locked life before it asks anyone', async () => {
    const server = rankedServer();
    await expect(device(server).sessions.start(locked.id, { ranked: true })).rejects.toThrow(`locked life: ${locked.id}`);
    expect(server.state.calls).toEqual([]);
  });

  it('gives up on the server the ranked life that a new life replaces, and the one the player abandons', async () => {
    const server = rankedServer();
    const d = device(server);
    const first = await d.sessions.start('nurse', { ranked: true });
    const second = await d.sessions.start('nurse', { ranked: false });
    expect(server.games.get(first.gameId)?.status).toBe('abandoned');
    expect(second.ranked).toBe(false);
    const third = await d.sessions.start('nurse', { ranked: true });
    await d.sessions.abandon();
    expect(server.games.get(third.gameId)?.status).toBe('abandoned');
    expect(await held(d.store)).toBeNull();
    expect(await d.sessions.resume()).toEqual({ session: null, lost: null });
  });

  it('does not ask the server to give up a ranked life that is already over', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    await play(session);
    server.state.calls.length = 0;
    await d.sessions.start('nurse', { ranked: false });
    expect(server.state.calls).toEqual([]);
    expect(server.games.get(session.gameId)?.status).toBe('finished');
  });

  it('does not take a failure of its own for a server that is away', async () => {
    const server = rankedServer();
    const first = device(server);
    const session = await first.sessions.start('nurse', { ranked: true });
    await play(session, 1);
    const broken: RankedApi = {
      ...server.api,
      view: async () => {
        throw new Error('not an answer anyone expected');
      },
    };
    // Shown as it was last seen, this would hide the fault for ever: it is reported.
    await expect(device({ api: broken }, first.store).sessions.resume()).rejects.toThrow('not an answer anyone expected');
  });

  it('lets go of a ranked life that was given up elsewhere', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    (server.games.get(session.gameId) as { status: string }).status = 'abandoned';
    expect(await device(server, d.store).sessions.resume()).toEqual({ session: null, lost: null });
    expect(await held(d.store)).toBeNull();
  });

  it('goes on with a ranked life begun under older rules than this build plays: the server plays it under the rules it began with', async () => {
    for (const newer of [{ engine: '99.0.0', content: CONTENT_VERSION }, { engine: ENGINE_VERSION, content: '99.0.0' }]) {
      const server = rankedServer();
      const d = device(server);
      const session = await d.sessions.start('nurse', { ranked: true });
      const opened = await device(server, d.store, newer).sessions.resume();
      expect(opened.lost).toBeNull();
      expect(opened.session?.gameId).toBe(session.gameId);
      // And it plays on, on the server.
      await opened.session?.answerCard(0);
      expect(server.games.get(session.gameId)?.status).toBe('playing');
      expect(opened.session?.view().answered).toBe(1);
    }
  });

  it('leaves alone a ranked life begun under newer rules than this page plays: the newer page can go on with it', async () => {
    // A tab left open on yesterday's build meets the note today's build wrote.
    for (const older of [{ engine: '0.0.1', content: CONTENT_VERSION }, { engine: ENGINE_VERSION, content: '0.0.1' }]) {
      const server = rankedServer();
      const d = device(server);
      const session = await d.sessions.start('nurse', { ranked: true });
      const note = await held(d.store);
      server.state.calls.length = 0;
      expect(await device(server, d.store, older).sessions.resume()).toEqual({ session: null, lost: 'newer' });
      expect(await held(d.store)).toEqual(note);
      expect(server.games.get(session.gameId)?.status).toBe('playing');
      expect(server.state.calls).toEqual([]);
    }
  });

  it('asks before it ends a ranked life in progress on another device, and ends the one this device is living unasked', async () => {
    const server = rankedServer();
    const phone = device(server);
    const there = await phone.sessions.start('nurse', { ranked: true });
    await play(there, 2);
    // The desk knows nothing of that life: it may not end it by starting another.
    const desk = device(server);
    const asked = desk.sessions.start('nurse', { ranked: true });
    await expect(asked).rejects.toBeInstanceOf(RankedInProgress);
    await expect(asked).rejects.toMatchObject({ life: { gameId: there.gameId, lifeId: 'nurse', round: 2, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION } });
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    expect(await held(desk.store)).toBeNull();
    // Told that it may, it does.
    const here = await desk.sessions.start('nurse', { ranked: true, replace: there.gameId });
    expect(here.ranked).toBe(true);
    expect(server.games.get(there.gameId)?.status).toBe('abandoned');
    // The life this very device is living is the one the player was asked about on the way here: it gives way with no second question.
    const next = await desk.sessions.start('nurse', { ranked: true });
    expect(server.games.get(here.gameId)?.status).toBe('abandoned');
    expect(server.games.get(next.gameId)?.status).toBe('playing');
  });

  it('does not end unasked a ranked life this device has only a note of and has never shown', async () => {
    const server = rankedServer();
    const there = await device(server).sessions.start('nurse', { ranked: true });
    // The account left the note here, and nobody has opened it yet.
    const desk = device(server);
    await desk.store.saveGame({ format: 1, ranked: true, gameId: there.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 0, view: null, history: [], bankruptcies: 0, journal: null, updatedAt: 0 });
    await expect(desk.sessions.start('nurse', { ranked: true })).rejects.toBeInstanceOf(RankedInProgress);
    expect(server.games.get(there.gameId)?.status).toBe('playing');
    // Nor does a casual life begun over the note end it: the life is still there to be taken up elsewhere.
    const casual = await desk.sessions.start('nurse', { ranked: false });
    expect(casual.ranked).toBe(false);
    expect(server.games.get(there.gameId)?.status).toBe('playing');
  });

  it('leaves the ranked life in progress as it is when the new one cannot be started at all', async () => {
    const server = rankedServer();
    const first = device(server);
    const living = await first.sessions.start('nurse', { ranked: true });
    const refusing: RankedApi = {
      ...server.api,
      start: async () => {
        throw new Error('the server refused to start a ranked life: bad-request');
      },
    };
    const d = device({ api: refusing }, first.store);
    await expect(d.sessions.start('nurse', { ranked: true })).rejects.toThrow('the server refused to start a ranked life');
    expect(server.games.get(living.gameId)?.status).toBe('playing');
    expect(((await held(d.store)) as RankedGame).gameId).toBe(living.gameId);
  });

  it('begins a casual life when the account has not heard yet that the life is unlocked', async () => {
    const server = rankedServer();
    const d = device(server);
    // Unlocked on the device a moment ago. The account still says it is locked.
    await d.store.saveProfile({ ...(await d.store.loadProfile()), unlocked: { [locked.id]: { at: 1, gameId: 'earlier' } } });
    const session = await d.sessions.start(locked.id, { ranked: true });
    expect(session.ranked).toBe(false);
    expect(session.lifeId).toBe(locked.id);
    expect(server.games.size).toBe(0);
  });

  it('opens a casual life exactly as before', async () => {
    const d = device(rankedServer());
    const session = await d.sessions.start('nurse', { ranked: false });
    await play(session, 1);
    const { session: resumed } = await device(null, d.store).sessions.resume();
    expect(resumed?.ranked).toBe(false);
    expect(resumed?.view()).toEqual(session.view());
  });

  it('takes up a ranked life the account brought to a device that has not seen it yet', async () => {
    // The mirror leaves a note of the life, with no view: it is fetched when the life is opened.
    const server = rankedServer();
    const phone = device(server);
    const there = await phone.sessions.start('nurse', { ranked: true });
    await play(there, 1);
    const laptop = device(server);
    await laptop.store.saveGame({ format: 1, ranked: true, gameId: there.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 0, view: null, history: [], bankruptcies: 0, journal: null, updatedAt: 0 });
    const { session } = await laptop.sessions.resume();
    expect(session?.view()).toEqual(there.view());
    expect(((await held(laptop.store)) as RankedGame).view).toEqual(there.view());
    // A life not yet begun is kept as it was shown, like any other: with no connection it is there to look at.
    const begun = rankedServer();
    const started = await device(begun).sessions.start('nurse', { ranked: true });
    const desk = device(begun);
    await desk.store.saveGame({ format: 1, ranked: true, gameId: started.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 0, view: null, history: [], bankruptcies: 0, journal: null, updatedAt: 0 });
    expect((await desk.sessions.resume()).session?.view()).toEqual(started.view());
    expect(((await held(desk.store)) as RankedGame).view).toEqual(started.view());
    begun.state.down = true;
    expect((await device(begun, desk.store).sessions.resume()).session?.view()).toEqual(started.view());
    // With no connection there is nothing to show of it yet: the note waits.
    const tablet = device(server);
    await tablet.store.saveGame({ format: 1, ranked: true, gameId: there.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 0, view: null, history: [], bankruptcies: 0, journal: null, updatedAt: 0 });
    server.state.down = true;
    expect(await tablet.sessions.resume()).toEqual({ session: null, lost: null });
    expect(await held(tablet.store)).not.toBeNull();
  });
});

describe('the weekly challenge, on a device', { timeout: 120_000 }, () => {
  // The server of the tests keeps the time of Tuesday 13 October 2026: the week of 12 October.
  const WEEK = '2026-W42';
  const week = challengeOf(WEEK, lives);
  if (!week) throw new Error('no challenge for the week');
  const life = lives.find((one) => one.id === week.lifeId)!;
  const start = challengeStart(week, life);

  it('plays the attempt on the server, under the week’s rule, whatever lives the device has unlocked, and keeps its week in the records', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start(week.lifeId, { ranked: true, challenge: WEEK });
    expect(session.ranked).toBe(true);
    expect(session.challenge).toBe(WEEK);
    expect(session.view().limits).toEqual(start.limits ?? {});
    expect(((await held(d.store)) as RankedGame).challenge).toBe(WEEK);
    expect(server.games.get(session.gameId)?.challenge).toBe(WEEK);
    await play(session);
    expect((await d.store.listRuns())[0]).toMatchObject({ ranked: true, challenge: WEEK });
  });

  it('plays a practice on the device, under the same rule, and opens it again under it', async () => {
    const d = device(null);
    const session = await d.sessions.start(week.lifeId, { challenge: WEEK });
    expect(session.ranked).not.toBe(true);
    expect(session.challenge).toBe(WEEK);
    expect(session.view().limits).toEqual(start.limits ?? {});
    await play(session, 2);
    const saved = (await held(d.store)) as SavedGame;
    expect(saved.challenge).toBe(WEEK);
    // A save whose state is lost is played again from its log, under the week's rule.
    const damaged: Partial<SavedGame> = structuredClone(saved);
    delete damaged.state;
    await d.store.saveGame(damaged as SavedGame);
    const again = (await d.sessions.resume()).session;
    expect(again?.challenge).toBe(WEEK);
    expect(again?.view()).toEqual(session.view());
    await play(again as GameSession);
    expect((await d.store.listRuns())[0]).toMatchObject({ challenge: WEEK });
    expect((await d.store.listRuns())[0].ranked).toBeUndefined();
  });

  it('becomes a practice when the week’s attempt has been had, and starts no other life as the week’s', async () => {
    const server = rankedServer();
    const d = device(server);
    const first = await d.sessions.start(week.lifeId, { ranked: true, challenge: WEEK });
    await d.sessions.abandon();
    expect(server.games.get(first.gameId)?.status).toBe('abandoned');
    const second = await d.sessions.start(week.lifeId, { ranked: true, challenge: WEEK });
    expect(second.ranked).not.toBe(true);
    expect(second.challenge).toBe(WEEK);
    const other = lives.find((one) => one.id !== week.lifeId)!;
    await expect(d.sessions.start(other.id, { challenge: WEEK })).rejects.toThrow(/not the life of the challenge/);
  });
});

describe('a friend passed: the notice the server sends as a ranked life ends', { timeout: 120_000 }, () => {
  const ANA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const BEA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const STRANGER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  /** A ranked run the server wrote before, of another life: only its player, score and moment count here. */
  const runOf = (user: string, score: number, finishedAt = '2026-10-13T08:00:00.000Z') => {
    const id = `ffffffff-ffff-4fff-8fff-${user.slice(0, 12)}`;
    return {
      id,
      user_id: user,
      game_id: id,
      mode: 'ranked' as const,
      life_id: 'nurse',
      engine_version: ENGINE_VERSION,
      content_version: CONTENT_VERSION,
      score,
      net_worth: 0,
      status: 0,
      escaped_at_round: null,
      bankruptcies: 0,
      badges: [],
      cities: [],
      history: [],
      verified: true as const,
      finished_at: finishedAt,
      challenge: null,
    };
  };
  const LOW = -1e12;
  const HIGH = 1e12;
  async function finishLife(server: ReturnType<typeof rankedServer>) {
    const session = await device(server).sessions.start('nurse', { ranked: true });
    await play(session);
    expect(session.view().finished).toBe(true);
    const run = server.runs.find((one) => one.id === session.gameId);
    if (!run) throw new Error('no run written');
    return run;
  }

  it('tells a friend the life passed, once, by the player\'s name and both scores, and nobody else', async () => {
    const server = rankedServer();
    server.names.set(server.user, 'Ana');
    server.befriend(server.user, ANA);
    server.befriend(server.user, BEA);
    server.runs.push(runOf(ANA, LOW), runOf(BEA, HIGH), runOf(STRANGER, LOW));
    const run = await finishLife(server);
    expect(server.notices).toEqual([{ user: ANA, about: { kind: 'overtaken', who: 'Ana', score: run.score, theirs: LOW } }]);
    // The finished life looked at again writes nothing, and tells nobody again.
    await server.call({ action: 'view', gameId: run.id });
    expect(server.notices).toHaveLength(1);
  });

  it('does not tell a friend twice in a day', async () => {
    const server = rankedServer();
    server.befriend(server.user, ANA);
    server.runs.push(runOf(ANA, LOW));
    server.overtakenDays.set(ANA, '2026-10-13');
    await finishLife(server);
    expect(server.notices).toEqual([]);
  });

  it('tells nobody of a life lower than the player\'s best of the week, nor of a friend with no ranked life this week', async () => {
    const server = rankedServer();
    server.befriend(server.user, ANA);
    server.runs.push(runOf(server.user, HIGH), runOf(ANA, LOW));
    await finishLife(server);
    expect(server.notices).toEqual([]);
    const again = rankedServer();
    again.befriend(again.user, BEA);
    again.runs.push(runOf(BEA, LOW, '2026-10-09T08:00:00.000Z'));
    await finishLife(again);
    expect(again.notices).toEqual([]);
  });

  it('tells no player who is not a friend', async () => {
    const server = rankedServer();
    server.runs.push(runOf(STRANGER, LOW));
    await finishLife(server);
    expect(server.notices).toEqual([]);
  });
});
