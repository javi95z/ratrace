// @vitest-environment jsdom
import { CONTENT_VERSION } from '@ratrace/content';
import { MemoryStore } from '@ratrace/core/session/memory';
import { ENGINE_VERSION } from '@ratrace/engine';
import * as connect from '@ratrace/online/connect';
import type { CloudOptions } from '@ratrace/online/connect';
import { browserOf } from '@ratrace/online/errors';
import { offlineAccount } from '@ratrace/online/offline';
import type { Cloud, SupabaseAccount } from '@ratrace/online/supabase';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserOnline } from '../../../web/src/online/index';
import { kvText } from '../kvStore.web';
import { accountCloud } from '../testing/accountCloud';
import { servers } from '../testing/cloudServers';
import { backFromGoogle } from './browser.web';
import { forgetThePhone, givenUpIn, phoneOnline, phonesCloud, refusedIn } from './index.web';

/*
 * The web export's cloud (index.web.ts): the Next web's (apps/web/src/online/index.ts), so that a player signed in there, a guest or with Google,
 * is the same player here after the swap. The client is the package's own, made as the Next web makes it: no storage of the app's (supabase-js keeps
 * the session in localStorage under its own key, `sb-<ref>-auth-token`), its own renewal, the code of Google's answer read from the address.
 */

vi.mock('@ratrace/online/connect', async (original) => {
  const real = await original<typeof import('@ratrace/online/connect')>();
  return { ...real, connectSupabase: vi.fn(real.connectSupabase) };
});
const connectSupabase = vi.mocked(connect.connectSupabase);

const REF = 'abcdefghijklmnop';
const URL_OF_PROJECT = `https://${REF}.supabase.co`;
/** A build of the app with a project named (and the Next web's, the same project), its servers in memory. */
function configured() {
  for (const prefix of ['EXPO_PUBLIC', 'NEXT_PUBLIC']) {
    vi.stubEnv(`${prefix}_SUPABASE_URL`, URL_OF_PROJECT);
    vi.stubEnv(`${prefix}_SUPABASE_PUBLISHABLE_KEY`, 'sb_publishable_x');
  }
  const cloud = servers();
  vi.stubGlobal('fetch', cloud.fetch);
  return cloud;
}
/** The account's cloud in memory, as the next connect hands it over. */
function connectsTo(cloud: Cloud = accountCloud().cloud): Cloud {
  connectSupabase.mockResolvedValueOnce(cloud);
  return cloud;
}
/** The real client the account of a cloud connected. */
const clientOf = (online: { account: unknown }): Cloud => (online.account as SupabaseAccount).cloud()!;
/** The page at an address of the site's own. */
const at = (path: string) => window.history.replaceState(null, '', path);

/** The real clients made by a test, stopped after it, so none renews a session into the next. */
const made: Cloud[] = [];
afterEach(async () => {
  for (const cloud of made.splice(0)) await cloud.autoRefresh?.(false).catch(() => undefined);
  forgetThePhone();
  connectSupabase.mockClear();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  at('/');
});

describe('the web\'s cloud keeps what the Next web keeps', () => {
  it('keeps the lists of lives the account is still to be told of under the Next web\'s keys, in the browser\'s localStorage', () => {
    givenUpIn(() => kvText).write(['life-1']);
    refusedIn(() => kvText).write(['life-2']);
    expect(localStorage.getItem('ratrace:given-up')).toBe('["life-1"]');
    expect(localStorage.getItem('ratrace:refused')).toBe('["life-2"]');
  });
});

