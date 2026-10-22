import { describe, expect, it, vi } from 'vitest';
import { appState, authBrowser } from '../testing/fakes';
import { BACK_FROM_GOOGLE, openForGoogle } from './browser';

/*
 * Google on the phone: the system's browser is opened over the app (`expo-web-browser`'s auth session) and comes back to the app's own address,
 * with what Google said in it. The account (packages/online, `SupabaseAccount.travel`) reads that address as the web reads the page it came back to.
 */

describe('the browser Google is opened in', () => {
  it('comes back to the app\'s own address, and hands it over whole', async () => {
    authBrowser.answer = { type: 'success', url: 'theratrace://auth?code=X' };
    expect(await openForGoogle('https://project.supabase.co/auth/v1/authorize?provider=google')).toBe('theratrace://auth?code=X');
    expect(authBrowser.opened).toEqual([{ url: 'https://project.supabase.co/auth/v1/authorize?provider=google', redirect: BACK_FROM_GOOGLE }]);
    expect(BACK_FROM_GOOGLE).toBe('theratrace://auth');
  });

  it('comes back with nothing when the player closes it, or it is closed for them', async () => {
    for (const type of ['cancel', 'dismiss'] as const) {
      authBrowser.answer = { type };
      expect(await openForGoogle('https://google'), type).toBeNull();
    }
  });

  it('opens a second trip only once the app is in front again: on Android the browser holds the first until then', async () => {
    authBrowser.android = true;
    authBrowser.queued.push(fromGoogle('taken'), fromGoogle('code=X'));
    expect(await openForGoogle('https://google/1')).toBe('theratrace://auth?taken');
    // Sent back to the app, which is not in front yet: the second waits for it, and is not refused.
    appState.set('background');
    const second = openForGoogle('https://google/2');
    await tick();
    expect(authBrowser.opened).toHaveLength(1);
    appState.set('active');
    expect(await second).toBe('theratrace://auth?code=X');
    expect(authBrowser.opened).toHaveLength(2);
    expect(authBrowser.refused).toBe(0);
  });

  it('waits three seconds at most for the app to come to the front, then opens Google all the same, and leaves nothing listening', async () => {
    vi.useFakeTimers();
    try {
      authBrowser.answer = fromGoogle('code=X');
      // Behind, and never told it is in front again.
      appState.set('background');
      const trip = openForGoogle('https://google');
      await vi.advanceTimersByTimeAsync(2_990);
      expect(authBrowser.opened).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(20);
      expect(authBrowser.opened).toHaveLength(1);
      expect(await trip).toBe('theratrace://auth?code=X');
      expect(appState.listeners.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops listening for the app in front once it is, and leaves no timer behind', async () => {
    vi.useFakeTimers();
    try {
      authBrowser.answer = fromGoogle('code=X');
      appState.set('background');
      const trip = openForGoogle('https://google');
      await vi.advanceTimersByTimeAsync(10);
      appState.set('active');
      await vi.advanceTimersByTimeAsync(1);
      expect(await trip).toBe('theratrace://auth?code=X');
      expect(appState.listeners.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tries a refused trip once more when the app next comes to the front', async () => {
    authBrowser.android = true;
    authBrowser.queued.push(fromGoogle('taken'), fromGoogle('code=X'));
    await openForGoogle('https://google/1');
    // In front all along, as far as the app knows: the browser still holds the first trip, and refuses.
    const second = openForGoogle('https://google/2');
    await waitUntil(() => authBrowser.refused === 1);
    appState.set('active');
    expect(await second).toBe('theratrace://auth?code=X');
    expect(authBrowser.refused).toBe(1);
  });

  it('gives up after a second refusal, and never tries a third time: the account says it could not sign in', async () => {
    authBrowser.android = true;
    authBrowser.stubborn = 5;
    authBrowser.queued.push(fromGoogle('taken'));
    await openForGoogle('https://google/1');
    const second = openForGoogle('https://google/2');
    await waitUntil(() => authBrowser.refused === 1);
    appState.set('active');
    await expect(second).rejects.toThrow('WebBrowser is already open');
    expect(authBrowser.refused).toBe(2);
    appState.set('active');
    await tick();
    expect(authBrowser.refused).toBe(2);
    expect(authBrowser.opened).toHaveLength(1);
  });
});

/** The browser coming back to the app's address, with this after it. */
const fromGoogle = (rest: string) => ({ type: 'success', url: `theratrace://auth?${rest}` }) as const;
const tick = () => new Promise((done) => setTimeout(done, 5));
async function waitUntil(done: () => boolean) {
  for (let i = 0; i < 200 && !done(); i++) await tick();
  expect(done()).toBe(true);
}
