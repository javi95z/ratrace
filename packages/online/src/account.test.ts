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
  reportErrors: async () => 'sent' as const,
  rankedLife: async () => null,
  giveUpRanked: async () => {},
  // No test of the account plays a ranked life: that has tests of its own.
  ranked: {} as Cloud['ranked'],
  rooms: {} as Cloud['rooms'],
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
    signOut: async () => {
      calls.push('sign-out');
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

  it('takes a guest whose Google account already has a player straight into it, back to the same page, with nothing more to click', async () => {
    const { cloud, calls } = fakeCloud({ currentUser: async () => guest });
    const account = new SupabaseAccount(async () => cloud, () => 'http://localhost:3000/en/play?error_code=identity_already_exists', () => {});
    await account.start('en');
    expect(account.state()).toMatchObject({ kind: 'guest', notice: 'joining' });
    await vi.waitFor(() => expect(calls).toContain('sign-in http://localhost:3000/en/play'));
    expect(calls.filter((call) => call.startsWith('link'))).toEqual([]);
  });

  it('says so when it cannot take the player into their account, and is a guest as before', async () => {
    const { cloud } = fakeCloud({ currentUser: async () => guest, signInWithGoogle: async () => false });
    const account = new SupabaseAccount(async () => cloud, () => 'http://localhost:3000/en?error_code=identity_already_exists', () => {});
    await account.start('en');
    await vi.waitFor(() => expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'failed' }));
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

  it('deletes the account once the server says it is gone, then signs this device out of it', async () => {
    const { cloud, calls } = fakeCloud({ deleteAccount: async () => (calls.push('delete'), true) });
    const account = accountOn(cloud);
    await account.start('en');
    const heard = vi.fn();
    account.subscribe(heard);
    expect(await account.deleteAccount()).toBe(true);
    expect(calls.slice(-2)).toEqual(['delete', 'sign-out']);
    expect(account.state()).toEqual({ kind: 'offline' });
    expect(heard).toHaveBeenCalled();
  });

  it('is signed out of an account that is gone even when signing out says it could not: there is nobody left to be', async () => {
    const { cloud } = fakeCloud({
      deleteAccount: async () => true,
      signOut: async () => {
        throw new Error('no network');
      },
    });
    const account = accountOn(cloud);
    await account.start('en');
    expect(await account.deleteAccount()).toBe(true);
    expect(account.state()).toEqual({ kind: 'offline' });
  });

  it('stays signed in, and says it could not, when the server did not delete the account', async () => {
    const { cloud, calls } = fakeCloud({ currentUser: async () => member, deleteAccount: async () => false });
    const account = accountOn(cloud);
    await account.start('en');
    expect(await account.deleteAccount()).toBe(false);
    expect(calls).not.toContain('sign-out');
    expect(account.state()).toEqual({ kind: 'member', userId: 'user-1', email: 'ana@example.com' });
  });

  it('deletes nothing with nobody signed in, or a cloud that cannot', async () => {
    const asked = vi.fn(async () => true);
    expect(await accountOn(fakeCloud({ deleteAccount: asked }).cloud).deleteAccount()).toBe(false);
    expect(asked).not.toHaveBeenCalled();
    const unable = accountOn(fakeCloud().cloud);
    await unable.start('en');
    expect(await unable.deleteAccount()).toBe(false);
    expect(unable.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    expect(await offlineAccount.deleteAccount?.()).toBe(false);
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

  it('reads from the address, once, that the Google account they chose already has a player, and clears it', async () => {
    const cleaned: string[] = [];
    const { cloud } = fakeCloud({ currentUser: async () => guest });
    const account = new SupabaseAccount(async () => cloud, () => 'http://localhost:3000/en?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user', (url) => cleaned.push(url));
    await account.start('en');
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'joining' });
    expect(cleaned).toEqual(['http://localhost:3000/en']);
    account.dismissNotice();
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
  });
});

