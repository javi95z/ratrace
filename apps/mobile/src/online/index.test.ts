import { readFileSync } from 'node:fs';
import { offlineAccount } from '@ratrace/online/offline';
import Storage from 'expo-sqlite/kv-store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KvStore, kvSession } from '../kvStore';
import { servers } from '../testing/cloudServers';
import { appState, kv } from '../testing/fakes';
import type { Cloud, SupabaseAccount } from '@ratrace/online/supabase';
import { forgetThePhone, givenUpIn, onThePhone, phoneOnline, refusedIn } from './index';

/*
 * The phone's cloud: the twin of the web's (apps/web/src/online/index.ts). What can be the web's, word for word, is held to it below; the rest is
 * the phone's own: its session kept in its key-value store, renewed only while the app is in front, and no project named, no cloud at all.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
/** The text of a file from where `from` begins to where `to` begins. */
function part(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start);
  expect(start, from).toBeGreaterThanOrEqual(0);
  expect(end, to).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('the phone\'s cloud is the web\'s', () => {
  const web = read('../../../web/src/online/index.ts');
  const phone = read('./index.ts');

  it('holds the game\'s cloud as the web does, word for word: what it is, what it is made of, and how it is put together', () => {
    const twin = part(web, '/** What the game gets of the cloud', '/**\n * Watches what goes wrong');
    // A phone has no address: Google comes back to it with the browser instead.
    const asThePhone = twin.replace('  address(): string;\n', '  address(): string | null;\n');
    expect(asThePhone).not.toBe(twin);
    expect(phone).toContain(asThePhone);
  });

  it('notes the lives given up and the lives refused as the web does, in the phone\'s store', () => {
    const twin = part(web, '/**\n * A list of ids a browser keeps', '/** What the browser tells of the page. */');
    const asThePhone = twin.replaceAll('(storage: () => Storage)', '(storage: () => KeptText)').replace('(storage: () => Storage,', '(storage: () => KeptText,');
    expect(asThePhone.match(/KeptText/g)).toHaveLength(3);
    expect(phone).toContain(asThePhone);
  });

  it('keeps those lists under the web\'s keys, and reads a list it cannot read as none', () => {
    const store = { getItem: (key: string) => kv.get(key) ?? null, setItem: (key: string, value: string) => void kv.set(key, value) };
    givenUpIn(() => store).write(['life-1']);
    refusedIn(() => store).write(['life-2']);
    expect(kv.get('ratrace:given-up')).toBe('["life-1"]');
    expect(kv.get('ratrace:refused')).toBe('["life-2"]');
    kv.set('ratrace:given-up', 'not a list');
    expect(givenUpIn(() => store).read()).toEqual([]);
  });
});

