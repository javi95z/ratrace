import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION, stateHash } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import type { GameSession, PlayerStore, SavedGame } from '@/session/types';
import type { CloudGame, Progress } from './merge';
import { MirroredStore } from './mirror';
import type { CloudRun, GameUpload, SyncCloud } from './mirror';

/** An account in the cloud, kept in memory: what it holds, what it was asked, and a switch to make it fail. */
function fakeCloud() {
  const state = { games: [] as CloudGame[], progress: null as Progress | null, runs: [] as CloudRun[], asked: [] as string[], down: false, clock: 0 };
  const guard = () => {
    if (state.down) throw new Error('no network');
  };
  const cloud: SyncCloud = {
    async playingGames() {
      guard();
      return state.games.filter((game) => game.status === 'playing').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async pushGame(upload: GameUpload) {
      guard();
      state.asked.push(`push ${upload.id}`);
      const row = state.games.find((game) => game.id === upload.id);
      if (row && row.status !== 'playing') return 'closed';
      const next: CloudGame = { ...upload, status: 'playing', updatedAt: `2026-10-13T10:00:${String((state.clock += 1)).padStart(2, '0')}Z` };
      if (row) Object.assign(row, next);
      else state.games.push(next);
      return 'saved';
    },
    async abandonGame(id) {
      guard();
      state.asked.push(`abandon ${id}`);
      const row = state.games.find((game) => game.id === id);
      if (row && row.status === 'playing') row.status = 'abandoned';
    },
    async loadProgress() {
      guard();
      return state.progress;
    },
    async saveProgress(progress) {
      guard();
      state.asked.push('progress');
      state.progress = progress;
    },
    async listRuns() {
      guard();
      return state.runs;
    },
    async finishRun(gameId) {
      guard();
      state.asked.push(`finish ${gameId}`);
      const row = state.games.find((game) => game.id === gameId);
      if (!row) return 'refused';
      row.status = 'finished';
      if (!state.runs.some((run) => run.id === gameId)) {
        state.runs.push({ id: gameId, lifeId: row.lifeId, engineVersion: row.engineVersion, contentVersion: row.contentVersion, score: 123, netWorth: 456, status: 7, escapedAtRound: null, bankruptcies: 0, badges: ['first_100k'], cities: ['madrid'], history: [1, 2], finishedAt: '2026-10-13T12:00:00Z' });
      }
      return 'done';
    },
  };
  return { cloud, state };
}

/** A device: its own store, mirrored to `cloud`, and sessions that play on it. Nothing syncs until the test says so. */
function device(cloud: SyncCloud | null, name = 'a') {
  const store = new MemoryStore();
  const scheduled: Array<() => void> = [];
  const mirror = new MirroredStore(store, () => cloud, { content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION }, schedule: (run) => scheduled.push(run) });
  let ids = 0;
  let clock = 1_000;
  const sessions = new LocalSessions(mirror, content, lives, { newId: () => `${name}-${(ids += 1)}`, newSeed: () => `seed-${name}-${ids}`, now: () => (clock += 1) });
  return { store, mirror, sessions, scheduled };
}
async function play(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds && !session.view().finished; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}
const saved = async (store: PlayerStore) => (await store.loadGame()) as SavedGame | null;

describe('a store with no account behind it', () => {
  it('is the device and nothing else', async () => {
    const d = device(null);
    const session = await d.sessions.start('nurse');
    await play(session, 1);
    expect((await saved(d.store))?.state.round).toBe(1);
    expect(d.mirror.status()).toBe('off');
    await d.mirror.sync();
    expect(d.mirror.status()).toBe('off');
    expect(d.mirror.offer()).toBeNull();
  });
});

