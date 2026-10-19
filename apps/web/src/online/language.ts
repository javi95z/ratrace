import { routing } from '@/i18n/routing';
import type { Account, Community } from '@ratrace/online/types';

/** Where this device notes whose account it last saw signed in. */
const LAST_ACCOUNT = 'ratrace.lastAccount';

function readLast(): string | null {
  try {
    return window.localStorage.getItem(LAST_ACCOUNT);
  } catch {
    return null;
  }
}

function writeLast(userId: string): void {
  try {
    window.localStorage.setItem(LAST_ACCOUNT, userId);
  } catch {
    // A browser that keeps nothing: the language is simply not brought over on its next sign-in.
  }
}

/**
 * The language to change to as someone signs in: the one kept with their account, when this device
 * was showing someone else (a guest of its own, most often) a moment ago and shows another language.
 * Nothing when the device has never noted anyone: a page opened for the first time since this was
 * added has no sign-in to tell from an ordinary start.
 */
export function languageOnSignIn(input: { before: string | null; now: string; kept: string | null; showing: string }): string | null {
  if (input.before === null || input.before === input.now) return null;
  if (input.kept === null || !(routing.locales as readonly string[]).includes(input.kept)) return null;
  return input.kept === input.showing ? null : input.kept;
}

/** The address of this page in another language: the same page, the language at its start changed. */
export function inLanguage(path: string, language: string): string {
  const [, first = '', ...rest] = path.split('/');
  const tail = (routing.locales as readonly string[]).includes(first) ? rest : [first, ...rest].filter((part) => part !== '');
  return `/${[language, ...tail].join('/')}`.replace(/\/$/, '') || `/${language}`;
}

/**
 * Brings the language of the account to the page when someone signs in on this device, and keeps a
 * note of who is signed in for next time. Only a member's account has a language worth following: a
 * guest's is this device's own. Returns how to stop.
 */
export function followAccountLanguage(account: Account, community: () => Community | null, showing: string, go: (address: string) => void): () => void {
  let live = true;
  const look = () => {
    const state = account.state();
    if (state.kind === 'offline') return;
    const before = readLast();
    writeLast(state.userId);
    if (state.kind !== 'member' || before === null || before === state.userId) return;
    void community()
      ?.me()
      .then((me) => {
        const to = languageOnSignIn({ before, now: state.userId, kept: me?.language ?? null, showing });
        if (live && to !== null) go(inLanguage(window.location.pathname, to) + window.location.search);
      });
  };
  look();
  const stop = account.subscribe(look);
  return () => {
    live = false;
    stop();
  };
}