describe('the cloud of this browser', () => {
  it('is none at all in a build with no project: the store is the device\'s own, and nothing is sent', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
    const device = new MemoryStore();
    const online = phoneOnline(device);
    expect(online.account).toBe(offlineAccount);
    expect(online.store).toBe(device);
    expect(online.saves).toBeNull();
    expect(await online.reportErrors([])).toBe('never');
    expect(connectSupabase).not.toHaveBeenCalled();
  });

  it('connects as the Next web does: the project, its region and the guard at the door, and no storage nor renewal of its own', async () => {
    configured();
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_REGION', 'eu-west-3');
    connectsTo();
    await phoneOnline(new MemoryStore()).account.start('en');
    expect(connectSupabase).toHaveBeenCalledTimes(1);
    const [url, key, options] = connectSupabase.mock.calls[0] as [string, string, CloudOptions];
    expect([url, key]).toEqual([URL_OF_PROJECT, 'sb_publishable_x']);
    expect(Object.keys(options).sort()).toEqual(['captcha', 'region']);
    expect(options.region).toBe('eu-west-3');
    // No site key, no guard: a guest is made with no word, as on the Next web.
    expect(options.captcha).toBeUndefined();
    forgetThePhone();

    vi.stubEnv('EXPO_PUBLIC_TURNSTILE_SITE_KEY', '0x4AAAAAAA');
    connectsTo();
    await phoneOnline(new MemoryStore()).account.start('en');
    const [, , guarded] = connectSupabase.mock.calls[1] as [string, string, CloudOptions];
    expect(guarded).not.toHaveProperty('storage');
    expect(guarded).not.toHaveProperty('autoRefresh');
    expect(typeof guarded.captcha).toBe('function');
  });

  it('finds the session the Next web keeps, under the client\'s own key: the same guest, never a new one', async () => {
    const cloud = configured();
    const next = browserOnline(new MemoryStore());
    await next.account.start('en');
    made.push(clientOf(next));
    expect(next.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    expect(localStorage.getItem(`sb-${REF}-auth-token`)).not.toBeNull();

    // The swap: the same browser, the same origin, the app's web build in place of the Next web.
    const app = phoneOnline(new MemoryStore());
    await app.account.start('en');
    made.push(clientOf(app));
    expect(app.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    expect(cloud.guests()).toBe(1);
    expect(cloud.asked.filter((one) => one === 'POST /auth/v1/signup')).toHaveLength(1);
    // Nothing of the app's own beside it: the session is the client's key alone.
    expect(Object.keys(localStorage).filter((key) => key.includes('auth-token'))).toEqual([`sb-${REF}-auth-token`]);
  });

  it('keeps a session the Next web finds, the other way round', async () => {
    const cloud = configured();
    const app = phoneOnline(new MemoryStore());
    await app.account.start('en');
    made.push(clientOf(app));
    const next = browserOnline(new MemoryStore());
    await next.account.start('en');
    made.push(clientOf(next));
    expect(next.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: null });
    expect(cloud.guests()).toBe(1);
  });

  it('reads Google\'s answer from the page\'s whole address, as the Next web does, and takes it from the address with the history', async () => {
    connectsTo();
    configured();
    at('/en/account?tab=1&error=access_denied&error_description=No');
    const replace = vi.spyOn(window.history, 'replaceState');
    const online = phoneOnline(new MemoryStore());
    await online.account.start('en');
    expect(online.account.state()).toEqual({ kind: 'guest', userId: 'guest-1', notice: 'failed' });
    expect(replace).toHaveBeenCalledWith(window.history.state, '', 'http://localhost:3000/en/account?tab=1');
    expect(window.location.href).toBe('http://localhost:3000/en/account?tab=1');
  });

  it('reads an answer that came after the hash too: a Google account that is a player\'s already takes the guest into it', async () => {
    const signedInWithGoogle = vi.fn(async () => true);
    connectsTo({ ...accountCloud().cloud, signInWithGoogle: signedInWithGoogle });
    configured();
    at('/en/account#error=server_error&error_code=identity_already_exists');
    const online = phoneOnline(new MemoryStore());
    await online.account.start('en');
    expect(online.account.state()).toMatchObject({ kind: 'guest', notice: 'joining' });
    expect(window.location.href).toBe('http://localhost:3000/en/account');
    // Straight on into it, by the Next web's road: the page leaves for Google and comes back to where it is.
    expect(signedInWithGoogle).toHaveBeenCalledWith('http://localhost:3000/en/account');
  });

  it('lands back from Google on the page with a code: the client exchanges it once, keeps the session under its own key, and cleans the address', async () => {
    const cloud = configured();
    // The page the guest asks from: the page leaves for Google (jsdom cannot leave, and says so) and the trip's verifier stays in the browser.
    const left = vi.spyOn(console, 'error').mockImplementation(() => {});
    at('/en/account?tab=1');
    const before = phoneOnline(new MemoryStore());
    await before.account.start('en');
    made.push(clientOf(before));
    expect(before.account.state()).toMatchObject({ kind: 'guest', userId: 'guest-1' });
    expect(await before.account.keepWithGoogle(backFromGoogle())).toBe(true);
    expect(cloud.asked).toContain('GET /auth/v1/user/identities/authorize');
    left.mockRestore();
    forgetThePhone();

    // Google sends the browser back to the page it left, with a code: a new load of the page, the app's web drawn anew over it.
    const back = cloud.google.back() as string;
    expect(new URL(back).searchParams.get('code')).toBe('google-code-1');
    at(back);
    const after = phoneOnline(new MemoryStore());
    await after.account.start('en');
    made.push(clientOf(after));

    // The guest's own player, now with Google: the code exchanged once, and no new guest made.
    expect(after.account.state()).toEqual({ kind: 'member', userId: 'guest-1', email: 'ana@example.com' });
    expect(cloud.asked.filter((one) => one === 'POST /auth/v1/token?grant_type=pkce')).toHaveLength(1);
    expect(cloud.guests()).toBe(1);
    // The session under supabase-js's own key, the Next web's, and the trip's verifier used up (supabase-js keeps its list of trips as it does on
    // the Next web, the same library).
    expect(Object.keys(localStorage).filter((key) => key.startsWith('sb-') && !key.endsWith('-code-verifier'))).toEqual([`sb-${REF}-auth-token`]);
    expect(localStorage.getItem(`sb-${REF}-auth-token-code-verifier`)).toBeNull();
    expect(JSON.parse(localStorage.getItem(`sb-${REF}-auth-token`) as string)).toMatchObject({ user: { id: 'guest-1', is_anonymous: false } });
    // The address the page was on, the code taken out of it.
    expect(window.location.href).toBe('http://localhost:3000/en/account?tab=1');

    // Drawn again on the same address, nothing is exchanged twice.
    forgetThePhone();
    const again = phoneOnline(new MemoryStore());
    await again.account.start('en');
    made.push(clientOf(again));
    expect(again.account.state()).toMatchObject({ kind: 'member', userId: 'guest-1' });
    expect(cloud.asked.filter((one) => one === 'POST /auth/v1/token?grant_type=pkce')).toHaveLength(1);
  });

  it('counts through the client the account connected last, and forgets it with the app', async () => {
    configured();
    const cloud = connectsTo();
    expect(phonesCloud()).toBeNull();
    await phoneOnline(new MemoryStore()).account.start('en');
    expect(phonesCloud()?.currentUser).toBe(cloud.currentUser);
    forgetThePhone();
    expect(phonesCloud()).toBeNull();
  });
});

