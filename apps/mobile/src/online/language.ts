import { isLocale } from '@ratrace/i18n';
import type { Locale } from '@ratrace/i18n';
import type { Account, Community } from '@ratrace/online/types';

/*
 * The language of an account brought to the phone when someone signs in on it: the web's (apps/web/src/online/language.ts), but that a phone has
 * no address to put the language in. It is set in the game instead (`setLocale`), which keeps it as the player's choice. Where the phone notes
 * whose account it last saw is handed in: the phone's store is named only by the game's context.
 */

/** Where the phone notes whose account it last saw signed in. */
export interface LastAccount {
  read(): string | null;
  write(userId: string): void;
}

/**
 * The language to change to as someone signs in: the one kept with their account, when this device
 * was showing someone else (a guest of its own, most often) a moment ago and shows another language.
 * Nothing when the device has never noted anyone: an app opened for the first time since this was
 * added has no sign-in to tell from an ordinary start.
 */
export function languageOnSignIn(input: { before: string | null; now: string; kept: string | null; showing: string }): Locale | null {
  if (input.before === null || input.before === input.now) return null;
  if (!isLocale(input.kept)) return null;
  return input.kept === input.showing ? null : input.kept;
}

/**
 * Brings the language of the account to the game when someone signs in on this phone, and keeps a
 * note of who is signed in for next time. Only a member's account has a language worth following: a
 * guest's is this device's own. Returns how to stop.
 */
export function followAccountLanguage(account: Account, community: () => Community | null, showing: string, last: LastAccount, go: (language: Locale) => void): () => void {
  let live = true;
  const look = () => {
    const state = account.state();
    if (state.kind === 'offline') return;
    const before = last.read();
    last.write(state.userId);
    if (state.kind !== 'member' || before === null || before === state.userId) return;
    void community()
      ?.me()
      .then((me) => {
        const to = languageOnSignIn({ before, now: state.userId, kept: me?.language ?? null, showing });
        if (live && to !== null) go(to);
      })
      .catch(() => undefined);
  };
  look();
  const stop = account.subscribe(look);
  return () => {
    live = false;
    stop();
  };
}
