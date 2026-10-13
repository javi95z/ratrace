// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '@/session/memory';
import { browserOnline } from './index';
import { offlineAccount } from './offline';

const connected = vi.hoisted(() => [] as unknown[][]);
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
    expect(connected).toEqual([['https://project.supabase.co', 'sb_publishable_x']]);
    // It could not connect: the game is offline, and plays.
    expect(online.account.state()).toEqual({ kind: 'offline' });
  });

  it('keeps the note of lives given up where a closed page does not lose it, and reads nonsense there as nothing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    window.localStorage.setItem('ratrace:given-up', '{not json');
    expect(() => browserOnline(new MemoryStore())).not.toThrow();
    window.localStorage.setItem('ratrace:given-up', JSON.stringify(['a-1', 7, null]));
    expect(() => browserOnline(new MemoryStore())).not.toThrow();
  });
});
