// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { followAccountLanguage, inLanguage, languageOnSignIn } from './language';
import type { Account, AccountState, Community } from './types';

afterEach(() => window.localStorage.clear());

/** An account whose state the test moves along. */
function accountAt(first: AccountState) {
  let state = first;
  const listeners = new Set<() => void>();
  const account = { state: () => state, subscribe: (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener)) } as unknown as Account;
  return { account, become: (next: AccountState) => ((state = next), listeners.forEach((listener) => listener())) };
}

const keeping = (language: string | null) => () => ({ me: async () => ({ nickname: null, friendCode: 'X', avatar: null, language }) }) as unknown as Community;

describe('the language of an account', () => {
  it('is brought to the page by a sign-in, not by an ordinary start', () => {
    expect(languageOnSignIn({ before: 'guest-1', now: 'member-1', kept: 'es', showing: 'en' })).toBe('es');
    // The same player, kept with Google, or simply opening the game again.
    expect(languageOnSignIn({ before: 'member-1', now: 'member-1', kept: 'es', showing: 'en' })).toBeNull();
    // A device that never noted anyone cannot tell a sign-in from a start.
    expect(languageOnSignIn({ before: null, now: 'member-1', kept: 'es', showing: 'en' })).toBeNull();
    // Already in it, or a language the game does not speak.
    expect(languageOnSignIn({ before: 'guest-1', now: 'member-1', kept: 'en', showing: 'en' })).toBeNull();
    expect(languageOnSignIn({ before: 'guest-1', now: 'member-1', kept: 'fr', showing: 'en' })).toBeNull();
  });

  it('is the same page in another language', () => {
    expect(inLanguage('/en/play', 'es')).toBe('/es/play');
    expect(inLanguage('/en', 'ru')).toBe('/ru');
    expect(inLanguage('/', 'es')).toBe('/es');
    expect(inLanguage('/player', 'es')).toBe('/es/player');
  });

  it('changes the page when a guest of this device signs in to an account kept in another language', async () => {
    const { account, become } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const go = vi.fn();
    followAccountLanguage(account, keeping('es'), 'en', go);
    expect(go).not.toHaveBeenCalled();
    become({ kind: 'member', userId: 'member-1', email: null });
    await vi.waitFor(() => expect(go).toHaveBeenCalledWith('/es'));
  });

  it('leaves the page alone for a member who was already signed in here', async () => {
    window.localStorage.setItem('ratrace.lastAccount', 'member-1');
    const { account } = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const go = vi.fn();
    followAccountLanguage(account, keeping('es'), 'en', go);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(go).not.toHaveBeenCalled();
  });
});
