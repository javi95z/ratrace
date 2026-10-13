import { describe, expect, it, vi } from 'vitest';
import { offlineAccount } from './offline';
import { noticeIn, SupabaseAccount } from './supabase';
import type { Cloud, CloudUser } from './supabase';

const guest: CloudUser = { id: 'user-1', is_anonymous: true, email: undefined };
/** The account tests are about who is signed in; what syncs is the mirror's business and has its own tests. */
const NO_SYNC = {
  playingGames: async () => [],
  pushGame: async () => 'saved' as const,
  abandonGame: async () => {},
  loadProgress: async () => null,
  saveProgress: async () => {},
  listRuns: async () => [],
  finishRun: async () => 'done' as const,
  rankedLife: async () => null,
  giveUpRanked: async () => {},
  // No test of the account plays a ranked life: that has tests of its own.
  ranked: {} as Cloud['ranked'],
  community: {} as Cloud['community'],
};
const member: CloudUser = { id: 'user-1', is_anonymous: false, email: 'ana@example.com' };

/** A cloud that remembers what it was asked, and answers as told. */
function fakeCloud(over: Partial<Cloud> = {}) {
  let onChange: (user: CloudUser | null) => void = () => {};
  const calls: string[] = [];
  const cloud: Cloud = {
    currentUser: async () => null,
    signInAsGuest: async () => {
      calls.push('guest');
      return guest;
    },
    linkGoogle: async (redirectTo) => {
      calls.push(`link ${redirectTo}`);
      return true;
    },
    signInWithGoogle: async (redirectTo) => {
      calls.push(`sign-in ${redirectTo}`);
      return true;
    },
    ensureProfile: async (userId, language) => {
      calls.push(`profile ${userId} ${language}`);
    },
    onUser: (listener) => {
      onChange = listener;
      return () => {
        onChange = () => {};
      };
    },
    ...NO_SYNC,
    ...over,
  };
  return { cloud, calls, tell: (user: CloudUser | null) => onChange(user) };
}
const accountOn = (cloud: Cloud | (() => Promise<Cloud>), url = 'http://localhost:3000/en') => new SupabaseAccount(typeof cloud === 'function' ? cloud : async () => cloud, () => url, () => {});

describe('the account of a build with no project', () => {
  it('is offline, does nothing, and says it could not begin', async () => {
    expect(offlineAccount.state()).toEqual({ kind: 'offline' });
    await offlineAccount.start('en');
    expect(offlineAccount.state()).toEqual({ kind: 'offline' });
    expect(await offlineAccount.keepWithGoogle('http://localhost:3000')).toBe(false);
    expect(await offlineAccount.useExistingAccount('http://localhost:3000')).toBe(false);
    offlineAccount.subscribe(() => {})();
    // Whoever watches the state must be handed the same object while nothing has changed.
    expect(offlineAccount.state()).toBe(offlineAccount.state());
  });
});

