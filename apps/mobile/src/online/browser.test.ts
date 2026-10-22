import { describe, expect, it } from 'vitest';
import { authBrowser } from '../testing/fakes';
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
});