describe('an account on a phone, where Google is a browser that comes back', () => {
  /**
   * A cloud that, handed a way to open the browser, opens Google with it and does with the answer
   * what the real one does: a code is a session (the player is now the member it belongs to), anything else is not.
   */
  function phoneCloud(answers: Array<string | null>, over: Partial<Cloud> = {}) {
    const trips: string[] = [];
    let tell: (user: CloudUser | null) => void = () => {};
    const trip = (name: string) => async (returnTo: string, open?: (url: string) => Promise<string | null>) => {
      trips.push(`${name} ${returnTo}`);
      if (open === undefined) return true;
      const back = await open(`https://google/${name}`);
      if (back === null || !back.startsWith(returnTo) || !new URL(back).searchParams.has('code')) return false;
      tell(member);
      return true;
    };
    const made = fakeCloud({ currentUser: async () => guest, linkGoogle: trip('link'), signInWithGoogle: trip('sign-in'), ...over });
    tell = made.tell;
    const opened: string[] = [];
    const open = async (url: string) => (opened.push(url), answers.shift() ?? null);
    return { ...made, trips, opened, open };
  }
  /** A phone has no address: nothing to read a notice from, and nothing to clean. */
  const onPhone = (cloud: Cloud, cleaned: string[] = []) => new SupabaseAccount(async () => cloud, () => null, (url) => cleaned.push(url));

  it('starts with no address at all, as a guest, and cleans nothing', async () => {
    const cleaned: string[] = [];
    const { cloud, calls } = fakeCloud();
    const account = onPhone(cloud, cleaned);
    await account.start('es');
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    expect(calls).toEqual(['guest', 'profile user-1 es']);
    expect(cleaned).toEqual([]);
  });

  it('keeps the account with Google and says so once the browser comes back with a code', async () => {
    const { cloud, trips, opened, open } = phoneCloud(['theratrace://auth?code=X']);
    const account = onPhone(cloud);
    await account.start('en');
    expect(await account.keepWithGoogle('theratrace://auth', open)).toBe(true);
    expect(trips).toEqual(['link theratrace://auth']);
    expect(opened).toEqual(['https://google/link']);
    expect(account.state()).toEqual({ kind: 'member', userId: 'user-1', email: 'ana@example.com' });
  });

  it('takes a guest whose Google account already has a player into it, as the web does, with nothing more to tap', async () => {
    const { cloud, trips, open } = phoneCloud(['theratrace://auth?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked', 'theratrace://auth?code=Y']);
    const account = onPhone(cloud);
    await account.start('en');
    const seen: unknown[] = [];
    account.subscribe(() => seen.push(account.state()));
    expect(await account.keepWithGoogle('theratrace://auth', open)).toBe(true);
    // The web's words for it while the browser goes on into that account, and never a second link.
    expect(seen).toContainEqual({ kind: 'guest', userId: 'user-1', notice: 'joining' });
    expect(trips).toEqual(['link theratrace://auth', 'sign-in theratrace://auth']);
    expect(account.state()).toEqual({ kind: 'member', userId: 'user-1', email: 'ana@example.com' });
  });

  it('says it failed when Google comes back with any other error, and is a guest as before', async () => {
    const { cloud, open } = phoneCloud(['theratrace://auth?error=access_denied&error_code=provider_disabled']);
    const account = onPhone(cloud);
    await account.start('en');
    expect(await account.keepWithGoogle('theratrace://auth', open)).toBe(false);
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'failed' });
  });

  it('says nothing when the player closes the browser, and is a guest as before', async () => {
    const { cloud, open } = phoneCloud([null]);
    const account = onPhone(cloud);
    await account.start('en');
    const heard = vi.fn();
    account.subscribe(heard);
    expect(await account.keepWithGoogle('theratrace://auth', open)).toBe(false);
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    expect(heard).not.toHaveBeenCalled();
  });

  it('takes back the word that it is joining when the player closes the browser on the way into their account', async () => {
    const { cloud, open } = phoneCloud(['theratrace://auth?error_code=identity_already_exists', null]);
    const account = onPhone(cloud);
    await account.start('en');
    expect(await account.keepWithGoogle('theratrace://auth', open)).toBe(false);
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
  });

  it('says it failed when the browser could not be opened at all, or the trip could not begin', async () => {
    const broken = phoneCloud([]);
    const account = onPhone(broken.cloud);
    await account.start('en');
    expect(await account.keepWithGoogle('theratrace://auth', async () => { throw new Error('no browser'); })).toBe(false);
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'failed' });
    account.dismissNotice();
    const refused = phoneCloud([], { linkGoogle: async () => false });
    const other = onPhone(refused.cloud);
    await other.start('en');
    expect(await other.keepWithGoogle('theratrace://auth', refused.open)).toBe(false);
    expect(refused.opened).toEqual([]);
    expect(other.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'failed' });
  });

  it('hears nothing from an address it did not send the browser back to: no session, no word said', async () => {
    for (const back of ['https://evil/?code=X', 'https://evil/?error_code=identity_already_exists', 'https://evil/?error=access_denied']) {
      const { cloud, trips, open } = phoneCloud([back]);
      const account = onPhone(cloud);
      await account.start('en');
      const heard = vi.fn();
      account.subscribe(heard);
      expect(await account.keepWithGoogle('theratrace://auth', open), back).toBe(false);
      expect(trips, back).toEqual(['link theratrace://auth']);
      expect(account.state(), back).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
      expect(heard, back).not.toHaveBeenCalled();
    }
  });

  it('opens the browser once for a second call while a trip is under way, and answers both with that trip', async () => {
    let comeBack: (address: string | null) => void = () => {};
    const { cloud, trips } = phoneCloud([]);
    const opened: string[] = [];
    const open = (url: string) => new Promise<string | null>((resolve) => {
      opened.push(url);
      comeBack = resolve;
    });
    const account = onPhone(cloud);
    await account.start('en');
    const first = account.keepWithGoogle('theratrace://auth', open);
    const second = account.keepWithGoogle('theratrace://auth', open);
    const third = account.useExistingAccount('theratrace://auth', open);
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    comeBack('theratrace://auth?code=X');
    expect(await Promise.all([first, second, third])).toEqual([true, true, true]);
    expect(trips).toEqual(['link theratrace://auth']);
    // Once back, a new call is a new trip.
    const again = phoneCloud(['theratrace://auth?code=Y']);
    expect(await account.keepWithGoogle('theratrace://auth', again.open)).toBe(true);
    expect(again.opened).toHaveLength(1);
  });

  it('lets the listeners hear the word taken back when a trip ends kept and the cloud has not yet said who the player is', async () => {
    const { cloud, open } = phoneCloud(['theratrace://auth?error_code=identity_already_exists', 'theratrace://auth?code=Y'], { signInWithGoogle: async (_returnTo, opener) => (await opener?.('https://google/sign-in')) !== null });
    const account = onPhone(cloud);
    await account.start('en');
    const seen: unknown[] = [];
    account.subscribe(() => seen.push(account.state()));
    expect(await account.keepWithGoogle('theratrace://auth', open)).toBe(true);
    expect(seen).toEqual([{ kind: 'guest', userId: 'user-1', notice: 'joining' }, { kind: 'guest', userId: 'user-1', notice: null }]);
  });

  it('signs in as the player a Google account belongs to, on a second phone', async () => {
    const { cloud, trips, open } = phoneCloud(['theratrace://auth?code=Z']);
    const account = onPhone(cloud);
    await account.start('en');
    expect(await account.useExistingAccount('theratrace://auth', open)).toBe(true);
    expect(trips).toEqual(['sign-in theratrace://auth']);
    expect(account.state()).toMatchObject({ kind: 'member' });
  });

  it('hands the web\'s calls to the cloud as they always were: an address and nothing else', async () => {
    const asked: unknown[][] = [];
    const { cloud } = fakeCloud({
      linkGoogle: async (...args) => (asked.push(['link', ...args]), true),
      signInWithGoogle: async (...args) => (asked.push(['sign-in', ...args]), true),
    });
    const account = accountOn(cloud);
    await account.start('en');
    await account.keepWithGoogle('http://localhost:3000/es/play');
    await account.useExistingAccount('http://localhost:3000/es');
    expect(asked).toStrictEqual([['link', 'http://localhost:3000/es/play'], ['sign-in', 'http://localhost:3000/es']]);
  });
});

