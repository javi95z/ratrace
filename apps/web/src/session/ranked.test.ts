import { content, CONTENT_VERSION, lives, replayLife } from '@ratrace/content';
import { ENGINE_VERSION, finalScore, viewOf } from '@ratrace/engine';
import type { LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { rankedServer } from '@/testing/rankedServer';
import { StaleSession, Unreachable } from './errors';
import { LocalSessions } from './local';
import { MemoryStore } from './memory';
import { RankedSessions } from './ranked';
import type { RankedApi } from './ranked';
import { GameSessions } from './sessions';
import type { GameSession, RankedGame, SavedGame } from './types';

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };
const nurse = lives.find((life) => life.id === 'nurse');
const locked = lives.find((life) => life.unlock !== 'default');
if (!nurse || !locked) throw new Error('the content has no nurse, or no locked life');

/** A device: its store, and the sessions the game uses, over a server of ranked lives the test holds. */
function device(server: ReturnType<typeof rankedServer> | null, store = new MemoryStore(), versions = VERSIONS) {
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
    // What the life earned went to the profile, as a casual life's does.
    const profile = await d.store.loadProfile();
    for (const badge of whole.journal.earned) expect(Object.keys(profile.badges)).toContain(badge);
  });

  it('tells each step what happened, and what it earned for the first time, like any other life', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    const result = await session.answerCard(0);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.view).toBe(session.view());
    expect(result).toHaveProperty('earned');
    expect(result).toHaveProperty('unlocked');
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

  it('lets go of a ranked life that was given up elsewhere', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    (server.games.get(session.gameId) as { status: string }).status = 'abandoned';
    expect(await device(server, d.store).sessions.resume()).toEqual({ session: null, lost: null });
    expect(await held(d.store)).toBeNull();
  });

  it('cannot continue a ranked life begun under other rules than this build plays: it says so, and gives it up', async () => {
    const server = rankedServer();
    const d = device(server);
    const session = await d.sessions.start('nurse', { ranked: true });
    const newer = device(server, d.store, { engine: '99.0.0', content: CONTENT_VERSION });
    expect(await newer.sessions.resume()).toEqual({ session: null, lost: 'outdated' });
    expect(await held(d.store)).toBeNull();
    expect(server.games.get(session.gameId)?.status).toBe('abandoned');
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
    // With no connection there is nothing to show of it yet: the note waits.
    const tablet = device(server);
    await tablet.store.saveGame({ format: 1, ranked: true, gameId: there.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 0, view: null, history: [], bankruptcies: 0, journal: null, updatedAt: 0 });
    server.state.down = true;
    expect(await tablet.sessions.resume()).toEqual({ session: null, lost: null });
    expect(await held(tablet.store)).not.toBeNull();
  });
});