describe('the mirror', { timeout: 60_000 }, () => {
  it('sends the life in progress to the account, as the device has it', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    const session = await d.sessions.start('nurse');
    await play(session, 2);
    expect(d.mirror.status()).toBe('pending');
    await d.mirror.sync();
    const mine = (await saved(d.store)) as SavedGame;
    expect(state.games).toHaveLength(1);
    expect(state.games[0]).toMatchObject({ id: mine.gameId, lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, seed: mine.seed, round: 2, status: 'playing', stateHash: stateHash(mine.state) });
    expect(state.games[0].log).toEqual(mine.log);
    expect(d.mirror.status()).toBe('saved');
  });

  it('asks to sync after every write, and one sync sends the latest of a burst of them', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    const session = await d.sessions.start('nurse');
    await play(session, 3);
    // Many saves, many requests to sync; nothing has gone up yet.
    expect(d.scheduled.length).toBeGreaterThan(3);
    expect(state.asked).toEqual([]);
    for (const run of d.scheduled.splice(0)) run();
    await d.mirror.sync();
    expect(state.asked.filter((line) => line.startsWith('push'))).toHaveLength(1);
    expect(state.games[0].round).toBe(3);
  });

  it('changes nothing on the device when the account cannot be reached, and catches up later', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    state.down = true;
    const session = await d.sessions.start('nurse');
    await play(session, 2);
    await expect(d.mirror.sync()).resolves.toBeUndefined();
    expect((await saved(d.store))?.state.round).toBe(2);
    expect(d.mirror.status()).toBe('pending');
    expect(state.games).toEqual([]);
    state.down = false;
    await d.mirror.sync();
    expect(state.games[0].round).toBe(2);
    expect(d.mirror.status()).toBe('saved');
  });

  it('gives a new device the life in progress, rebuilt by playing its log again', async () => {
    const { cloud } = fakeCloud();
    const first = device(cloud, 'first');
    const session = await first.sessions.start('nurse');
    await play(session, 3);
    while (session.view().phase === 'cards' && session.view().answered < 1) await session.answerCard(0);
    await first.mirror.sync();
    const origin = (await saved(first.store)) as SavedGame;

    const second = device(cloud, 'second');
    const heard: string[] = [];
    second.mirror.onDeviceChanged((what) => heard.push(what));
    await second.mirror.sync();
    const taken = (await saved(second.store)) as SavedGame;
    expect(taken.gameId).toBe(origin.gameId);
    expect(stateHash(taken.state)).toBe(stateHash(origin.state));
    expect(taken.history).toEqual(origin.history);
    expect(heard).toContain('game');
    // And it can be played on from there.
    const { session: resumed } = await second.sessions.resume();
    expect(resumed?.view().round).toBe(3);
  });

  it('of two copies of the same life keeps the one with more of it played, on both sides', async () => {
    const { cloud, state } = fakeCloud();
    const first = device(cloud, 'first');
    const session = await first.sessions.start('nurse');
    await play(session, 1);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await second.mirror.sync();
    const { session: there } = await second.sessions.resume();
    await play(there as GameSession, 3);
    await second.mirror.sync();
    expect(state.games[0].round).toBe(4);
    // The first device is behind: it takes the account's copy.
    await first.mirror.sync();
    expect((await saved(first.store))?.state.round).toBe(4);
    // And being ahead, it sends its own.
    const { session: back } = await first.sessions.resume();
    await play(back as GameSession, 1);
    await first.mirror.sync();
    expect(state.games[0].round).toBe(5);
    expect(state.games).toHaveLength(1);
  });

  it('never replaces a different life behind the player\'s back: it offers the account\'s, and takes it only when told', async () => {
    const { cloud, state } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 4);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await play(await second.sessions.start('engineer'), 1);
    await second.mirror.sync();
    const mine = (await saved(second.store)) as SavedGame;
    expect(mine.lifeId).toBe('engineer');
    expect(second.mirror.offer()).toMatchObject({ lifeId: 'nurse', round: 4 });
    // Both lives are in the account: neither device has lost anything.
    expect(state.games.filter((game) => game.status === 'playing')).toHaveLength(2);

    expect(await second.mirror.takeOffer()).toBe(true);
    expect(((await saved(second.store)) as SavedGame).lifeId).toBe('nurse');
    expect(second.mirror.offer()).toBeNull();
    await second.mirror.sync();
    // The life it gave up is abandoned in the account, as a life given up for a new one is.
    expect(state.games.find((game) => game.id === mine.gameId)?.status).toBe('abandoned');
    expect(second.mirror.offer()).toBeNull();
  });

  it('abandons in the account a life that was given up for a new one', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 2);
    await d.mirror.sync();
    const old = ((await saved(d.store)) as SavedGame).gameId;
    await play(await d.sessions.start('engineer'), 1);
    await d.mirror.sync();
    expect(state.games.find((game) => game.id === old)?.status).toBe('abandoned');
    expect(state.games.filter((game) => game.status === 'playing').map((game) => game.lifeId)).toEqual(['engineer']);
  });

  it('joins what is unlocked on both sides, and leaves the device\'s settings alone', async () => {
    const { cloud, state } = fakeCloud();
    state.progress = { badges: { millionaire: { at: 5, gameId: 'elsewhere' } }, gallery: ['watch_rolex'], unlocked: { heir: { at: 5, gameId: 'elsewhere' } }, guide: { seen: ['news'], off: false } };
    const d = device(cloud);
    const profile = await d.store.loadProfile();
    await d.store.saveProfile({ ...profile, settings: { reducedMotion: true }, badges: { first_100k: { at: 9, gameId: 'here' } }, gallery: ['watch_casio'] });
    const heard: string[] = [];
    d.mirror.onDeviceChanged((what) => heard.push(what));
    await d.mirror.sync();
    const after = await d.store.loadProfile();
    expect(Object.keys(after.badges).sort()).toEqual(['first_100k', 'millionaire']);
    expect(after.gallery).toEqual(['watch_casio', 'watch_rolex']);
    expect(Object.keys(after.unlocked)).toEqual(['heir']);
    expect(after.settings).toEqual({ reducedMotion: true });
    expect(heard).toContain('profile');
    expect(Object.keys(state.progress?.badges ?? {}).sort()).toEqual(['first_100k', 'millionaire']);
    // Nothing more to say: a second sync writes nothing.
    state.asked.length = 0;
    await d.mirror.sync();
    expect(state.asked).not.toContain('progress');
  });

  it('sends up what is unlocked when the device writes its profile', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await d.mirror.saveProfile({ ...(await d.mirror.loadProfile()), gallery: ['watch_casio'] });
    expect(d.scheduled.length).toBeGreaterThan(0);
    await d.mirror.sync();
    expect(state.progress?.gallery).toEqual(['watch_casio']);
  });

  it('has the server finish a life that has ended, once, after sending it the whole game', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), content.rounds);
    await d.mirror.sync();
    const id = ((await saved(d.store)) as SavedGame).gameId;
    expect(state.asked.filter((line) => line.endsWith(id))).toEqual([`push ${id}`, `finish ${id}`]);
    expect(state.runs.map((run) => run.id)).toEqual([id]);
    // The life is closed in the account. It is not sent or finished again.
    state.asked.length = 0;
    await d.mirror.sync();
    expect(state.asked.filter((line) => line.startsWith('push') || line.startsWith('finish'))).toEqual([]);
    // The device keeps its own record of the life it lived: one run, not two.
    expect(await d.store.listRuns()).toHaveLength(1);
    expect(d.mirror.status()).toBe('saved');
  });

  it('brings lives finished elsewhere to this device, each once', async () => {
    const { cloud, state } = fakeCloud();
    state.runs.push({ id: 'lived-elsewhere', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, score: 400, netWorth: 9_000_000, status: 30, escapedAtRound: 12, bankruptcies: 1, badges: ['escaped'], cities: ['madrid', 'dubai'], history: [1, 2, 3], finishedAt: '2026-10-01T08:00:00Z' });
    const d = device(cloud);
    const heard: string[] = [];
    d.mirror.onDeviceChanged((what) => heard.push(what));
    await d.mirror.sync();
    await d.mirror.sync();
    const runs = await d.store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ runId: 'lived-elsewhere', lifeId: 'engineer', score: 400, netWorth: 9_000_000, status: 30, escapedAtRound: 12, bankruptcies: 1, badges: ['escaped'], cities: ['madrid', 'dubai'], history: [1, 2, 3], finishedAt: Date.parse('2026-10-01T08:00:00Z') });
    expect(heard.filter((what) => what === 'runs')).toHaveLength(1);
  });

  it('sends up lives finished before there was an account, a few at a time', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    for (let i = 0; i < 3; i++) await play(await d.sessions.start('nurse'), content.rounds);
    expect(await d.store.listRuns()).toHaveLength(3);
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: { engine: ENGINE_VERSION, content: CONTENT_VERSION }, schedule: () => {}, finishPerSync: 2 });
    await late.sync();
    expect(state.runs).toHaveLength(2);
    expect(late.status()).toBe('pending');
    await late.sync();
    expect(state.runs).toHaveLength(3);
    expect(late.status()).toBe('saved');
  });

  it('runs one sync at a time, and a second one asked for meanwhile follows it', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 1);
    await Promise.all([d.mirror.sync(), d.mirror.sync(), d.mirror.sync()]);
    expect(state.games).toHaveLength(1);
    expect(state.asked.filter((line) => line.startsWith('push')).length).toBeLessThanOrEqual(2);
  });
});
