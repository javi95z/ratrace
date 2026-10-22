import { describe, expect, it, vi } from 'vitest';
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { followAccountLanguage, languageOnSignIn } from './language';
import type { LastAccount } from './language';

/*
 * The web's cases (apps/web/src/online/language.test.ts), on the phone: the language is set in the game, not put in an address. (The web's file
 * is not run here: it names the web's routing, which the phone's build does not resolve.)
 */

/** An account whose state the test moves along. */
function accountAt(first: AccountState) {
  let state = first;
  const listeners = new Set<() => void>();
  const account = { state: () => state, subscribe: (listener: () => void) => (listeners.add(listener), () => listeners.delete(listener)) } as unknown as Account;
  return { account, become: (next: AccountState) => ((state = next), listeners.forEach((listener) => listener())) };
}

const keeping = (language: string | null) => () => ({ me: async () => ({ nickname: null, friendCode: 'X', avatar: null, language }) }) as unknown as Community;
const noted = (first: string | null = null): LastAccount & { now: string | null } => {
  const last = { now: first, read: () => last.now, write: (id: string) => void (last.now = id) };
  return last;
};

describe('the language of an account', () => {
  it('is brought to the game by a sign-in, not by an ordinary start, as on the web', () => {
    const cases = [
      { before: 'guest-1', now: 'member-1', kept: 'es', showing: 'en' },
      // The same player, kept with Google, or simply opening the game again.
      { before: 'member-1', now: 'member-1', kept: 'es', showing: 'en' },
      // A device that never noted anyone cannot tell a sign-in from a start.
      { before: null, now: 'member-1', kept: 'es', showing: 'en' },
      // Already in it, or a language the game does not speak.
      { before: 'guest-1', now: 'member-1', kept: 'en', showing: 'en' },
      { before: 'guest-1', now: 'member-1', kept: 'fr', showing: 'en' },
      { before: 'guest-1', now: 'member-1', kept: null, showing: 'en' },
    ];
    expect(cases.map(languageOnSignIn)).toEqual(['es', null, null, null, null, null]);
  });

  it('changes the game\'s language when a guest of this phone signs in to an account kept in another', async () => {
    const { account, become } = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const go = vi.fn();
    const last = noted();
    followAccountLanguage(account, keeping('es'), 'en', last, go);
    expect(last.now).toBe('guest-1');
    expect(go).not.toHaveBeenCalled();
    become({ kind: 'member', userId: 'member-1', email: null });
    await vi.waitFor(() => expect(go).toHaveBeenCalledWith('es'));
    expect(last.now).toBe('member-1');
  });

  it('leaves the language alone for a member who was already signed in here, and once stopped', async () => {
    const { account } = accountAt({ kind: 'member', userId: 'member-1', email: null });
    const go = vi.fn();
    followAccountLanguage(account, keeping('es'), 'en', noted('member-1'), go);
    const other = accountAt({ kind: 'guest', userId: 'guest-1', notice: null });
    const stop = followAccountLanguage(other.account, keeping('es'), 'en', noted(), go);
    other.become({ kind: 'member', userId: 'member-2', email: null });
    stop();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(go).not.toHaveBeenCalled();
  });
});