describe('the errors of the page', () => {
  /** A signed-in account whose cloud keeps what it was sent; the page's clock the test's. */
  async function watched(production = true) {
    if (production) vi.stubEnv('NODE_ENV', 'production');
    configured();
    const reportErrors = vi.fn(async () => 'sent' as const);
    connectsTo({ ...accountCloud().cloud, reportErrors });
    const online = phoneOnline(new MemoryStore());
    await online.account.start('en');
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    return reportErrors;
  }
  // Told as a script's error is (its message, where it was): one with no listener of the page's own would be the test runner's to raise.
  const fail = (message: string) => window.dispatchEvent(new ErrorEvent('error', { message, filename: 'https://theratrace.com/_expo/static/js/web/entry.js', lineno: 1, colno: 2 }));

  it('are heard from the window in production, and sent with the page\'s path for their place, the game\'s build and the browser', async () => {
    const reportErrors = await watched();
    at('/en/play?life=1#top');
    fail('boom');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reportErrors).toHaveBeenCalledTimes(1);
    expect(reportErrors.mock.calls[0]).toEqual([[expect.objectContaining({ message: 'boom', place: '/en/play', build: `${ENGINE_VERSION}/${CONTENT_VERSION}`, browser: browserOf(navigator.userAgent) })]]);
  });

  it('say the commit the site was built from, where the build was told it', async () => {
    vi.stubEnv('EXPO_PUBLIC_VERCEL_GIT_COMMIT_SHA', '0123456789abcdef');
    const reportErrors = await watched();
    window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', { promise: Promise.resolve(), reason: new Error('lost') }));
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reportErrors.mock.calls[0]).toEqual([[expect.objectContaining({ message: 'unhandled: lost', build: `${ENGINE_VERSION}/${CONTENT_VERSION} 0123456`, place: '/' })]]);
  });

  it('are the developer\'s to read out of production: nothing is heard, nothing sent', async () => {
    const reportErrors = await watched(false);
    fail('boom');
    await vi.advanceTimersByTimeAsync(10_000);
    expect(reportErrors).not.toHaveBeenCalled();
  });
});
