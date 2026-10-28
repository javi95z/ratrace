import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { ENGINE_VERSION, stateHash } from '@ratrace/engine';
import { describe, expect, it, vi } from 'vitest';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import type { GameSession, PlayerStore, RankedGame, SavedGame } from '@ratrace/core/session/types';
import { stepsOf } from './merge';
import type { CloudGame, Progress } from './merge';
import { MirroredStore } from './mirror';
import type { CloudRun, GameUpload, SyncCloud } from './mirror';

/** What every account of the cloud shares: an id belongs to whoever saved it first. */
interface World {
  owners: Map<string, object>;
}

/**
 * An account in the cloud, kept in memory: what it holds, what it was asked, and switches to make
 * it fail or wait. It keeps the rules of the real one: an id that is another account's is not
 * taken, a life the server has finished is closed, and a copy with less of a life played does not
 * go over a further one.
 */
function fakeCloud(world: World = { owners: new Map() }) {
  const me = {};
  const state = {
    games: [] as CloudGame[],
    progress: null as Progress | null,
    runs: [] as CloudRun[],
    asked: [] as string[],
    down: false,
    clock: 0,
    refuses: new Set<string>(),
    finishFails: false,
    /** The versions the server can play. */
    holds: new Set([`${ENGINE_VERSION}/${CONTENT_VERSION}`]),
    /** The ranked life the player has in progress on the server, if any. */
    ranked: null as { id: string; lifeId: string; engineVersion: string; contentVersion: string } | null,
    /** True while the server of ranked lives cannot be reached, whatever the rest of the account does. */
    rankedAway: false,
    held: new Map<string, Promise<void>>(),
  };
  /** Makes one kind of request wait until the function it returns is called. */
  const hold = (verb: string) => {
    let release = () => {};
    state.held.set(verb, new Promise<void>((resolve) => (release = resolve)));
    return () => {
      state.held.delete(verb);
      release();
    };
  };
  const guard = async (verb: string, what?: string) => {
    if (state.down) throw new Error('no network');
    if (what) state.asked.push(what);
    await state.held.get(verb);
    if (state.down) throw new Error('no network');
  };
  const cloud: SyncCloud = {
    async playingGames() {
      await guard('games', 'read games');
      return state.games.filter((game) => game.status === 'playing').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async pushGame(upload: GameUpload) {
      await guard('push', `push ${upload.id}`);
      const owner = world.owners.get(upload.id);
      if (owner !== undefined && owner !== me) return 'taken';
      const row = state.games.find((game) => game.id === upload.id);
      // A life the server has finished is closed. One that was given up is taken up again by whoever still plays it.
      if (row && row.status === 'finished') return 'closed';
      if (row && stepsOf(upload.log) < stepsOf(row.log)) return 'behind';
      world.owners.set(upload.id, me);
      const next: CloudGame = { ...upload, status: 'playing', updatedAt: `2026-10-13T10:00:${String((state.clock += 1)).padStart(2, '0')}Z` };
      if (row) Object.assign(row, next);
      else state.games.push(next);
      return 'saved';
    },
    async abandonGame(id) {
      await guard('abandon', `abandon ${id}`);
      const row = state.games.find((game) => game.id === id);
      if (row && row.status === 'playing') row.status = 'abandoned';
    },
    async loadProgress() {
      await guard('progress', 'read progress');
      return state.progress;
    },
    async saveProgress(progress) {
      await guard('save progress', 'progress');
      state.progress = progress;
    },
    async listRuns() {
      await guard('runs', 'read runs');
      return [...state.runs];
    },
    async rankedLife() {
      await guard('ranked', 'read ranked');
      return state.ranked;
    },
    async giveUpRanked(id) {
      await guard('give up ranked', `give up ranked ${id}`);
      if (state.rankedAway) throw new Error('the ranked function did not answer');
      if (state.ranked?.id === id) state.ranked = null;
    },
    async finishRun(gameId) {
      await guard('finish', `finish ${gameId}`);
      if (state.finishFails) return 'failed';
      const row = state.games.find((game) => game.id === gameId);
      if (!row || state.refuses.has(gameId)) return 'refused';
      if (!state.holds.has(`${row.engineVersion}/${row.contentVersion}`)) return 'unknown-version';
      row.status = 'finished';
      if (!state.runs.some((run) => run.id === gameId)) {
        state.runs.push({ id: gameId, lifeId: row.lifeId, engineVersion: row.engineVersion, contentVersion: row.contentVersion, score: 123, netWorth: 456, status: 7, escapedAtRound: null, bankruptcies: 0, badges: ['first_100k'], cities: ['madrid'], history: [1, 2], finishedAt: '2026-10-13T12:00:00Z' });
      }
      return 'done';
    },
  };
  return { cloud, state, world, hold };
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
    newId: () => `${name}-renamed-${(renamed += 1)}`,
  });
  let renamed = 0;
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
    // Finding its own copy there exactly as it stands here, it sends nothing.
    state.asked.length = 0;
    await d.mirror.sync();
    expect(state.asked).toEqual(['read runs', 'read games', 'read progress']);
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
    // A life that earns something new between the round it is offered at and the round it is taken at.
    const first = device(cloud, 'phone');
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
    // And the people that life has met by now, which the other device told the account of.
    expect(heard).toEqual(['game', 'profile']);
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
    // The whole game went up, and the server could not be asked to finish it.
    state.finishFails = true;
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

  it('forgets a deleted account in the middle of a pass: nothing it read reaches the device, and the next account, on the same client, is sent nothing', async () => {
    const world: World = { owners: new Map() };
    const gone = fakeCloud(world);
    const next = fakeCloud(world);
    // The account to be deleted holds a finished life and one in progress, played on another device.
    const other = device(gone.cloud, 'web');
    await play(await other.sessions.start('nurse'), content.rounds);
    await play(await other.sessions.start('engineer'), 2);
    await other.mirror.sync();
    expect(gone.state.runs).toHaveLength(1);
    expect(gone.state.games.some((game) => game.status === 'playing')).toBe(true);
    gone.state.asked.length = 0;
    // One client, as on a device: whoever it is signed in as. The mirror is handed it while someone is signed in.
    let signedIn: SyncCloud | null = gone.cloud;
    const client = new Proxy({} as SyncCloud, { get: (_, key) => (signedIn as unknown as Record<string | symbol, unknown>)[key] });
    let account: SyncCloud | null = client;
    const store = new MemoryStore();
    const mirror = new MirroredStore(store, () => account, { content, lives, versions: VERSIONS, schedule: () => {}, newId: () => 'never' });
    // The pass has read the finished lives, and waits on the lives in progress, when the account is deleted.
    const release = gone.hold('games');
    const meeting = mirror.sync();
    await vi.waitFor(() => expect(gone.state.asked).toContain('read games'));
    account = null;
    const forgotten = mirror.forget();
    // The client is the next guest's by the time the old answers come.
    signedIn = next.cloud;
    release();
    await forgotten;
    await meeting;
    expect(await store.loadGame()).toBeNull();
    expect(await store.listRuns()).toEqual([]);
    account = client;
    await mirror.accountChanged();
    expect(next.state.asked.filter((line) => !line.startsWith('read'))).toEqual([]);
    expect(next.state.games).toEqual([]);
    expect(mirror.status()).toBe('saved');
  });

  it('forgets what it noted to tell an account that is gone: the next account is told nothing of it', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 2);
    await d.mirror.sync();
    state.down = true;
    await play(await d.sessions.start('engineer'), 1);
    await d.mirror.sync();
    expect(d.notes[0]).toEqual(['a-1']);
    // The account is deleted: its lives are nobody's to give up now, here or on the next page.
    await d.mirror.forget();
    expect(d.notes[0]).toEqual([]);
    state.down = false;
    await d.mirror.accountChanged();
    expect(state.asked).not.toContain('abandon a-1');
  });

  it('assumes nothing about a different account: it reads it and sends it what the device has', async () => {
    const one = fakeCloud();
    const two = fakeCloud();
    let cloud = one.cloud;
    const store = new MemoryStore();
    const mirror = new MirroredStore(store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, newId: () => 'never' });
    const sessions = new LocalSessions(mirror, content, lives, { newId: () => 'life-1', newSeed: () => 'seed', now: () => 5 });
    await play(await sessions.start('nurse'), 1);
    one.state.runs.push({ id: 'lived-elsewhere', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, score: 400, netWorth: 9_000_000, status: 30, escapedAtRound: null, bankruptcies: 0, badges: [], cities: ['madrid'], history: [1], finishedAt: '2026-10-01T08:00:00Z' });
    await mirror.sync();
    expect(one.state.games).toHaveLength(1);
    expect(await store.listRuns()).toHaveLength(1);
    cloud = two.cloud;
    two.state.progress = { badges: { millionaire: { at: 5, gameId: 'elsewhere' } }, gallery: [], unlocked: {}, guide: { seen: [] }, people: [] };
    await mirror.accountChanged();
    expect(two.state.games.map((game) => game.id)).toEqual(['life-1']);
    expect(Object.keys((await store.loadProfile()).badges)).toContain('millionaire');
    // A life the device only knows by its result cannot be played again by any server: it is not sent.
    expect(two.state.asked.filter((line) => line.endsWith('lived-elsewhere'))).toEqual([]);
    expect(mirror.status()).toBe('saved');
  });

  it('sends the server a life finished on older versions, which it may still hold, and stops asking about versions it does not', async () => {
    const { cloud, state } = fakeCloud();
    state.holds.add('0.4.0/1.3.0');
    const d = device(null);
    for (let i = 0; i < 3; i++) await play(await d.sessions.start('nurse'), content.rounds);
    const [newest, middle, oldest] = await d.store.listRuns();
    await d.store.addRun({ ...newest, engineVersion: '0.1.0', contentVersion: '0.1.0' });
    await d.store.addRun({ ...middle, engineVersion: '0.1.0', contentVersion: '0.1.0' });
    await d.store.addRun({ ...oldest, engineVersion: '0.4.0', contentVersion: '1.3.0' });
    await d.store.clearGame();
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, newId: () => 'never' });
    await late.sync();
    // The life from before the last change of rules is in the account: the server still plays those rules.
    expect(state.runs.map((run) => run.id)).toEqual([oldest.runId]);
    // Of the two on versions it does not hold, it was asked about one. The other was not sent at all.
    expect(state.asked.filter((line) => line.startsWith('finish'))).toEqual([`finish ${newest.runId}`, `finish ${oldest.runId}`]);
    expect(state.asked).not.toContain(`push ${middle.runId}`);
    expect(late.status()).toBe('saved');
  });

  it('does not leave in the account, as a life being played, one the server would not finish', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    await play(await d.sessions.start('nurse'), content.rounds);
    await d.store.clearGame();
    const [run] = await d.store.listRuns();
    state.refuses.add(run.runId);
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, newId: () => 'never' });
    await late.sync();
    expect(state.games.map((game) => game.status)).toEqual(['abandoned']);
    // Another device is not offered it, and does not take it.
    const other = device(cloud, 'other');
    await other.mirror.sync();
    expect(await saved(other.store)).toBeNull();
    expect(other.mirror.offer()).toBeNull();
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
    state.progress = { badges: { millionaire: { at: 5, gameId: 'elsewhere' } }, gallery: ['watch_rolex'], unlocked: { heir: { at: 5, gameId: 'elsewhere' } }, guide: { seen: ['news'] }, people: [] };
    const d = device(cloud);
    const profile = await d.store.loadProfile();
    await d.store.saveProfile({ ...profile, settings: { reducedMotion: true, sound: false }, badges: { first_100k: { at: 9, gameId: 'here' } }, gallery: ['watch_casio'] });
    const heard: string[] = [];
    d.mirror.onDeviceChanged((what) => heard.push(what));
    await d.mirror.sync();
    const after = await d.store.loadProfile();
    expect(Object.keys(after.badges).sort()).toEqual(['first_100k', 'millionaire']);
    expect(after.gallery).toEqual(['watch_casio', 'watch_rolex']);
    expect(Object.keys(after.unlocked)).toEqual(['heir']);
    expect(after.settings).toEqual({ reducedMotion: true, sound: false });
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
    await d.mirror.saveProfile({ ...(await d.mirror.loadProfile()), settings: { reducedMotion: true, sound: false } });
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
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: (run, ms) => scheduled.push({ run, ms }), finishPerSync: 2, newId: () => 'never' });
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
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: (run, ms) => scheduled.push({ run, ms }), finishPerSync: 1, newId: () => 'never' });
    await late.sync();
    while (scheduled.length > 0) await scheduled.splice(0)[0].run();
    await late.sync();
    expect(state.runs.map((run) => run.id)).toEqual([sooner]);
    expect(state.asked.filter((line) => line === `finish ${later}`)).toHaveLength(1);
    expect(late.status()).toBe('saved');
  });

  it('keeps a refusal where the device keeps such notes: a page opened anew, or another account, does not send that life again', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    for (let i = 0; i < 2; i++) await play(await d.sessions.start('nurse'), content.rounds);
    const [later, sooner] = (await d.store.listRuns()).map((run) => run.runId);
    state.refuses.add(later);
    let kept: string[] = [];
    const keepRefused = { read: () => kept, write: (ids: string[]) => void (kept = ids) };
    const first = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, keepRefused, newId: () => 'never' });
    await first.sync();
    expect(kept).toEqual([later]);
    const next = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, keepRefused, newId: () => 'never' });
    await next.sync();
    await next.accountChanged();
    expect(state.asked.filter((line) => line === `finish ${later}`)).toHaveLength(1);
    expect(state.runs.map((run) => run.id)).toEqual([sooner]);
    expect(next.status()).toBe('saved');
    // An account deleted takes its refusals with it: they were its lives.
    await next.forget();
    expect(kept).toEqual([]);
  });

  it('waits, and sends nothing more, when the server cannot be asked to finish a life', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(null);
    for (let i = 0; i < 3; i++) await play(await d.sessions.start('nurse'), content.rounds);
    state.finishFails = true;
    const late = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, newId: () => 'never' });
    await late.sync();
    expect(state.asked.filter((line) => line.startsWith('finish'))).toHaveLength(1);
    expect(late.status()).toBe('waiting');
  });

  it('runs one sync at a time: asked three times in one breath, it reads the account once and sends once', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 1);
    await Promise.all([d.mirror.sync(), d.mirror.sync(), d.mirror.sync()]);
    expect(state.games).toHaveLength(1);
    expect(reads(state.asked)).toHaveLength(3);
    expect(state.asked.filter((line) => line.startsWith('push'))).toHaveLength(1);
  });

  it('runs once more when it is asked while it is running, so what was written meanwhile is not missed', async () => {
    const { cloud, state, hold } = fakeCloud();
    const d = device(cloud);
    const session = await d.sessions.start('nurse');
    await play(session, 1);
    // The first sync has read the device and is on its way to the account with round 1...
    const release = hold('push');
    const first = d.mirror.sync();
    await vi.waitFor(() => expect(state.asked).toContain(`push ${session.gameId}`));
    // ...when another round is played and another sync asked for.
    await play(session, 1);
    const second = d.mirror.sync();
    release();
    await Promise.all([first, second]);
    expect(state.games[0].round).toBe(2);
    expect(d.mirror.status()).toBe('saved');
  });

  it('does not send an older copy of a life over a further one: it is refused, and the device takes the further copy', async () => {
    const { cloud, state } = fakeCloud();
    const desk = device(cloud, 'desk');
    const there = await desk.sessions.start('nurse');
    await play(there, 1);
    await desk.mirror.sync();
    // The phone takes the life and plays it on. The desk's page stays open and never looks at the account.
    const phone = device(cloud, 'phone');
    await phone.mirror.sync();
    await play((await phone.sessions.resume()).session as GameSession, 3);
    await phone.mirror.sync();
    expect(state.games[0].round).toBe(4);
    // One card at the desk.
    desk.scheduled.length = 0;
    const heard: string[] = [];
    desk.mirror.onDeviceChanged((what) => heard.push(what));
    await there.answerCard(0);
    await desk.later();
    expect(state.games[0].round).toBe(4);
    expect(((await saved(desk.store)) as SavedGame).state.round).toBe(4);
    expect(heard).toContain('game');
    expect(desk.mirror.status()).toBe('saved');
  });

  it('sends its own copy again after reading the account, so a copy written over it there does not stand', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 3);
    await d.mirror.sync();
    const mine = (await saved(d.store)) as SavedGame;
    // Another device, as far along but down another road, wrote over it since.
    Object.assign(state.games[0], { stateHash: 'another-road', log: mine.log.map((round) => ({ ...round, picks: round.picks.map(() => 0) })) });
    state.asked.length = 0;
    await d.mirror.sync();
    expect(state.asked).toContain(`push ${mine.gameId}`);
    expect(state.games[0]).toMatchObject({ stateHash: stateHash(mine.state) });
  });

  it('waits, and does not say saved, while the account holds more of the life than the device and cannot yet be taken from', async () => {
    const { cloud, state } = fakeCloud();
    const desk = device(cloud, 'desk');
    await play(await desk.sessions.start('nurse'), 1);
    await desk.mirror.sync();
    // The phone lived the life to its end and sent the whole of it; the server has not finished it yet.
    const phone = device(cloud, 'phone');
    await phone.mirror.sync();
    state.finishFails = true;
    await play((await phone.sessions.resume()).session as GameSession, content.rounds);
    await phone.mirror.sync();
    expect(state.games[0]).toMatchObject({ status: 'playing', round: content.rounds });
    // The desk's page is opened again.
    await desk.mirror.sync();
    expect(state.games[0].round).toBe(content.rounds);
    expect(((await saved(desk.store)) as SavedGame).state.round).toBe(1);
    expect(desk.mirror.status()).toBe('waiting');
    // Once the server has finished it, the desk lets go of its copy and has the result.
    state.finishFails = false;
    await phone.mirror.sync();
    await desk.mirror.sync();
    expect(await saved(desk.store)).toBeNull();
    expect((await desk.store.listRuns()).map((run) => run.runId)).toEqual(['desk-1']);
    expect(desk.mirror.status()).toBe('saved');
  });

  it('does not write what is unlocked over what another device has added since it last read the account', async () => {
    const { cloud, state } = fakeCloud();
    const desk = device(cloud, 'desk');
    await desk.mirror.sync();
    const phone = device(cloud, 'phone');
    await phone.mirror.saveProfile({ ...(await phone.mirror.loadProfile()), badges: { millionaire: { at: 5, gameId: 'on-the-phone' } }, gallery: ['watch_rolex'] });
    await phone.mirror.sync();
    // The desk has not read the account since. It earns something of its own, and sends it.
    await desk.mirror.saveProfile({ ...(await desk.mirror.loadProfile()), gallery: ['watch_casio'] });
    await desk.later();
    expect(Object.keys(state.progress?.badges ?? {})).toEqual(['millionaire']);
    expect([...(state.progress?.gallery ?? [])].sort()).toEqual(['watch_casio', 'watch_rolex']);
    // And what the phone had came down with the answer.
    expect(Object.keys((await desk.store.loadProfile()).badges)).toEqual(['millionaire']);
  });

  it('keeps whether the guide is on out of the account: turning it back on stays on', async () => {
    const { cloud, state } = fakeCloud();
    // An account written before this was understood still says the guide is off.
    state.progress = { badges: {}, gallery: [], unlocked: {}, guide: { seen: ['news'], off: true } } as unknown as Progress;
    const d = device(cloud);
    await d.mirror.sync();
    expect((await d.store.loadProfile()).guide).toEqual({ seen: ['news'], off: false });
    await d.mirror.saveProfile({ ...(await d.mirror.loadProfile()), guide: { seen: ['news', 'cards'], off: true } });
    await d.later();
    expect(state.progress?.guide).toEqual({ seen: ['news', 'cards'] });
    await d.mirror.saveProfile({ ...(await d.mirror.loadProfile()), guide: { seen: ['news', 'cards'], off: false } });
    await d.later();
    await d.mirror.sync();
    expect((await d.store.loadProfile()).guide.off).toBe(false);
  });

  it('does not write the account\'s life over one begun while the account was being read', async () => {
    const { cloud, state, hold } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    state.asked.length = 0;
    const release = hold('games');
    const reading = second.mirror.sync();
    await vi.waitFor(() => expect(state.asked).toContain('read games'));
    await second.sessions.start('engineer');
    release();
    await reading;
    expect(((await saved(second.store)) as SavedGame).lifeId).toBe('engineer');
    expect(second.mirror.offer()).toMatchObject({ lifeId: 'nurse' });
  });

  it('does not offer again a life the player ended while the account was being read', async () => {
    const { cloud, state, hold } = fakeCloud();
    const first = device(cloud, 'first');
    await play(await first.sessions.start('nurse'), 2);
    await first.mirror.sync();
    const second = device(cloud, 'second');
    await play(await second.sessions.start('engineer'), 1);
    await second.mirror.sync();
    expect(second.mirror.offer()).toMatchObject({ lifeId: 'nurse' });
    state.asked.length = 0;
    const release = hold('games');
    const reading = second.mirror.sync();
    await vi.waitFor(() => expect(state.asked).toContain('read games'));
    await second.mirror.declineOffer();
    release();
    await reading;
    await second.later();
    expect(second.mirror.offer()).toBeNull();
  });

  it('does not give up in the account the life it is playing, whatever an old note says', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await play(await d.sessions.start('nurse'), 1);
    await d.mirror.sync();
    // The page is opened again with a note that names the very life on the device.
    const reopened = device(cloud, 'b', { store: d.store, notes: [['a-1']] });
    await reopened.mirror.sync();
    expect(state.games[0].status).toBe('playing');
    expect(state.asked).not.toContain('abandon a-1');
    expect(reopened.notes[0]).toEqual([]);
  });

  it('reads the account again when it tries anew after a failure, though all it failed at was sending', async () => {
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    const session = await d.sessions.start('nurse');
    await d.mirror.sync();
    d.scheduled.length = 0;
    state.down = true;
    await session.answerCard(0);
    await d.later();
    expect(d.mirror.status()).toBe('waiting');
    state.down = false;
    state.asked.length = 0;
    await d.later();
    expect(reads(state.asked)).toHaveLength(3);
    expect(d.mirror.status()).toBe('saved');
  });

  it('waits for the sync that is running before it forgets one account for another', async () => {
    const one = fakeCloud();
    const two = fakeCloud();
    let cloud = one.cloud;
    const store = new MemoryStore();
    const mirror = new MirroredStore(store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => {}, newId: () => 'never' });
    const sessions = new LocalSessions(mirror, content, lives, { newId: () => 'life-1', newSeed: () => 'seed', now: () => 5 });
    await play(await sessions.start('nurse'), 1);
    // The life is on its way to the first account when the player becomes someone else.
    const release = one.hold('push');
    const first = mirror.sync();
    await vi.waitFor(() => expect(one.state.asked).toContain('push life-1'));
    cloud = two.cloud;
    const changed = mirror.accountChanged();
    release();
    await Promise.all([first, changed]);
    // What was sent to the first account is not taken for sent to the second.
    expect(two.state.games.map((game) => game.id)).toEqual(['life-1']);
  });

  it('gives a life a new id when the account will not take it under its own, and its finished lives with it', async () => {
    // A guest on a second device, who then signs in as the account their Google already has. Everything
    // this device sent went up under the guest, and an id belongs to whoever saved it first.
    const guest = fakeCloud();
    const member = fakeCloud(guest.world);
    let cloud = guest.cloud;
    const d = device(null, 'guest');
    const scheduled: Array<{ run: () => Promise<void>; ms: number }> = [];
    let fresh = 0;
    const mirror = new MirroredStore(d.store, () => cloud, { content, lives, versions: VERSIONS, schedule: (run, ms) => scheduled.push({ run, ms }), newId: () => `fresh-${(fresh += 1)}` });
    let ids = 0;
    let clock = 1_000;
    const sessions = new LocalSessions(mirror, content, lives, { newId: () => `guest-${(ids += 1)}`, newSeed: () => `seed-${ids}`, now: () => (clock += 1) });
    await play(await sessions.start('nurse'), content.rounds);
    await play(await sessions.start('engineer'), 2);
    await mirror.sync();
    expect(guest.state.runs.map((run) => run.id)).toEqual(['guest-1']);
    expect(guest.state.games.find((game) => game.id === 'guest-2')).toMatchObject({ status: 'playing', round: 2 });
    const before = (await saved(d.store)) as SavedGame;
    const profile = await d.store.loadProfile();
    await d.store.saveProfile({ ...profile, badges: { ...profile.badges, of_the_first: { at: 1, gameId: 'guest-1' }, of_the_second: { at: 2, gameId: 'guest-2' } }, unlocked: { heir: { at: 3, gameId: 'guest-1' } } });
    const heard: string[] = [];
    mirror.onDeviceChanged((what) => heard.push(what));

    cloud = member.cloud;
    scheduled.length = 0;
    await mirror.accountChanged();
    while (scheduled.length > 0) await scheduled.splice(0)[0].run();

    // The life in progress is the same life, under a new id, and it is in the member's account.
    const after = (await saved(d.store)) as SavedGame;
    expect(after.gameId).toMatch(/^fresh-/);
    expect(stateHash(after.state)).toBe(stateHash(before.state));
    expect(after.log).toEqual(before.log);
    expect(member.state.games.find((game) => game.id === after.gameId)).toMatchObject({ status: 'playing', round: 2, lifeId: 'engineer' });
    // The finished life too: one record of it on the device, not two, and the server has finished it for the member.
    const runs = await d.store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ lifeId: 'nurse', seed: 'seed-1' });
    expect(runs[0].runId).toMatch(/^fresh-/);
    expect(member.state.runs.map((run) => run.id)).toEqual([runs[0].runId]);
    // What each life earned is still its own.
    const now = await d.store.loadProfile();
    expect(now.badges.of_the_first.gameId).toBe(runs[0].runId);
    expect(now.badges.of_the_second.gameId).toBe(after.gameId);
    expect(now.unlocked.heir.gameId).toBe(runs[0].runId);
    expect(heard).toContain('renamed');
    expect(mirror.status()).toBe('saved');
    // The guest's account is as it was.
    expect(guest.state.games.map((game) => game.id).sort()).toEqual(['guest-1', 'guest-2']);

    // And the life plays on under its new id.
    const { session } = await sessions.resume();
    expect(session?.gameId).toBe(after.gameId);
    await play(session as GameSession, 1);
    while (scheduled.length > 0) await scheduled.splice(0)[0].run();
    expect(member.state.games.find((game) => game.id === after.gameId)?.round).toBe(3);
    expect(mirror.status()).toBe('saved');
  });

  it('leaves a ranked life alone: the server has it already, and no casual life from the account takes its place', async () => {
    const { cloud, state } = fakeCloud();
    const elsewhere = device(cloud, 'elsewhere');
    await play(await elsewhere.sessions.start('nurse'), 2);
    await elsewhere.mirror.sync();
    state.asked.length = 0;
    // This device holds the note of a ranked life. The account holds a casual one, from the other device.
    const d = device(cloud);
    const note: RankedGame = { format: 1, ranked: true, gameId: 'ranked-1', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 3, view: null, history: [], bankruptcies: 0, journal: null, updatedAt: 7 };
    await d.mirror.saveGame(note);
    await d.mirror.sync();
    expect(await d.store.loadGame()).toEqual(note);
    expect(state.asked.filter((line) => line.startsWith('push') || line.startsWith('abandon'))).toEqual([]);
    // The casual life waits in the account, offered and not imposed.
    expect(d.mirror.offer()).toMatchObject({ gameId: 'elsewhere-1', lifeId: 'nurse' });
    expect(d.mirror.status()).toBe('saved');
    // It has a life: it does not ask the account for a ranked one.
    expect(state.asked).not.toContain('read ranked');
  });

  it('gives a device with no life the ranked life the account has in progress, as a note to open', async () => {
    const { cloud, state } = fakeCloud();
    state.ranked = { id: 'ranked-9', lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const d = device(cloud);
    const heard: string[] = [];
    d.mirror.onDeviceChanged((what) => heard.push(what));
    await d.mirror.sync();
    expect(await d.store.loadGame()).toMatchObject({ format: 1, ranked: true, gameId: 'ranked-9', lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, view: null });
    expect(heard).toContain('game');
    // The note is not a life to send, and it is taken once.
    state.asked.length = 0;
    await d.mirror.sync();
    expect(state.asked.filter((line) => line.startsWith('push'))).toEqual([]);
    expect(state.asked).not.toContain('read ranked');
  });

  it('does not take a ranked life begun under rules this build does not play', async () => {
    const { cloud, state } = fakeCloud();
    state.ranked = { id: 'ranked-9', lifeId: 'nurse', engineVersion: '0.1.0', contentVersion: CONTENT_VERSION };
    const d = device(cloud);
    await d.mirror.sync();
    expect(await d.store.loadGame()).toBeNull();
    // The numbers of the game are rules as much as the engine is.
    state.ranked = { id: 'ranked-9', lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: '0.1.0' };
    await d.mirror.sync();
    expect(await d.store.loadGame()).toBeNull();
  });

  it('prefers the account\'s ranked life to its casual one for a device with none, and offers the casual one', async () => {
    const { cloud, state } = fakeCloud();
    const elsewhere = device(cloud, 'elsewhere');
    await play(await elsewhere.sessions.start('nurse'), 1);
    await elsewhere.mirror.sync();
    state.ranked = { id: 'ranked-9', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const d = device(cloud);
    await d.mirror.sync();
    expect(await d.store.loadGame()).toMatchObject({ ranked: true, gameId: 'ranked-9' });
    expect(d.mirror.offer()).toMatchObject({ gameId: 'elsewhere-1' });
  });

  /** The note of a ranked life this device has shown its player: it has a view, and the life is not over. */
  const seen = (gameId: string, over: Partial<RankedGame> = {}): RankedGame => ({
    format: 1, ranked: true, gameId, lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, step: 3,
    view: { finished: false, round: 0, timeline: [{}], player: {} } as never, history: [], bankruptcies: 0, journal: { earned: [] } as never, updatedAt: 7, ...over,
  });
  const givenUp = (asked: string[]) => asked.filter((line) => line.startsWith('give up ranked'));

  it('remembers a ranked life given up with no connection, tells the server when there is one, and does not take the life back', async () => {
    const { cloud, state } = fakeCloud();
    state.ranked = { id: 'ranked-1', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const d = device(cloud);
    await d.store.saveGame(seen('ranked-1'));
    // The player gives the life up with no connection. The server still says it is in progress.
    state.down = true;
    await d.mirror.clearGame();
    await d.later();
    expect(givenUp(state.asked)).toEqual([]);
    // The page is closed and opened again before there is a connection: the note of it was kept.
    const again = device(cloud, 'a', { store: d.store, notes: d.notes });
    state.down = false;
    await again.mirror.sync();
    expect(givenUp(state.asked)).toEqual(['give up ranked ranked-1']);
    expect(await again.store.loadGame()).toBeNull();
    // Told once: it is not told again.
    await again.mirror.sync();
    expect(givenUp(state.asked)).toHaveLength(1);
  });

  it('does not hand back a ranked life it has yet to give up, and does not let that hold up anything else', async () => {
    const { cloud, state } = fakeCloud();
    state.ranked = { id: 'ranked-1', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const d = device(cloud);
    await d.store.saveGame(seen('ranked-1'));
    await d.mirror.clearGame();
    // The account answers; the server of ranked lives does not.
    state.rankedAway = true;
    await d.mirror.sync();
    expect(await d.store.loadGame()).toBeNull();
    expect(d.mirror.status()).toBe('saved');
    // The device goes on being mirrored meanwhile: a casual life begun now goes up.
    const session = await d.sessions.start('nurse');
    await d.later();
    expect(state.games.map((game) => game.id)).toEqual([session.gameId]);
    // And the ranked life is given up as soon as the server can be told.
    state.rankedAway = false;
    await d.mirror.sync();
    expect(state.ranked).toBeNull();
    expect(d.notes[0]).toEqual([]);
  });

  it('gives up a ranked life that gives way to another on this device, and only one the player was shown, still going, of this build', async () => {
    for (const [note, told] of [
      [seen('ranked-1'), ['give up ranked ranked-1']],
      // Nobody opened it here: the player was never asked about it.
      [seen('ranked-1', { view: null, journal: null }), []],
      // It is over: its result stands.
      [seen('ranked-1', { view: { finished: true, round: 20, timeline: [{}], player: {} } as never }), []],
      // Begun under other rules: another device may still be living it under them.
      [seen('ranked-1', { engineVersion: '0.1.0' }), []],
    ] as const) {
      const { cloud, state } = fakeCloud();
      const d = device(cloud);
      await d.store.saveGame(note);
      await d.sessions.start('nurse');
      await d.later();
      expect(givenUp(state.asked), JSON.stringify(note.view)).toEqual(told);
    }
    // The same note written again, as every step of the life writes it, gives nothing up.
    const { cloud, state } = fakeCloud();
    const d = device(cloud);
    await d.store.saveGame(seen('ranked-1'));
    await d.mirror.saveGame(seen('ranked-1', { step: 4, updatedAt: 8 }));
    await d.later();
    expect(givenUp(state.asked)).toEqual([]);
  });

  it('gives up the ranked life this device was living when the player takes the life offered from the account instead', async () => {
    const { cloud, state } = fakeCloud();
    const elsewhere = device(cloud, 'elsewhere');
    await play(await elsewhere.sessions.start('nurse'), 1);
    await elsewhere.mirror.sync();
    const d = device(cloud);
    await d.store.saveGame(seen('ranked-1'));
    await d.mirror.sync();
    expect(d.mirror.offer()).toMatchObject({ gameId: 'elsewhere-1' });
    expect(await d.mirror.takeOffer()).toBe(true);
    await d.later();
    expect(givenUp(state.asked)).toEqual(['give up ranked ranked-1']);
  });

  it('does not put the account\'s ranked life over a life begun while the account was being asked', async () => {
    const { cloud, state, hold } = fakeCloud();
    state.ranked = { id: 'ranked-9', lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
    const d = device(cloud);
    const release = hold('ranked');
    const meeting = d.mirror.sync();
    await vi.waitFor(() => expect(state.asked).toContain('read ranked'));
    // The answer is on its way, and the player starts a life.
    const session = await d.sessions.start('nurse');
    release();
    await meeting;
    expect((await saved(d.store))?.gameId).toBe(session.gameId);
  });

  it('brings a ranked life finished elsewhere to the records, marked as ranked', async () => {
    const { cloud, state } = fakeCloud();
    state.runs.push({ id: 'ranked-done', mode: 'ranked', lifeId: 'engineer', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, score: 400, netWorth: 9, status: 30, escapedAtRound: null, bankruptcies: 0, badges: [], cities: ['madrid'], history: [1], finishedAt: '2026-10-01T08:00:00Z' });
    const d = device(cloud);
    await d.mirror.sync();
    expect(await d.store.listRuns()).toMatchObject([{ runId: 'ranked-done', ranked: true }]);
    // And it is never sent back as a casual life to be finished.
    expect(state.asked.filter((line) => line.startsWith('push') || line.startsWith('finish'))).toEqual([]);
  });

  it('brings a life lived in a room to the records, marked as one, and never sends one back up', async () => {
    const { cloud, state } = fakeCloud();
    state.runs.push({ id: 'room-done', mode: 'room', lifeId: 'nurse', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, score: 300, netWorth: 9, status: 30, escapedAtRound: null, bankruptcies: 0, badges: [], cities: ['madrid'], history: [1], finishedAt: '2026-10-01T08:00:00Z' });
    const d = device(cloud);
    // A room's life the device itself kept at its end: its figures are the server's, and it has no log to send.
    await d.store.addRun({ format: 1, runId: 'room-here', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: '', log: [], finishedAt: 1, score: 200, netWorth: 1, status: 1, escapedAtRound: null, bankruptcies: 0, history: [1], badges: [], cities: ['madrid'], verified: false, room: true });
    await d.mirror.sync();
    expect((await d.store.listRuns()).find((run) => run.runId === 'room-done')).toMatchObject({ room: true });
    expect((await d.store.listRuns()).find((run) => run.runId === 'room-done')).not.toHaveProperty('ranked');
    expect(state.asked.filter((line) => line.startsWith('push') || line.startsWith('finish'))).toEqual([]);
  });
});

describe('the lives in progress the account offers, played back at a pace (a phone)', { timeout: 60_000 }, () => {
  /** A mirror over `store` as the phone makes it: `pace` awaited before each life played back. */
  const paced = (cloud: SyncCloud, store: MemoryStore, pace: () => Promise<void>) =>
    new MirroredStore(store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => undefined, newId: () => 'never', pace });

  it('plays each back after a pause of its own, and the device ends as it would have without one: the further copy of its life', async () => {
    const { cloud } = fakeCloud();
    const a = device(cloud, 'a');
    const session = await a.sessions.start('nurse');
    await play(session, 1);
    await a.mirror.sync();
    // Another device takes the life up and plays it further.
    const b = device(cloud, 'b');
    await b.mirror.sync();
    await play((await b.sessions.resume()).session as GameSession, 2);
    await b.mirror.sync();
    const further = (await saved(b.store)) as SavedGame;
    expect(further.state.round).toBe(3);
    // The first device starts again (a new page, a new start of the app): its own copy at round 1.
    const store = new MemoryStore();
    await store.saveGame((await saved(a.store)) as SavedGame);
    const order: string[] = [];
    const mirror = paced(cloud, store, async () => void order.push('pause'));
    const told: string[] = [];
    mirror.onDeviceChanged((what) => told.push(what));
    await mirror.sync();
    expect(order).toEqual(['pause']);
    expect(((await saved(store)) as SavedGame).state.round).toBe(3);
    expect(told).toContain('game');
  });

  it('looks at the device for good only after the pauses: a life begun meanwhile is the one it keeps, and the account\'s is offered', async () => {
    const { cloud } = fakeCloud();
    const b = device(cloud, 'b');
    await play(await b.sessions.start('nurse'), 2);
    await b.mirror.sync();
    const theirs = (await saved(b.store)) as SavedGame;
    // A device with no life: it would take the account's. While the account's is being played back, the player begins a life of their own.
    const store = new MemoryStore();
    let resume: (() => void) | undefined;
    const mirror = paced(cloud, store, () => new Promise<void>((resolve) => (resume = resolve)));
    const meeting = mirror.sync();
    await vi.waitFor(() => expect(resume).toBeDefined());
    const mine = await new LocalSessions(mirror, content, lives, { newId: () => 'mine', newSeed: () => 'seed-mine', now: () => 5 }).start('engineer');
    resume?.();
    await meeting;
    expect(mine.view().round).toBe(0);
    expect(((await saved(store)) as SavedGame).gameId).toBe('mine');
    expect(mirror.offer()?.gameId).toBe(theirs.gameId);
  });
});

describe('whether the account has been read for the life on the device', { timeout: 60_000 }, () => {
  it('is not, until the mirror has met it; then it is, and who listens is told, once a meeting; someone else signing in makes it not again', async () => {
    const { cloud, hold } = fakeCloud();
    const d = device(cloud);
    const told = vi.fn();
    d.mirror.onLifeRead(told);
    expect(d.mirror.lifeRead()).toBe(false);
    const release = hold('games');
    const meeting = d.mirror.sync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(d.mirror.lifeRead()).toBe(false);
    release();
    await meeting;
    expect(d.mirror.lifeRead()).toBe(true);
    expect(told).toHaveBeenCalledTimes(1);
    const changing = d.mirror.accountChanged();
    expect(d.mirror.lifeRead()).toBe(false);
    await changing;
    expect(d.mirror.lifeRead()).toBe(true);
    expect(told).toHaveBeenCalledTimes(2);
  });

  it('with a pace, is told as soon as the device holds the further copy of its life, before the lives only offered are played back', async () => {
    const { cloud } = fakeCloud();
    const a = device(cloud, 'a');
    await play(await a.sessions.start('nurse'), 1);
    await a.mirror.sync();
    const b = device(cloud, 'b');
    await b.mirror.sync();
    await play((await b.sessions.resume()).session as GameSession, 2);
    await b.mirror.sync();
    // And another life in the account, only to be offered.
    const c = device(cloud, 'c');
    await c.mirror.declineOffer();
    await play(await c.sessions.start('engineer'), 1);
    await c.mirror.sync();
    // The first device starts again, its life at round 1.
    const store = new MemoryStore();
    await store.saveGame((await saved(a.store)) as SavedGame);
    const pauses: Array<() => void> = [];
    const mirror = new MirroredStore(store, () => cloud, { content, lives, versions: VERSIONS, schedule: () => undefined, newId: () => 'never', pace: () => new Promise<void>((resolve) => pauses.push(resolve)) });
    const events: string[] = [];
    mirror.onDeviceChanged((what) => events.push(what));
    mirror.onLifeRead(() => events.push('life read'));
    const meeting = mirror.sync();
    // The further copy of its own life, played back after a pause, before the device is looked at for good.
    await vi.waitFor(() => expect(pauses).toHaveLength(1));
    pauses[0]();
    // Taken and told; then the offer's pause, the device's life already settled.
    await vi.waitFor(() => expect(pauses).toHaveLength(2));
    expect(events).toEqual(['game', 'life read']);
    expect(((await saved(store)) as SavedGame).state.round).toBe(3);
    expect(mirror.offer()).toBeNull();
    pauses[1]();
    await meeting;
    expect(mirror.offer()?.lifeId).toBe('engineer');
  });
});