const URL_OF_PROJECT = 'https://abcdefghijklmnop.supabase.co';
/** A build of the app with a project named. */
function configured() {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', URL_OF_PROJECT);
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
  const cloud = servers();
  vi.stubGlobal('fetch', cloud.fetch);
  return cloud;
}
/** The app's start: the account starting, and its first reads settled. */
const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
  // The client's renewal of the session stops with the app sent away, so nothing of one test runs in the next.
  appState.set('background');
  // Each test is a start of the app of its own.
  forgetThePhone();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('the cloud of this phone', () => {
  it('is none at all in a build with no project: the store is the phone\'s own, and the game is phase 2\'s', () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const device = new KvStore();
    const online = phoneOnline(device);
    expect(online.account).toBe(offlineAccount);
    expect(online.store).toBe(device);
    expect(online.saves).toBeNull();
    expect(online.ranked()).toBeNull();
    expect(online.rooms()).toBeNull();
    expect(online.community()).toBeNull();
    // Half a project is no project.
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', URL_OF_PROJECT);
    expect(phoneOnline(device).account).toBe(offlineAccount);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    expect(phoneOnline(device).account).toBe(offlineAccount);
  });

  it('answers that nothing is sent where there is no project to send it to', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    expect(await phoneOnline(new KvStore()).reportErrors([])).toBe('never');
  });

  it('puts the account behind the phone\'s store in a build with a project, and reaches nobody until the account starts', () => {
    const cloud = configured();
    const device = new KvStore();
    const online = phoneOnline(device);
    expect(online.store).not.toBe(device);
    expect(online.saves).toBe(online.store);
    expect(cloud.asked).toEqual([]);
  });

  it('keeps the guest made on one start for the next: the same player comes back, never a new guest each launch', async () => {
    const cloud = configured();
    const first = phoneOnline(new KvStore());
    await first.account.start('en');
    expect(first.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    await settled();
    // The session is in the phone's store, under the app's own keys.
    const kept = (await Storage.getAllKeys()).filter((key) => key.startsWith('ratrace:session:'));
    expect(kept.length).toBeGreaterThan(0);
    expect([...kv.keys()].filter((key) => key.includes('auth-token'))).toEqual(kept.filter((key) => key.includes('auth-token')));

    // The app closed and opened again: a new client, the same store.
    appState.set('background');
    const next = phoneOnline(new KvStore());
    appState.set('active');
    await next.account.start('en');
    expect(next.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    expect(cloud.guests()).toBe(1);
    expect(cloud.asked.filter((one) => one === 'POST /auth/v1/signup')).toHaveLength(1);
  });

  it('forgets the session when the player signs out: every key of it gone from the phone', async () => {
    configured();
    const online = phoneOnline(new KvStore());
    await online.account.start('en');
    await settled();
    expect([...kv.keys()].some((key) => key.startsWith('ratrace:session:'))).toBe(true);
    // A trip to Google the player closed leaves its proof behind, under a key of the trip's own: the client forgets only the keys it knows of.
    kv.set('ratrace:session:sb-abcdefghijklmnop-auth-token-code-verifier-flow-1', 'proof');
    kv.set('ratrace:game', '{"a life":"kept"}');
    expect(await online.account.signOut()).toBe(true);
    expect([...kv.keys()].filter((key) => key.startsWith('ratrace:session:'))).toEqual([]);
    // What is the game's, not the session's, is the game's to take away (Task 3's sign-out clears the device).
    expect(kv.get('ratrace:game')).toBe('{"a life":"kept"}');
    expect(online.account.state()).toEqual({ kind: 'offline' });
  });

  it('is signed out all the same when a key of the session cannot be taken away: never a guest with no session behind it', async () => {
    configured();
    const online = phoneOnline(new KvStore());
    await online.account.start('en');
    vi.spyOn(kvSession, 'clear').mockRejectedValueOnce(new Error('the store would not'));
    expect(await online.account.signOut()).toBe(true);
    expect(online.account.state()).toEqual({ kind: 'offline' });
  });

  it('starts as a new guest, and does not throw, when what is kept of the session cannot be read', async () => {
    const cloud = configured();
    kv.set('ratrace:session:sb-abcdefghijklmnop-auth-token', '{not a session');
    const online = phoneOnline(new KvStore());
    await expect(online.account.start('en')).resolves.toBeUndefined();
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    expect(cloud.guests()).toBe(1);
  });

  it('renews one client in the whole app, however many clouds are made: the one connected last', async () => {
    configured();
    const first = phoneOnline(new KvStore());
    await first.account.start('en');
    const before = (first.account as SupabaseAccount).cloud()!;
    const stopped = vi.spyOn(before, 'autoRefresh');
    const second = phoneOnline(new KvStore());
    await second.account.start('en');
    // Connecting the second stopped the first, though each was made by a cloud of its own.
    expect(stopped).toHaveBeenCalledWith(false);
    const renewing = vi.spyOn((second.account as SupabaseAccount).cloud()!, 'autoRefresh');
    stopped.mockClear();
    appState.set('background');
    appState.set('active');
    expect(stopped).not.toHaveBeenCalled();
    expect(renewing.mock.calls).toEqual([[false], [true]]);
  });

  it('renews the session only while the app is in front', async () => {
    configured();
    const online = phoneOnline(new KvStore());
    await online.account.start('en');
    const cloud = (online.account as SupabaseAccount).cloud();
    expect(cloud).not.toBeNull();
    const renewing = vi.spyOn(cloud!, 'autoRefresh');
    appState.set('background');
    appState.set('active');
    expect(renewing.mock.calls).toEqual([[false], [true]]);
  });

  it('renews one client at a time: a start that connects anew stops the one before, so two never renew the same session', () => {
    const told: string[] = [];
    const cloudOf = (name: string) => ({ autoRefresh: async (on: boolean) => void told.push(`${name} ${on}`), signOut: async () => undefined }) as unknown as Cloud;
    const phone = onThePhone();
    phone.connected(cloudOf('first'));
    phone.connected(cloudOf('second'));
    appState.set('background');
    expect(told).toEqual(['first true', 'first false', 'second true', 'second false']);
    // Connected while the app is away, it is not renewed until the app is in front.
    phone.connected(cloudOf('third'));
    appState.set('active');
    expect(told.slice(4)).toEqual(['second false', 'third false', 'third true']);
    // Stopped (a test's new start of the app): the client is stopped, and the app is no longer listened to.
    const listening = appState.listeners.size;
    phone.stop();
    expect(told.slice(7)).toEqual(['third false']);
    expect(appState.listeners.size).toBe(listening - 1);
    appState.set('background');
    appState.set('active');
    expect(told).toHaveLength(8);
  });

  it('is offline, and plays, when the phone has no connection as it starts', async () => {
    configured();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Network request failed');
    }));
    const online = phoneOnline(new KvStore());
    await online.account.start('en');
    expect(online.account.state()).toEqual({ kind: 'offline' });
    expect(online.ranked()).toBeNull();
  });
});
