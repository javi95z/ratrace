// @vitest-environment jsdom
import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { createGameStore } from '@ratrace/core/game/store';
import type { GameStore } from '@ratrace/core/game/store';
import { LocalSessions } from '@ratrace/core/session/local';
import { MemoryStore } from '@ratrace/core/session/memory';
import { newProfile, SAVE_FORMAT } from '@ratrace/core/session/types';
import type { GameSession, SavedGame } from '@ratrace/core/session/types';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { CloudGame } from '@ratrace/online/merge';
import { stepsOf } from '@ratrace/online/merge';
import { MirroredStore } from '@ratrace/online/mirror';
import type { CloudRun } from '@ratrace/online/mirror';
import type { Cloud, CloudUser } from '@ratrace/online/supabase';
import type { Account, AccountLife, AccountSaves, AccountState, CloudSaving, Community, Opener } from '@ratrace/online/types';
import { act, cleanup, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { rankedServer } from '../../../web/src/testing/rankedServer';
import { roomServer } from '../../../web/src/testing/roomServer';
import { onlineOver } from '../online';
import { BACK_FROM_GOOGLE, openForGoogle } from '../online/browser';
import { phonePage } from '../online/page';
import { network, router } from '../testing/fakes';
import { kv, memoryServices, renderGame } from '../testing/render';
import { Counted as Drawn, settled, steady } from '../testing/renders';
import type { Renders } from '../testing/renders';
import {
  GameScope,
  servicesOver,
  useAccount,
  useAccountSaves,
  useAccountSettled,
  useCanSignIn,
  useCommunity,
  useGame,
  useInRoom,
  useProfile,
  useRanking,
  useRoom,
  useRooms,
  useRuns,
  useSettings,
  useTrack,
  useWords,
} from './context';
import type { Counted, Services } from './context';

/*
 * The game's context with a cloud behind it: the web's cases of game/context.tsx for the account, its copy of the player's things, the rooms and
 * what is counted, on the phone. The cloud is a test's, in memory (the account's own logic, the mirror's and the ranked server's are the real
 * ones over it); the network is the phone's stand-in (`testing/fakes.ts`).
 */

afterEach(cleanup);

const VERSIONS = { engine: ENGINE_VERSION, content: CONTENT_VERSION };

/**
 * The game's project, in memory, for one player's account: who the phone is signed in as, the lives being played and finished, the progress, the
 * language kept with the account; the ranked server and the rooms are the web's in-memory ones. `down` takes the network away.
 */
function theCloud(signedIn: CloudUser | null = null) {
  const ranked = rankedServer();
  const rooms = roomServer();
  const state = { user: signedIn, down: false, guests: 0, games: [] as CloudGame[], progress: null as unknown, runs: [] as CloudRun[], language: null as string | null, clock: 0, asked: [] as string[] };
  const listeners = new Set<(user: CloudUser | null) => void>();
  const guard = (what?: string) => {
    if (state.down) throw new TypeError('Failed to fetch');
    if (what) state.asked.push(what);
  };
  const become = (user: CloudUser | null) => {
    state.user = user;
    for (const listener of [...listeners]) listener(user);
  };
  const toGoogle = async (open: Opener | undefined, user: CloudUser) => {
    const back = await open?.('https://accounts.google.com/');
    if (!back) return false;
    become(user);
    return true;
  };
  const cloud: Cloud = {
    ranked: ranked.api,
    rooms: rooms.link('11111111-1111-4111-8111-111111111111'),
    community: { me: async () => ({ nickname: null, friendCode: 'RAT-1', avatar: null, language: state.language }) } as unknown as Community,
    currentUser: async () => (guard(), state.user),
    signInAsGuest: async () => {
      guard('guest');
      state.guests += 1;
      state.user = { id: `guest-${state.guests}`, is_anonymous: true, email: undefined };
      return state.user;
    },
    linkGoogle: (_to, open) => toGoogle(open, { id: state.user!.id, is_anonymous: false, email: 'rat@example.com' }),
    signInWithGoogle: (_to, open) => toGoogle(open, { id: 'member-1', is_anonymous: false, email: 'rat@example.com' }),
    signOut: async () => (guard('sign out'), become(null)),
    ensureProfile: async () => undefined,
    onUser: (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    reportErrors: async () => 'sent',
    playingGames: async () => (guard(), state.games.filter((game) => game.status === 'playing').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    pushGame: async (upload) => {
      guard(`push ${upload.id}`);
      const row = state.games.find((game) => game.id === upload.id);
      if (row && row.status === 'finished') return 'closed';
      if (row && stepsOf(upload.log) < stepsOf(row.log)) return 'behind';
      const next: CloudGame = { ...upload, status: 'playing', updatedAt: `2026-10-13T10:00:${String((state.clock += 1)).padStart(2, '0')}Z` };
      if (row) Object.assign(row, next);
      else state.games.push(next);
      return 'saved';
    },
    abandonGame: async (id) => {
      guard(`abandon ${id}`);
      const row = state.games.find((game) => game.id === id);
      if (row && row.status === 'playing') row.status = 'abandoned';
    },
    loadProgress: async () => (guard(), state.progress),
    saveProgress: async (progress) => void (guard(), (state.progress = progress)),
    listRuns: async () => (guard(), [...state.runs]),
    rankedLife: async () => (guard(), null),
    giveUpRanked: async () => guard(),
    finishRun: async () => (guard(), 'refused'),
  };
  return { cloud, state, ranked };
}
type TheCloud = ReturnType<typeof theCloud>;

const member: CloudUser = { id: 'member-1', is_anonymous: false, email: 'rat@example.com' };

/** Plays a life a few rounds on. */
async function play(session: GameSession, rounds: number) {
  for (let i = 0; i < rounds && !session.view().finished; i++) {
    while (session.view().phase === 'cards') await session.answerCard(0);
    await session.playRound({ orders: [] });
  }
}

/** Ids, seeds and a clock of a device of its own, so that two devices never make the same life. */
function depsOf(name: string) {
  let ids = 0;
  let clock = 1_000;
  return { newId: () => `${name}-${(ids += 1)}`, newSeed: () => `seed-${name}-${ids}`, now: () => (clock += 1) };
}

/** Another device of the same account (the web, say): it plays a life there, and the account has it. */
async function elsewhere(cloud: TheCloud, lifeId: string, rounds: number) {
  const store = new MemoryStore();
  const mirror = new MirroredStore(store, () => cloud.cloud, { content, lives, versions: VERSIONS, newId: () => 'web-renamed', schedule: () => undefined });
  const sessions = new LocalSessions(mirror, content, lives, depsOf('web'));
  const session = await sessions.start(lifeId);
  await play(session, rounds);
  await mirror.sync();
  return { store, mirror, session };
}

/** The phone: its own store, with the account behind it as the phone's cloud wires it (`onlineOver`), and the game's services over that. */
function phoneOf(cloud: TheCloud, device = new MemoryStore()) {
  const noted = () => {
    let ids: string[] = [];
    return { read: () => ids, write: (next: string[]) => void (ids = next) };
  };
  const online = onlineOver(device, { connect: async () => cloud.cloud, address: () => null, clean: () => undefined, page: phonePage, remember: noted(), keepRefused: noted(), newId: () => 'phone-renamed' });
  const counted: Counted[] = [];
  const services: Services = { ...servicesOver(online, depsOf('phone')), tapGuardMs: 0, track: (event) => counted.push(event) };
  return { services, online, device, counted };
}

/** What a screen reads of the cloud and of the round, kept for the test to read and to act through. */
interface Seen {
  account: ReturnType<typeof useAccount>;
  settled: boolean;
  saves: ReturnType<typeof useAccountSaves>;
  ranking: ReturnType<typeof useRanking>;
  canSignIn: boolean;
  community: Community | null;
  status: string;
  lifeId: string | null;
  round: number | null;
  locale: string;
  setLocale: (locale: 'en' | 'es' | 'ru') => void;
  start: (lifeId: string, options?: { ranked?: boolean }) => Promise<boolean>;
}
function Probe({ seen }: { seen: Partial<Seen> }) {
  seen.account = useAccount();
  seen.settled = useAccountSettled();
  seen.saves = useAccountSaves();
  seen.ranking = useRanking();
  seen.canSignIn = useCanSignIn();
  seen.community = useCommunity();
  seen.status = useGame((s) => s.status);
  seen.lifeId = useGame((s) => s.lifeId);
  seen.round = useGame((s) => s.view?.round ?? null);
  seen.start = useGame((s) => s.start);
  const settings = useSettings();
  seen.locale = settings.locale;
  seen.setLocale = settings.setLocale;
  return null;
}
function mount(services: Services, extra?: ReactNode) {
  const seen: Partial<Seen> = {};
  const view = renderGame(
    <>
      <Probe seen={seen} />
      {extra}
    </>,
    services,
  );
  return { seen: seen as Seen, view };
}

describe('the account, on the phone', () => {
  it('is a guest from the first launch: the game does not wait for it, and it is started once', async () => {
    const cloud = theCloud();
    const { services } = phoneOf(cloud);
    const { seen } = mount(services);
    // The game opens at once, with nobody signed in yet; nobody being signed in says nothing until the account has tried.
    expect(seen.canSignIn).toBe(true);
    await waitFor(() => expect(seen.account.state).toEqual({ kind: 'guest', userId: 'guest-1', notice: null }));
    expect(seen.settled).toBe(true);
    expect(seen.status).toBe('none');
    expect(seen.ranking).toBe('yes');
    expect(seen.community).toBe(cloud.cloud.community);
    expect(cloud.state.guests).toBe(1);
  });

  it('is nobody with no network: the game is the phone\'s alone, and the account follows the network when it comes back', async () => {
    network.connected = false;
    const cloud = theCloud();
    cloud.state.down = true;
    const { services } = phoneOf(cloud);
    const { seen } = mount(services);
    await waitFor(() => expect(seen.settled).toBe(true));
    expect(seen.account.state).toEqual({ kind: 'offline' });
    expect(seen.ranking).toBe('no');
    expect(seen.community).toBeNull();
    expect(seen.status).toBe('none');
    cloud.state.down = false;
    act(() => network.set(true));
    await waitFor(() => expect(seen.account.state.kind).toBe('guest'));
    expect(seen.ranking).toBe('yes');
  });

  it('says a ranked life cannot be begun now when the network is down, and can when it is back', async () => {
    const cloud = theCloud(member);
    const { seen } = mount(phoneOf(cloud).services);
    await waitFor(() => expect(seen.ranking).toBe('yes'));
    act(() => network.set(false));
    expect(seen.ranking).toBe('offline');
    act(() => network.set(true));
    expect(seen.ranking).toBe('yes');
  });

  it('begins a ranked life on the server when someone is signed in, and counts it as one', async () => {
    const cloud = theCloud(member);
    const { services, counted } = phoneOf(cloud);
    const { seen } = mount(services);
    await waitFor(() => expect(seen.ranking).toBe('yes'));
    await act(async () => void (await seen.start('nurse', { ranked: true })));
    expect(cloud.ranked.state.calls).toContain('start');
    expect(seen.lifeId).toBe('nurse');
    expect(counted).toEqual([{ name: 'life_start', mode: 'ranked' }]);
  });

  it('brings the language kept with an account to the game when someone signs in on this phone', async () => {
    kv.set('ratrace.lastAccount', 'guest-1');
    const cloud = theCloud(member);
    cloud.state.language = 'es';
    const { seen } = mount(phoneOf(cloud).services);
    await waitFor(() => expect(seen.locale).toBe('es'));
    expect(kv.get('ratrace.lastAccount')).toBe('member-1');
  });

  it('leaves the language alone when the same player opens the game again', async () => {
    kv.set('ratrace.lastAccount', 'member-1');
    const cloud = theCloud(member);
    cloud.state.language = 'es';
    const { seen } = mount(phoneOf(cloud).services);
    await waitFor(() => expect(seen.account.state.kind).toBe('member'));
    await settled();
    expect(seen.locale).toBe('en');
  });
});

describe('the account\'s copy of the player\'s things, on the phone', () => {
  /** A phone holding a life of its own that the account has not seen, signed in to an account that has another. */
  async function twoLives() {
    const cloud = theCloud(member);
    const web = await elsewhere(cloud, 'nurse', 4);
    const device = new MemoryStore();
    await play(await new LocalSessions(device, content, lives, depsOf('mine')).start('engineer'), 1);
    const phone = phoneOf(cloud, device);
    const { seen } = mount(phone.services);
    await waitFor(() => expect(seen.saves.offer).not.toBeNull());
    return { cloud, web, phone, seen };
  }

  it('offers the life begun on another device, and never puts it over the phone\'s own behind the player\'s back', async () => {
    const { seen, web, phone } = await twoLives();
    expect(seen.saves.offer).toEqual({ gameId: 'web-1', lifeId: 'nurse', round: 4, cityId: web.session.view().player.cityId } satisfies AccountLife);
    expect(seen.lifeId).toBe('engineer');
    expect(((await phone.device.loadGame()) as SavedGame).lifeId).toBe('engineer');
  });

  it('takes the offered life when the player says so, and opens it as the account has it', async () => {
    const { seen } = await twoLives();
    await act(async () => expect(await seen.saves.takeOffer()).toBe(true));
    expect(seen.lifeId).toBe('nurse');
    expect(seen.round).toBe(4);
    expect(seen.saves.offer).toBeNull();
  });

  it('ends the offered life instead when the player declines it, and keeps the phone\'s', async () => {
    const { seen, cloud } = await twoLives();
    await act(() => seen.saves.declineOffer());
    expect(seen.saves.offer).toBeNull();
    expect(seen.lifeId).toBe('engineer');
    // The account is told the next time the phone reads it: here, the network back.
    act(() => network.set(false));
    act(() => network.set(true));
    await waitFor(() => expect(cloud.state.games.find((game) => game.id === 'web-1')?.status).toBe('abandoned'));
    expect(seen.saves.offer).toBeNull();
  });

  it('keeps the phone\'s copy of a life when it is further on, and sends it to the account', async () => {
    const cloud = theCloud(member);
    const web = await elsewhere(cloud, 'nurse', 1);
    // The same life, played further on the phone than the account has it.
    const device = new MemoryStore();
    await device.saveGame((await web.store.loadGame()) as SavedGame);
    const { session } = await new LocalSessions(device, content, lives, depsOf('mine')).resume();
    await play(session!, 2);
    const { seen } = mount(phoneOf(cloud, device).services);
    await waitFor(() => expect(cloud.state.games[0].round).toBe(3));
    expect(seen.saves.offer).toBeNull();
    expect(seen.round).toBe(3);
  });

  it('opens the account\'s copy of the same life when it is further on, as the phone now has it', async () => {
    const cloud = theCloud(member);
    const web = await elsewhere(cloud, 'nurse', 1);
    const device = new MemoryStore();
    await device.saveGame((await web.store.loadGame()) as SavedGame);
    const { seen } = mount(phoneOf(cloud, device).services);
    await waitFor(() => expect(seen.round).toBe(1));
    await play(web.session, 2);
    await web.mirror.sync();
    // The phone comes back to the front a while later, or its network back: it reads the account, and the life on screen is the further one.
    act(() => network.set(false));
    act(() => network.set(true));
    await waitFor(() => expect(seen.round).toBe(3));
    expect(seen.saves.offer).toBeNull();
  });
});

/** An account whose state the test moves, as a phone coming back from Google finds it, and which remembers what it was asked. */
function accountAt(first: AccountState, keep: (move: (next: AccountState) => void) => Promise<boolean> = async () => true) {
  let state = first;
  const listeners = new Set<() => void>();
  const asked: Array<{ what: string; to?: string; open?: Opener }> = [];
  const move = (next: AccountState) => {
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const account: Account = {
    state: () => state,
    subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    start: async (language) => void asked.push({ what: `start ${language}` }),
    keepWithGoogle: async (to, open) => (asked.push({ what: 'keep', to, open }), keep(move)),
    useExistingAccount: async (to, open) => (asked.push({ what: 'existing', to, open }), true),
    dismissNotice: () => undefined,
    signOut: async () => (asked.push({ what: 'sign out' }), move({ kind: 'offline' }), true),
  };
  return { account, move, asked };
}

/** An account's copy whose status and offer the test moves. */
function savesAt(status: CloudSaving = 'saved') {
  let now = status;
  const listeners = new Set<() => void>();
  const changed = new Set<(what: 'game' | 'renamed' | 'runs') => void>();
  const saves: AccountSaves = {
    status: () => now,
    offer: () => null,
    subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    onDeviceChanged: (listener) => (changed.add(listener as never), () => changed.delete(listener as never)),
    takeOffer: async () => false,
    declineOffer: async () => undefined,
  };
  return {
    saves,
    set: (next: CloudSaving) => ((now = next), [...listeners].forEach((listener) => listener())),
    tell: (what: 'game' | 'renamed' | 'runs') => [...changed].forEach((listener) => listener(what)),
  };
}

const guest: AccountState = { kind: 'guest', userId: 'guest-1', notice: null };

describe('the game, as the account changes under it', () => {
  /** Memory services whose every boot of the round store (it asks for the life in progress) and of the rooms (it asks for the room) is counted. */
  function counting(services = memoryServices()) {
    const asks = { resume: 0, room: 0 };
    const resume = services.sessions.resume.bind(services.sessions);
    services.sessions.resume = () => ((asks.resume += 1), resume());
    return { services: { ...services, rooms: () => ((asks.room += 1), null) }, asks };
  }

  it('asks the device again for its life when someone signs in, and the rooms of whoever is signed in now', async () => {
    const { services, asks } = counting();
    const { account, move } = accountAt({ kind: 'offline' });
    const { seen } = mount({ ...services, account });
    await waitFor(() => expect(seen.status).toBe('none'));
    expect(asks).toEqual({ resume: 1, room: 1 });
    await act(async () => move(guest));
    await waitFor(() => expect(asks).toEqual({ resume: 2, room: 2 }));
    // The same player, kept with Google: still signed in, nothing to ask again.
    await act(async () => move({ kind: 'member', userId: 'guest-1', email: null }));
    expect(asks).toEqual({ resume: 2, room: 2 });
    // Signed out: no one's rooms, and the life on the device is the device's.
    await act(async () => move({ kind: 'offline' }));
    expect(asks).toEqual({ resume: 2, room: 3 });
  });

  it('does not ask again for a life when one is already being played', async () => {
    const { services, asks } = counting();
    const { account, move } = accountAt({ kind: 'offline' });
    const { seen } = mount({ ...services, account });
    await waitFor(() => expect(seen.status).toBe('none'));
    await act(async () => void (await seen.start('nurse')));
    await act(async () => move(guest));
    expect(asks.resume).toBe(1);
    expect(seen.lifeId).toBe('nurse');
  });

  it('opens a life the account brought to the device, and the same life under a new id', async () => {
    const store = new MemoryStore();
    const services = memoryServices(store);
    const { saves, tell } = savesAt();
    const { seen } = mount({ ...services, saves });
    await waitFor(() => expect(seen.status).toBe('none'));
    // Another device's life, written to this one by the account.
    await new LocalSessions(store, content, lives, depsOf('other')).start('engineer');
    await act(async () => tell('game'));
    await waitFor(() => expect(seen.lifeId).toBe('engineer'));
    await new LocalSessions(store, content, lives, depsOf('again')).start('nurse');
    await act(async () => tell('renamed'));
    await waitFor(() => expect(seen.lifeId).toBe('nurse'));
  });

  it('starts as a guest once for each start of the game, in its language', async () => {
    const { account, asked } = accountAt({ kind: 'offline' });
    const { seen } = mount({ ...memoryServices(), account });
    await waitFor(() => expect(seen.status).toBe('none'));
    act(() => seen.setLocale('es'));
    expect(seen.locale).toBe('es');
    expect(asked.map((one) => one.what)).toEqual(['start en']);
  });
});

describe('keeping the account with Google, on the phone', () => {
  it('opens Google over the app and comes back to the app\'s own address, counting the account kept when the guest comes back a member', async () => {
    const counted: Counted[] = [];
    const { account, asked } = accountAt(guest, async (move) => {
      // The note is there while the browser is open.
      expect(kv.get('ratrace:keeping-account')).toBe('1');
      move({ kind: 'member', userId: 'guest-1', email: 'rat@example.com' });
      return true;
    });
    const { seen } = mount({ ...memoryServices(), account, track: (event) => counted.push(event) });
    await act(async () => expect(await seen.account.keepWithGoogle()).toBe(true));
    expect(asked.find((one) => one.what === 'keep')).toEqual({ what: 'keep', to: BACK_FROM_GOOGLE, open: openForGoogle });
    expect(counted).toEqual([{ name: 'account_kept' }]);
    expect(kv.has('ratrace:keeping-account')).toBe(false);
  });

  it('counts nothing when the guest comes back still a guest, told it did not work, or closed the browser', async () => {
    const counted: Counted[] = [];
    let answer: 'failed' | 'closed' = 'failed';
    const { account, move } = accountAt(guest, async (moveTo) => {
      if (answer === 'failed') moveTo({ ...guest, notice: 'failed' });
      return false;
    });
    const { seen } = mount({ ...memoryServices(), account, track: (event) => counted.push(event) });
    await act(async () => void (await seen.account.keepWithGoogle()));
    answer = 'closed';
    await act(async () => void (await seen.account.keepWithGoogle()));
    expect(kv.has('ratrace:keeping-account')).toBe(false);
    // Later signed in some other way: not this guest keeping their account.
    act(() => move({ kind: 'member', userId: 'guest-1', email: null }));
    expect(counted).toEqual([]);
  });

  it('leaves no note behind when the trip breaks on the way', async () => {
    const { account } = accountAt(guest, async () => {
      expect(kv.get('ratrace:keeping-account')).toBe('1');
      throw new Error('the browser could not be opened');
    });
    const { seen } = mount({ ...memoryServices(), account });
    await act(async () => expect(seen.account.keepWithGoogle()).rejects.toThrow('the browser could not be opened'));
    expect(kv.has('ratrace:keeping-account')).toBe(false);
  });

  it('does not count signing in to an account that was already a player\'s', async () => {
    const counted: Counted[] = [];
    kv.set('ratrace:keeping-account', '1');
    const { account, move, asked } = accountAt(guest);
    const { seen } = mount({ ...memoryServices(), account, track: (event) => counted.push(event) });
    await act(async () => void (await seen.account.useExistingAccount()));
    expect(asked.find((one) => one.what === 'existing')).toEqual({ what: 'existing', to: BACK_FROM_GOOGLE, open: openForGoogle });
    act(() => move({ kind: 'member', userId: 'member-1', email: null }));
    expect(counted).toEqual([]);
  });

  it('counts a life begun on the phone, as the life it is', async () => {
    const counted: Counted[] = [];
    const { seen } = mount({ ...memoryServices(), track: (event) => counted.push(event) });
    await waitFor(() => expect(seen.status).toBe('none'));
    await act(async () => void (await seen.start('nurse')));
    expect(counted).toEqual([{ name: 'life_start', mode: 'solo' }]);
  });
});

describe('signing out, on the phone', () => {
  /** Counts the mounts of what is under the provider: a start of the game draws it anew. */
  function Mounts({ into }: { into: { count: number } }) {
    useEffect(() => void (into.count += 1), [into]);
    return null;
  }

  it('takes what the account keeps from the phone, but the settings, and starts the game again with a new guest', async () => {
    const store = new MemoryStore();
    const services = memoryServices(store);
    await services.sessions.start('nurse');
    await store.addRun({ format: SAVE_FORMAT, runId: 'run-1', engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 's', log: [], finishedAt: 1, score: 1, netWorth: 1, status: 1, escapedAtRound: null, bankruptcies: 0, history: [1], badges: [], cities: ['madrid'], verified: false });
    await store.saveProfile({ ...newProfile(), settings: { sound: false, reducedMotion: true }, gallery: ['watch_casio'], guide: { seen: ['news'], off: true } });
    expect((await store.loadProfile()).gallery).toEqual(['watch_casio']);
    const { account, asked } = accountAt(guest);
    const mounts = { count: 0 };
    // What the settings were as each start of the game drew them: the player's, from the first drawing of the second start on.
    const motion: Array<{ reducedMotion: boolean; sound: boolean }> = [];
    function Motion() {
      const { reducedMotion, sound } = useSettings();
      motion.push({ reducedMotion, sound });
      return null;
    }
    // Where the player lands, and when: once the game has been drawn anew.
    const landed: number[] = [];
    router.dismissTo.mockImplementation(() => void landed.push(mounts.count));
    const { seen } = mount(
      { ...services, account },
      <>
        <Mounts into={mounts} />
        <Motion />
      </>,
    );
    await waitFor(() => expect(seen.lifeId).toBe('nurse'));
    expect(mounts.count).toBe(1);
    const drawnBefore = motion.length;
    await act(async () => expect(await seen.account.signOut()).toBe(true));
    expect(await store.loadGame()).toBeNull();
    expect(await store.listRuns()).toEqual([]);
    const profile = await store.loadProfile();
    expect(profile.settings).toEqual({ sound: false, reducedMotion: true });
    expect(profile).toEqual({ ...newProfile(), settings: { sound: false, reducedMotion: true } });
    // The game starts again, as the web's page is loaded again: drawn anew, with no life, and a new guest asked for.
    await waitFor(() => expect(mounts.count).toBe(2));
    await waitFor(() => expect(seen.status).toBe('none'));
    expect(seen.lifeId).toBeNull();
    expect(asked.map((one) => one.what)).toEqual(['start en', 'sign out', 'start en']);
    // On the front door, on purpose, once the game is drawn anew: the stack started again is not left to say where.
    expect(router.dismissTo.mock.calls).toEqual([['/en']]);
    expect(landed).toEqual([2]);
    // The second start drew the player's settings from its first drawing: less motion and no sound never flashed back to their defaults.
    const second = motion.slice(drawnBefore);
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((one) => one.reducedMotion && !one.sound)).toBe(true);
  });

  it('leaves everything as it is when the account could not sign out', async () => {
    const store = new MemoryStore();
    const services = memoryServices(store);
    await services.sessions.start('nurse');
    const { account } = accountAt(guest);
    account.signOut = async () => false;
    const mounts = { count: 0 };
    const { seen } = mount({ ...services, account }, <Mounts into={mounts} />);
    await waitFor(() => expect(seen.lifeId).toBe('nurse'));
    await act(async () => expect(await seen.account.signOut()).toBe(false));
    expect(((await store.loadGame()) as SavedGame).lifeId).toBe('nurse');
    expect(mounts.count).toBe(1);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});

describe('with no cloud (no project in the build, or no services in a test)', () => {
  it('answers what the web answers a guest with no connection: no ranking, no way to sign in, no one to ask, no room, nothing saved or counted', async () => {
    const { seen } = mount(memoryServices());
    const room: { status?: string; members?: unknown } = {};
    function Room() {
      room.status = useRoom((s) => s.status);
      room.members = useRoom((s) => s.room?.members);
      return null;
    }
    const track: { it?: ReturnType<typeof useTrack>; inRoom?: boolean } = {};
    function Rest() {
      track.it = useTrack();
      track.inRoom = useInRoom();
      return null;
    }
    renderGame(
      <>
        <Room />
        <Rest />
      </>,
      memoryServices(),
    );
    await waitFor(() => expect(room.status).toBe('unavailable'));
    expect(room.members).toBeUndefined();
    expect(seen.ranking).toBe('no');
    expect(seen.canSignIn).toBe(false);
    expect(seen.community).toBeNull();
    expect(seen.account.state).toEqual({ kind: 'offline' });
    expect(track.inRoom).toBe(false);
    expect(seen.saves.status).toBe('off');
    expect(seen.saves.offer).toBeNull();
    await expect(seen.saves.takeOffer()).resolves.toBe(false);
    await expect(seen.saves.declineOffer()).resolves.toBeUndefined();
    expect(track.it!({ name: 'share', what: 'card' })).toBeUndefined();
    await expect(seen.account.signOut()).resolves.toBe(false);
  });
});

describe('a life in a room', () => {
  it('is shown to the screens under a scope as the life on screen, and they know it is a room\'s', async () => {
    const roomGame: GameStore = createGameStore({ sessions: memoryServices().sessions, content });
    await roomGame.getState().start('engineer');
    const seen: { lifeId?: string | null; inRoom?: boolean; outside?: boolean } = {};
    function Inside() {
      seen.lifeId = useGame((s) => s.lifeId);
      seen.inRoom = useInRoom();
      return null;
    }
    function Outside() {
      seen.outside = useInRoom();
      return null;
    }
    renderGame(
      <>
        <Outside />
        <GameScope game={roomGame}>
          <Inside />
        </GameScope>
      </>,
      memoryServices(),
    );
    expect(seen.lifeId).toBe('engineer');
    expect(seen.inRoom).toBe(true);
    expect(seen.outside).toBe(false);
  });
});

describe('what the cloud moves draws only what reads it', () => {
  it('draws nothing of the game again when the account, its copy or the room changes: only what reads them', async () => {
    const { account, move } = accountAt(guest);
    const saves = savesAt('sending');
    const count = { game: 0, words: 0, settings: 0, profile: 0, runs: 0, account: 0, saves: 0, room: 0, ranking: 0 };
    let rooms: ReturnType<typeof useRooms> | null = null;
    const counter = (key: keyof typeof count, use: () => unknown) =>
      function Counter() {
        use();
        count[key] += 1;
        return null;
      };
    const Game = counter('game', () => useGame((s) => s.status));
    const Words = counter('words', useWords);
    const Settings = counter('settings', useSettings);
    const Profile = counter('profile', useProfile);
    const Runs = counter('runs', useRuns);
    const Account = counter('account', useAccount);
    const Saves = counter('saves', useAccountSaves);
    const Ranking = counter('ranking', useRanking);
    function Room() {
      rooms = useRooms();
      useRoom((s) => s.busy);
      count.room += 1;
      return null;
    }
    const drawn: Renders = { count: 0 };
    renderGame(
      <>
        <Drawn into={drawn}>
          <Game />
          <Words />
          <Settings />
          <Profile />
          <Runs />
        </Drawn>
        <Account />
        <Saves />
        <Room />
        <Ranking />
      </>,
      { ...memoryServices(), account, saves: saves.saves },
    );
    // Counted from where the game has settled: the drawings stop changing.
    await steady(() => ({ ...count, drawn: drawn.count }));
    const before = { ...count, drawn: drawn.count };
    await settled(() => move({ kind: 'member', userId: 'guest-1', email: 'rat@example.com' }));
    await settled(() => saves.set('saved'));
    await settled(() => rooms!.setState({ busy: true }));
    const ranked = count.ranking;
    await settled(() => network.set(false));
    expect(count.ranking).toBeGreaterThan(ranked);
    expect(count.account).toBeGreaterThan(before.account);
    expect(count.saves).toBeGreaterThan(before.saves);
    expect(count.room).toBeGreaterThan(before.room);
    for (const unmoved of ['game', 'words', 'settings', 'profile', 'runs'] as const) expect(count[unmoved], unmoved).toBe(before[unmoved]);
    expect(drawn.count).toBe(before.drawn);
  });
});