describe('an account in the cloud', () => {
  it('signs in as a guest on first launch, without a form, and makes the player a profile', async () => {
    const { cloud, calls } = fakeCloud();
    const account = accountOn(cloud);
    expect(account.state()).toEqual({ kind: 'offline' });
    const heard = vi.fn();
    account.subscribe(heard);
    await account.start('es');
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    expect(calls).toEqual(['guest', 'profile user-1 es']);
    expect(heard).toHaveBeenCalled();
  });

  it('carries on as whoever is already signed in, and makes no second guest', async () => {
    const { cloud, calls } = fakeCloud({ currentUser: async () => member });
    const account = accountOn(cloud);
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'member', userId: 'user-1', email: 'ana@example.com' });
    expect(calls).toEqual(['profile user-1 en']);
  });

  it('stays offline, silently, when the cloud cannot be reached or refuses', async () => {
    for (const cloud of [
      fakeCloud({ signInAsGuest: async () => null }).cloud,
      fakeCloud({ currentUser: async () => { throw new Error('no network'); } }).cloud,
      fakeCloud({ signInAsGuest: async () => { throw new Error('limit reached'); } }).cloud,
    ]) {
      const account = accountOn(cloud);
      await expect(account.start('en')).resolves.toBeUndefined();
      expect(account.state()).toEqual({ kind: 'offline' });
    }
    // The library itself may fail to load.
    const account = accountOn(async () => { throw new Error('chunk failed'); });
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'offline' });
    expect(await account.keepWithGoogle('http://localhost:3000')).toBe(false);
  });

  it('does not make a new guest when the cloud cannot say who is signed in: the player it has stored must survive', async () => {
    // A stored session whose renewal failed: asking who is signed in fails, it does not answer "nobody".
    const { cloud, calls } = fakeCloud({ currentUser: async () => { throw new Error('token endpoint answered 503'); } });
    const account = accountOn(cloud);
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'offline' });
    expect(calls).not.toContain('guest');
  });

  it('can be started again after a failure, and then signs in', async () => {
    let reachable = false;
    const { cloud, calls } = fakeCloud();
    const account = accountOn(async () => {
      if (!reachable) throw new Error('no network');
      return cloud;
    });
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'offline' });
    reachable = true;
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    // Started once more while signed in: nothing is done twice.
    await account.start('en');
    expect(calls.filter((call) => call === 'guest')).toHaveLength(1);
  });

  it('tries again in the language it was started in, when asked to, and only if nobody is signed in', async () => {
    let network = false;
    let tried = 0;
    const { cloud, calls } = fakeCloud();
    const account = new SupabaseAccount(async () => {
      tried += 1;
      if (!network) throw new Error('no network');
      return cloud;
    }, () => 'http://localhost/es', () => {});
    // Never started: there is nothing to try again, and it does not so much as load the client.
    await account.again();
    expect(tried).toBe(0);
    expect(account.state()).toEqual({ kind: 'offline' });
    await account.start('es');
    expect(account.state()).toEqual({ kind: 'offline' });
    network = true;
    await account.again();
    expect(account.state()).toMatchObject({ kind: 'guest', userId: 'user-1' });
    expect(calls).toEqual(['guest', 'profile user-1 es']);
    // Signed in: asked again, it makes no second guest.
    await account.again();
    expect(calls.filter((call) => call === 'guest')).toHaveLength(1);
  });

  it('can be handed to whoever watches it as loose functions', async () => {
    const { cloud } = fakeCloud();
    const account = accountOn(cloud);
    const { state, subscribe, start, dismissNotice } = account;
    const heard = vi.fn();
    const stop = subscribe(heard);
    await start('en');
    expect(state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    expect(heard).toHaveBeenCalled();
    dismissNotice();
    stop();
  });

  it('signs in as the player a Google account already belongs to, when asked', async () => {
    const { cloud, calls } = fakeCloud({ currentUser: async () => guest });
    const account = new SupabaseAccount(async () => cloud, () => 'http://localhost:3000/en?error_code=identity_already_exists', () => {});
    await account.start('en');
    expect(account.state()).toMatchObject({ kind: 'guest', notice: 'taken' });
    expect(await account.useExistingAccount('http://localhost:3000/en')).toBe(true);
    expect(calls).toContain('sign-in http://localhost:3000/en');
  });

  it('is still a guest when the profile cannot be written: the row is made on a later launch', async () => {
    const { cloud } = fakeCloud({ ensureProfile: async () => { throw new Error('offline'); } });
    const account = accountOn(cloud);
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
  });

  it('starts once however often it is asked', async () => {
    const { cloud, calls } = fakeCloud();
    const account = accountOn(cloud);
    await Promise.all([account.start('en'), account.start('en'), account.start('en')]);
    expect(calls.filter((call) => call === 'guest')).toHaveLength(1);
  });

  it('sends a guest to Google and back to where they were', async () => {
    const { cloud, calls } = fakeCloud();
    const account = accountOn(cloud);
    await account.start('en');
    expect(await account.keepWithGoogle('http://localhost:3000/es/play')).toBe(true);
    expect(calls).toContain('link http://localhost:3000/es/play');
  });

  it('says so when Google could not even be reached, and is a guest as before', async () => {
    const { cloud } = fakeCloud({ linkGoogle: async () => false });
    const account = accountOn(cloud);
    await account.start('en');
    expect(await account.keepWithGoogle('http://localhost:3000')).toBe(false);
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'failed' });
  });

  it('becomes a member, with the same id, when the cloud says the account was kept', async () => {
    const { cloud, tell } = fakeCloud();
    const account = accountOn(cloud);
    await account.start('en');
    const heard = vi.fn();
    account.subscribe(heard);
    tell(member);
    expect(account.state()).toEqual({ kind: 'member', userId: 'user-1', email: 'ana@example.com' });
    expect(heard).toHaveBeenCalledTimes(1);
    // Signed out elsewhere: back to playing on this device alone.
    tell(null);
    expect(account.state()).toEqual({ kind: 'offline' });
  });

  it('tells a guest, once, that the Google account they chose already has a player, and clears the address', async () => {
    const cleaned: string[] = [];
    const { cloud } = fakeCloud({ currentUser: async () => guest });
    const account = new SupabaseAccount(async () => cloud, () => 'http://localhost:3000/en?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user', (url) => cleaned.push(url));
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'taken' });
    expect(cleaned).toEqual(['http://localhost:3000/en']);
    account.dismissNotice();
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
  });
});

describe('reading what Google sent the player back with', () => {
  it('knows an account that is already someone else\'s from any other failure, in the query or after the hash', () => {
    expect(noticeIn('http://x/en?error_code=identity_already_exists')).toBe('taken');
    expect(noticeIn('http://x/en#error=server_error&error_code=identity_already_exists')).toBe('taken');
    expect(noticeIn('http://x/en?error=access_denied&error_code=provider_disabled')).toBe('failed');
    expect(noticeIn('http://x/en?error=access_denied')).toBe('failed');
  });

  it('finds nothing in an ordinary address, whatever else it carries', () => {
    expect(noticeIn('http://x/en')).toBeNull();
    expect(noticeIn('http://x/en/play?code=abc')).toBeNull();
    expect(noticeIn('http://x/en?errors=1#top')).toBeNull();
    expect(noticeIn('not an address')).toBeNull();
  });
});
