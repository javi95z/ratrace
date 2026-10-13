import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION, stateHash } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { LocalSessions } from '@/session/local';
import { MemoryStore } from '@/session/memory';
import type { GameSession, PlayerStore, SavedGame } from '@/session/types';
import type { CloudGame, Progress } from './merge';
import { MirroredStore } from './mirror';
import type { CloudRun, GameUpload, SyncCloud } from './mirror';

/** An account in the cloud, kept in memory: what it holds, what it was asked, and switches to make it fail. */
function fakeCloud() {
  const state = { games: [] as CloudGame[], progress: null as Progress | null, runs: [] as CloudRun[], asked: [] as string[], down: false, clock: 0, refuses: new Set<string>(), finishFails: false };
  const guard = (what?: string) => {
    if (state.down) throw new Error('no network');
    if (what) state.asked.push(what);
  };
  const cloud: SyncCloud = {
    async playingGames() {
      guard('read games');
      return state.games.filter((game) => game.status === 'playing').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async pushGame(upload: GameUpload) {
      guard(`push ${upload.id}`);
      const row = state.games.find((game) => game.id === upload.id);
      // A life the server has finished is closed. One that was given up is taken up again by whoever still plays it.
      if (row && row.status === 'finished') return 'closed';
      const next: CloudGame = { ...upload, status: 'playing', updatedAt: `2026-10-13T10:00:${String((state.clock += 1)).padStart(2, '0')}Z` };
      if (row) Object.assign(row, next);
      else state.games.push(next);
      return 'saved';
    },
    async abandonGame(id) {
      guard(`abandon ${id}`);
      const row = state.games.find((game) => game.id === id);
      if (row && row.status === 'playing') row.status = 'abandoned';
    },
    async loadProgress() {
      guard('read progress');
      return state.progress;
    },
    async saveProgress(progress) {
      guard('progress');
      state.progress = progress;
    },
    async listRuns() {
      guard('read runs');
      return [...state.runs];
    },
    async finishRun(gameId) {
      guard(`finish ${gameId}`);
      if (state.finishFails) return 'failed';
      const row = state.games.find((game) => game.id === gameId);
      if (!row || state.refuses.has(gameId)) return 'refused';
      row.status = 'finished';
      if (!state.runs.some((run) => run.id === gameId)) {
        state.runs.push({ id: gameId, lifeId: row.lifeId, engineVersion: row.engineVersion, contentVersion: row.contentVersion, score: 123, netWorth: 456, status: 7, escapedAtRound: null, bankruptcies: 0, badges: ['first_100k'], cities: ['madrid'], history: [1, 2], finishedAt: '2026-10-13T12:00:00Z' });
      }
      return 'done';
    },
  };
  return { cloud, state };
}
const reads = (asked: string[]) => asked.filter((line) => line.startsWith('read'));
const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };

/** A device: its own store, mirrored to `cloud`, and sessions that play on it. Nothing is sent until the test says so. */
function device(cloud: SyncCloud | null, name = 'a', over: { store?: MemoryStore; notes?: string[][] } = {}) {
  const store = over.store ?? new MemoryStore();
  const scheduled: Array<{ run: () => Promise<void>; ms: number }> = [];
  // What a page keeps between two openings of it: here, a list a test can hand to the next "page".
  const notes = over.notes ?? [[]];
  const mirror = new MirroredStore(store, () => cloud, {
    content,
    lives,
    versions: VERSIONS,
    schedule: (run, ms) => scheduled.push({ run, ms }),
    remember: { read: () => notes[0], write: (ids) => (notes[0] = ids) },
  });
  let ids = 0;
  let clock = 1_000;
  const sessions = new LocalSessions(mirror, content, lives, { newId: () => `${name}-${(ids += 1)}`, newSeed: () => `seed-${name}-${ids}`, now: () => (clock += 1) });
  /** Runs everything the mirror asked to do "a little later". */
  const later = async () => {
    for (const { run } of scheduled.splice(0)) await run();
  };
  return { store, mirror, sessions, scheduled, later, notes };
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
    expect(d.mirror.status()).toBe('sending');
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
    await d.later();
    expect(state.asked.filter((line) => line.startsWith('push'))).toHaveLength(1);
    expect(state.games[0].round).toBe(3);
  });

  it('reads the account when it meets it, and after that only sends: a card answered costs one request', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    const session = await d.sessions.start('nurse');
    await play(session, 1);
    await d.mirror.sync();
    expect(reads(state.asked)).toEqual(['read runs', 'read games', 'read progress']);
    state.asked.length = 0;
    d.scheduled.length = 0;
    await session.answerCard(0);
    await d.later();
    expect(state.asked).toEqual([`push ${session.gameId}`]);
    expect(d.mirror.status()).toBe('saved');
    // Asked to sync, it reads the account again: that is how a life from another device is found.
    state.asked.length = 0;
    await d.mirror.sync();
    expect(reads(state.asked)).toHaveLength(3);
  });

  it('still reads the account when a write asks to be sent while a reading is about to begin', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    const session = await d.sessions.start('nurse');
    await d.mirror.sync();
    state.asked.length = 0;
    d.scheduled.length = 0;
    await session.answerCard(0);
    const reading = d.mirror.sync();
    await Promise.all([reading, d.later()]);
    expect(reads(state.asked)).toHaveLength(3);
  });

  it('says where things stand: being sent, in the account, or waiting for it', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    const said: string[] = [];
    d.mirror.subscribe(() => said.push(d.mirror.status()));
    const session = await d.sessions.start('nurse');
    expect(d.mirror.status()).toBe('sending');
    await d.later();
    expect(d.mirror.status()).toBe('saved');
    state.down = true;
    await session.answerCard(0);
    await d.later();
    expect(d.mirror.status()).toBe('waiting');
    // While it waits, another write does not pretend it is on its way.
    await session.answerCard(0);
    expect(d.mirror.status()).toBe('waiting');
    expect(said).toEqual(['sending', 'saved', 'sending', 'waiting']);
  });

  it('tries again by itself after a failure, later each time, and stops when it gets through', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await d.sessions.start('nurse');
    d.scheduled.length = 0;
    state.down = true;
    await d.mirror.sync();
    await d.scheduled.splice(0)[0].run();
    await d.scheduled.splice(0)[0].run();
    expect(d.scheduled.map((one) => one.ms)).toEqual([120_000]);
    // One new try is on its way at a time, however many things fail while it is.
    await d.mirror.sync();
    await d.mirror.sync();
    expect(d.scheduled.map((one) => one.ms)).toEqual([120_000]);
    state.down = false;
    await d.later();
    expect(d.mirror.status()).toBe('saved');
    expect(state.games).toHaveLength(1);
    expect(d.scheduled).toEqual([]);
    // Having got through, it starts over: the next failure is tried again as soon as the first was.
    state.down = true;
    await d.mirror.sync();
    expect(d.scheduled.map((one) => one.ms)).toEqual([30_000]);
  });

  it('changes nothing on the device when the account cannot be reached, and catches up later', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    state.down = true;
    const session = await d.sessions.start('nurse');
    await play(session, 2);
    await expect(d.mirror.sync()).resolves.toBeUndefined();
    expect((await saved(d.store))?.state.round).toBe(2);
    expect(d.mirror.status()).toBe('waiting');
    expect(state.games).toEqual([]);
    state.down = false;
    await d.mirror.sync();
    expect(state.games[0].round).toBe(2);
    expect(d.mirror.status()).toBe('saved');
  });

  it('gives a new device the life in progress, rebuilt by playing its log again', async () => {
    const { cloud, state } = fakeCloud();
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
    // What was just taken from the account is not sent straight back to it.
    expect(state.asked.filter((line) => line.startsWith('push'))).toEqual(['push first-1']);
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
    const offered = second.mirror.offer();
    expect(offered).toEqual({ gameId: 'first-1', lifeId: 'nurse', round: 4, cityId: ((await saved(first.store)) as SavedGame).state.player.cityId });
    // The same offer is the same object until it changes, so a screen watching it is not redrawn for nothing.
    expect(second.mirror.offer()).toBe(offered);
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

  it('takes the offered life as the account has it by now, not as it was when it was offered', async () => {
    const { cloud } = fakeCloud();
    const first = device(cloud, 'first');
    const far = await first.sessions.start('nurse');
    await play(far, 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await play(await second.sessions.start('engineer'), 1);
    await second.mirror.sync();
    expect(second.mirror.offer()?.round).toBe(2);
    await play(far, 3);
    await first.mirror.sync();
    second.scheduled.length = 0;
    const heard: string[] = [];
    second.mirror.onDeviceChanged((what) => heard.push(what));
    await second.mirror.takeOffer();
    // Whoever took it is not told of what they did themselves; the further copy that follows is news.
    expect(heard).toEqual([]);
    await second.later();
    expect(heard).toEqual(['game']);
    expect(((await saved(second.store)) as SavedGame).state.round).toBe(5);
    expect(((await saved(first.store)) as SavedGame).state.round).toBe(5);
  });

  it('lets the player end the offered life instead, and does not offer it again', async () => {
    const { cloud, state } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await play(await second.sessions.start('engineer'), 1);
    await second.mirror.sync();
    let told = 0;
    second.mirror.subscribe(() => (told += 1));
    await second.mirror.declineOffer();
    expect(second.mirror.offer()).toBeNull();
    expect(told).toBeGreaterThan(0);
    await second.mirror.sync();
    expect(state.games.find((game) => game.id === 'first-1')?.status).toBe('abandoned');
    expect(second.mirror.offer()).toBeNull();
    expect(((await saved(second.store)) as SavedGame).lifeId).toBe('engineer');
  });

  it('does not take or offer a copy that does not play back to a sound life, and goes on to the next', async () => {
    const { cloud, state } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 2);
    await first.mirror.sync();
    state.games.push({ id: 'tampered', lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, seed: 's', round: 9, status: 'playing', log: [{ picks: ['x'], orders: 'all the money' }], updatedAt: '2026-10-13T23:00:00Z' });
    const second = device(cloud, 'second');
    await second.mirror.sync();
    expect(((await saved(second.store)) as SavedGame).gameId).toBe('first-1');
    expect(second.mirror.offer()).toBeNull();
  });

  it('does not take or offer as a life to continue one that has been played to the end', async () => {
    const { cloud, state } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), content.rounds);
    // The whole game went up, and the server has not finished it.
    state.refuses.add('first-1');
    await first.mirror.sync();
    expect(state.games[0]).toMatchObject({ id: 'first-1', status: 'playing', round: content.rounds });
    const second = device(cloud, 'second');
    await second.mirror.sync();
    expect(await saved(second.store)).toBeNull();
    expect(second.mirror.offer()).toBeNull();
  });

  it('leaves a life that is over on the device, with its score, and offers the one in the account', async () => {
    const { cloud } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await play(await second.sessions.start('engineer'), content.rounds);
    const heard: string[] = [];
    second.mirror.onDeviceChanged((what) => heard.push(what));
    await second.mirror.sync();
    expect(((await saved(second.store)) as SavedGame).state.finished).toBe(true);
    expect(heard).not.toContain('game');
    expect(second.mirror.offer()).toMatchObject({ lifeId: 'nurse', round: 2 });
  });

  it('lets go of a life that was lived to the end on another device: its result is among the finished lives', async () => {
    const { cloud } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await second.mirror.sync();
    await play((await second.sessions.resume()).session as GameSession, content.rounds);
    await second.mirror.sync();
    const heard: string[] = [];
    first.mirror.onDeviceChanged((what) => heard.push(what));
    await first.mirror.sync();
    expect(await saved(first.store)).toBeNull();
    expect((await first.store.listRuns()).map((run) => run.runId)).toEqual(['first-1']);
    // The life is gone from the front door and is among the records; what it earned on the other device came with it.
    expect(heard).toEqual(expect.arrayContaining(['game', 'runs']));
  });

  it('takes up again in the account a life that another device gave up while this one still plays it', async () => {
    const { cloud, state } = fakeCloud();
    const first = device(cloud, 'first');
    const mine = await first.sessions.start('nurse');
    await play(mine, 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await second.mirror.sync();
    await second.sessions.start('engineer');
    await second.mirror.sync();
    expect(state.games.find((game) => game.id === 'first-1')?.status).toBe('abandoned');
    await play(mine, 1);
    await first.later();
    expect(state.games.find((game) => game.id === 'first-1')).toMatchObject({ status: 'playing', round: 3 });
    expect(first.mirror.status()).toBe('saved');
  });

  it('remembers a life given up with no connection, even if the page is closed before there is one', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 2);
    await d.mirror.sync();
    state.down = true;
    await play(await d.sessions.start('engineer'), 1);
    await d.mirror.sync();
    expect(d.notes[0]).toEqual(['a-1']);
    // The page is closed and opened again: a new mirror over the same device.
    state.down = false;
    const reopened = device(cloud, 'b', { store: d.store, notes: d.notes });
    await reopened.mirror.sync();
    expect(state.games.find((game) => game.id === 'a-1')?.status).toBe('abandoned');
    expect(reopened.mirror.offer()).toBeNull();
    expect(d.notes[0]).toEqual([]);
  });

  it('assumes nothing about a different account: it reads it and sends it what the device has', async () => {
    const one = fakeCloud();
    const two = fakeCloud();
    let cloud = one.cloud;
    const store = new MemoryStore();
    const mirror = new MirroredStore(store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {} });
    const sessions = new LocalSessions(mirror, content, lives, { newId: () => 'life-1', newSeed: () => 'seed', now: () => 5 });
    await play(await sessions.start('nurse'), 1);
    one.state.runs.push({ id: 'lived-elsewhere', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, score: 400, netWorth: 9_000_000, status: 30, escapedAtRound: null, bankruptcies: 0, badges: [], cities: ['madrid'], history: [1], finishedAt: '2026-10-01T08:00:00Z' });
    await mirror.sync();
    expect(one.state.games).toHaveLength(1);
    expect(await store.listRuns()).toHaveLength(1);
    cloud = two.cloud;
    two.state.progress = { badges: { millionaire: { at: 5, gameId: 'elsewhere' } }, gallery: [], unlocked: {}, guide: { seen: [], off: false } };
    await mirror.accountChanged();
    expect(two.state.games.map((game) => game.id)).toEqual(['life-1']);
    expect(Object.keys((await store.loadProfile()).badges)).toContain('millionaire');
    // A life the device only knows by its result cannot be played again by any server: it is not sent.
    expect(two.state.asked.filter((line) => line.endsWith('lived-elsewhere'))).toEqual([]);
    expect(mirror.status()).toBe('saved');
  });

  it('does not send the server a finished life on versions this build does not play', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    await play(await d.sessions.start('nurse'), content.rounds);
    const [old] = await d.store.listRuns();
    await d.store.addRun({ ...old, engineVersion: '0.3.0' });
    await d.store.clearGame();
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {} });
    await late.sync();
    expect(state.asked.filter((line) => line.startsWith('push') || line.startsWith('finish'))).toEqual([]);
    expect(late.status()).toBe('saved');
  });

  it('learns from a refused save that the life was lived to the end elsewhere, and reads the account again', async () => {
    const { cloud } = fakeCloud();
    const first = device(cloud, 'first');
    const mine = await first.sessions.start('nurse');
    await play(mine, 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await second.mirror.sync();
    await play((await second.sessions.resume()).session as GameSession, content.rounds);
    await second.mirror.sync();
    // The first device has not looked at the account since. It plays a card, and sends it.
    first.scheduled.length = 0;
    await mine.answerCard(0);
    await first.later();
    expect(await saved(first.store)).toBeNull();
    expect((await first.store.listRuns()).map((run) => run.runId)).toEqual(['first-1']);
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

  it('does not give up in the account a life that is over when a new one begins', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), content.rounds);
    await d.sessions.start('engineer');
    expect(d.notes[0]).toEqual([]);
    await d.mirror.sync();
    expect(state.asked.filter((line) => line.startsWith('abandon'))).toEqual([]);
    expect(state.runs.map((run) => run.id)).toEqual(['a-1']);
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
    // Sent once. The next thing the device writes does not send it again.
    state.asked.length = 0;
    await d.mirror.saveProfile({ ...(await d.mirror.loadProfile()), settings: { reducedMotion: true } });
    await d.later();
    expect(state.asked).toEqual([]);
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
    // Nor when the page is opened again with that life still on the device.
    const reopened = device(cloud, 'b', { store: d.store });
    await reopened.mirror.sync();
    expect(state.asked.filter((line) => line.startsWith('push') || line.startsWith('finish'))).toEqual([]);
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
    const scheduled: Array<{ run: () => Promise<void>; ms: number }> = [];
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: (run, ms) => scheduled.push({ run, ms }), finishPerSync: 2 });
    await late.sync();
    expect(state.runs).toHaveLength(2);
    // The rest follow by themselves, a little later, and the account is not read again for them.
    expect(late.status()).toBe('sending');
    expect(scheduled).toHaveLength(1);
    state.asked.length = 0;
    await scheduled.splice(0)[0].run();
    expect(state.runs).toHaveLength(3);
    expect(reads(state.asked)).toEqual([]);
    expect(late.status()).toBe('saved');
    expect(scheduled).toEqual([]);
  });

  it('does not ask again for a life the server would not finish, and goes on to the others', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    for (let i = 0; i < 2; i++) await play(await d.sessions.start('nurse'), content.rounds);
    const [later, sooner] = (await d.store.listRuns()).map((run) => run.runId);
    state.refuses.add(later);
    const scheduled: Array<{ run: () => Promise<void>; ms: number }> = [];
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: (run, ms) => scheduled.push({ run, ms }), finishPerSync: 1 });
    await late.sync();
    while (scheduled.length > 0) await scheduled.splice(0)[0].run();
    await late.sync();
    expect(state.runs.map((run) => run.id)).toEqual([sooner]);
    expect(state.asked.filter((line) => line === `finish ${later}`)).toHaveLength(1);
    expect(late.status()).toBe('saved');
  });

  it('waits, and sends nothing more, when the server cannot be asked to finish a life', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    for (let i = 0; i < 3; i++) await play(await d.sessions.start('nurse'), content.rounds);
    state.finishFails = true;
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {} });
    await late.sync();
    expect(state.asked.filter((line) => line.startsWith('finish'))).toHaveLength(1);
    expect(late.status()).toBe('waiting');
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
