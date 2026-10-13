// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@/session/memory';
import { browserOnline, browserPage, givenUpIn } from './index';
import { offlineAccount } from './offline';

const connected = vi.hoisted(() => [] as unknown[][]);
// The guard at the door, as this test knows it: by the site it was made for.
vi.mock('./captcha', () => ({ turnstile: (siteKey: string) => `the guard of ${siteKey}` }));
vi.mock('./connect', () => ({
  connectSupabase: async (...values: unknown[]) => {
    connected.push(values);
    throw new Error('no network in a test');
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  connected.length = 0;
  window.localStorage.clear();
});

describe('the cloud of this browser', () => {
  it('is none at all in a build with no project: the store is the device\'s own', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
    const device = new MemoryStore();
    const online = browserOnline(device);
    expect(online.account).toBe(offlineAccount);
    expect(online.store).toBe(device);
    expect(online.saves).toBeNull();
    // Half a project is no project.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    expect(browserOnline(device).store).toBe(device);
  });

  it('puts the account behind the device\'s store in a build with a project, and connects with its two public values only when the account starts', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    const device = new MemoryStore();
    const online = browserOnline(device);
    expect(online.store).not.toBe(device);
    expect(online.saves).toBe(online.store);
    expect(online.saves?.status()).toBe('off');
    expect(connected).toEqual([]);
    // What is written goes to the device whether or not there is anyone to send it to.
    const profile = await online.store.loadProfile();
    await online.store.saveProfile({ ...profile, gallery: ['watch_casio'] });
    expect((await device.loadProfile()).gallery).toEqual(['watch_casio']);

    await online.account.start('en');
    expect(connected).toEqual([['https://project.supabase.co', 'sb_publishable_x', { region: undefined, captcha: undefined }]]);
    // Nobody is signed in: there is no server of ranked lives to ask.
    expect(online.ranked()).toBeNull();
    // It could not connect: the game is offline, and plays.
    expect(online.account.state()).toEqual({ kind: 'offline' });
  });

  it('names the region of the database to the connection when the build names it, and offers no ranked lives with no project', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_REGION', 'ap-northeast-1');
    await browserOnline(new MemoryStore()).account.start('en');
    expect(connected).toEqual([['https://project.supabase.co', 'sb_publishable_x', { region: 'ap-northeast-1', captcha: undefined }]]);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(browserOnline(new MemoryStore()).ranked()).toBeNull();
  });

  it('puts a guard at the door of guest sign-in only in a build that names its site key', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '0x4AAAAAAA');
    await browserOnline(new MemoryStore()).account.start('en');
    expect(connected).toEqual([['https://project.supabase.co', 'sb_publishable_x', { region: undefined, captcha: 'the guard of 0x4AAAAAAA' }]]);
    // An empty value is no key.
    connected.length = 0;
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
    await browserOnline(new MemoryStore()).account.start('en');
    expect(connected).toEqual([['https://project.supabase.co', 'sb_publishable_x', { region: undefined, captcha: undefined }]]);
  });

  it('keeps the note of lives given up where a closed page does not lose it, and reads nonsense there as nothing', () => {
    const note = givenUpIn(() => window.localStorage);
    expect(note.read()).toEqual([]);
    note.write(['a-1', 'a-2']);
    // Another page of the same browser reads what this one wrote.
    expect(givenUpIn(() => window.localStorage).read()).toEqual(['a-1', 'a-2']);
    window.localStorage.setItem('ratrace:given-up', '{not json');
    expect(note.read()).toEqual([]);
    window.localStorage.setItem('ratrace:given-up', JSON.stringify(['a-1', 7, null, 'a-3']));
    expect(note.read()).toEqual(['a-1', 'a-3']);
    window.localStorage.setItem('ratrace:given-up', JSON.stringify({ not: 'a list' }));
    expect(note.read()).toEqual([]);
  });

  it('plays on in a browser that keeps nothing: the note is simply not kept', () => {
    const none = givenUpIn(() => {
      throw new Error('storage is disabled');
    });
    expect(none.read()).toEqual([]);
    expect(() => none.write(['a-1'])).not.toThrow();
  });

  it('notes a life given up while there is nobody to tell, through the store the game writes to', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    const { content, lives } = await import('@ratrace/content');
    const { LocalSessions } = await import('@/session/local');
    const online = browserOnline(new MemoryStore());
    let ids = 0;
    const sessions = new LocalSessions(online.store, content, lives, { newId: () => `life-${(ids += 1)}`, newSeed: () => 'seed', now: () => ids });
    await sessions.start('nurse');
    await sessions.start('engineer');
    expect(givenUpIn(() => window.localStorage).read()).toEqual(['life-1']);
  });
});

describe('what the page tells of itself', () => {
  it('says when the connection comes back, until told to stop', () => {
    let heard = 0;
    const stop = browserPage.onOnline(() => (heard += 1));
    window.dispatchEvent(new Event('online'));
    expect(heard).toBe(1);
    stop();
    window.dispatchEvent(new Event('online'));
    expect(heard).toBe(1);
  });

  it('says when the page comes back to the front, and not when it goes to the back', () => {
    let heard = 0;
    let state = 'hidden';
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => state as DocumentVisibilityState);
    const stop = browserPage.onShown(() => (heard += 1));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(heard).toBe(0);
    state = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(heard).toBe(1);
    stop();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(heard).toBe(1);
    visibility.mockRestore();
    expect(browserPage.now()).toBeGreaterThan(1_700_000_000_000);
  });
});