describe('reading what Google sent the player back with', () => {
  it('knows an account that is already someone else\'s from any other failure, in the query or after the hash', () => {
    expect(noticeIn('http://x/en?error_code=identity_already_exists')).toBe('taken');
    expect(noticeIn('http://x/en#error=server_error&error_code=identity_already_exists')).toBe('taken');
    expect(noticeIn('http://x/en?error=access_denied&error_code=provider_disabled')).toBe('failed');
    expect(noticeIn('http://x/en?error=access_denied')).toBe('failed');
    // The address a phone comes back to.
    expect(noticeIn('theratrace://auth?error=server_error&error_code=identity_already_exists')).toBe('taken');
    expect(noticeIn('theratrace://auth?code=X')).toBeNull();
  });

  it('finds nothing in an ordinary address, whatever else it carries', () => {
    expect(noticeIn('http://x/en')).toBeNull();
    expect(noticeIn('http://x/en/play?code=abc')).toBeNull();
    expect(noticeIn('http://x/en?errors=1#top')).toBeNull();
    expect(noticeIn('not an address')).toBeNull();
  });
});

describe('an account on a phone with its own Google sign-in, no browser', () => {
  /** A cloud that takes Google's ID tokens: `taken` names the tokens of a Google account already a player's. */
  function tokenCloud({ taken = [] as string[], refuses = false } = {}) {
    const asked: string[] = [];
    let tell: (user: CloudUser | null) => void = () => {};
    const made = fakeCloud({
      currentUser: async () => guest,
      linkGoogleToken: async (token) => {
        asked.push(`link ${token}`);
        if (refuses) return 'failed';
        if (taken.includes(token)) return 'taken';
        tell(member);
        return 'linked';
      },
      signInWithGoogleToken: async (token) => {
        asked.push(`sign-in ${token}`);
        if (refuses) return false;
        tell(member);
        return true;
      },
    });
    tell = made.tell;
    return { ...made, asked };
  }
  const onPhone = (cloud: Cloud, google: () => Promise<string | 'cancelled' | null>) => new SupabaseAccount(async () => cloud, () => null, () => {}, google);
  const neverOpened = async () => {
    throw new Error('no browser is opened where the phone asks Google itself');
  };

  it('keeps a guest\'s account with the Google account chosen on the phone, and opens no browser', async () => {
    const { cloud, asked, calls } = tokenCloud();
    const account = onPhone(cloud, async () => 'token-A');
    await account.start('en');
    expect(await account.keepWithGoogle('theratrace://auth', neverOpened)).toBe(true);
    expect(asked).toEqual(['link token-A']);
    expect(calls.filter((call) => call.startsWith('link ') || call.startsWith('sign-in '))).toEqual([]);
    expect(account.state()).toEqual({ kind: 'member', userId: 'user-1', email: 'ana@example.com' });
  });

  it('takes a guest whose Google account already has a player into it, with the same choice and nothing more to tap', async () => {
    const { cloud, asked } = tokenCloud({ taken: ['token-B'] });
    const account = onPhone(cloud, async () => 'token-B');
    await account.start('en');
    const seen: unknown[] = [];
    account.subscribe(() => seen.push(account.state()));
    expect(await account.keepWithGoogle('theratrace://auth', neverOpened)).toBe(true);
    expect(seen).toContainEqual({ kind: 'guest', userId: 'user-1', notice: 'joining' });
    expect(asked).toEqual(['link token-B', 'sign-in token-B']);
  });

  it('signs in to an existing account with the Google account chosen', async () => {
    const { cloud, asked } = tokenCloud();
    const account = onPhone(cloud, async () => 'token-C');
    await account.start('en');
    expect(await account.useExistingAccount('theratrace://auth', neverOpened)).toBe(true);
    expect(asked).toEqual(['sign-in token-C']);
  });

  it('says nothing when the player closes the chooser, and says it failed when the cloud will not take the token', async () => {
    const closed = tokenCloud();
    const account = onPhone(closed.cloud, async () => 'cancelled');
    await account.start('en');
    expect(await account.keepWithGoogle('theratrace://auth', neverOpened)).toBe(false);
    expect(account.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: null });
    expect(closed.asked).toEqual([]);
    const refused = tokenCloud({ refuses: true });
    const other = onPhone(refused.cloud, async () => 'token-D');
    await other.start('en');
    expect(await other.keepWithGoogle('theratrace://auth', neverOpened)).toBe(false);
    expect(other.state()).toEqual({ kind: 'guest', userId: 'user-1', notice: 'failed' });
  });

  it('goes to Google through the browser, as it always did, where the phone cannot ask it itself', async () => {
    const { cloud, calls } = tokenCloud();
    const account = onPhone(cloud, async () => null);
    await account.start('en');
    const opened: string[] = [];
    await account.keepWithGoogle('theratrace://auth', async (url) => (opened.push(url), null));
    expect(calls).toContain('link theratrace://auth');
  });
});
