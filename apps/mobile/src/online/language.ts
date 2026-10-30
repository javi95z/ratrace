import { isLocale } from '@ratrace/i18n/locales';
import type { Locale } from '@ratrace/i18n/locales';
import type { Page } from '@ratrace/online/follow';
import type { Account, Community } from '@ratrace/online/types';

/*
 * The language of an account and the language of the game, each told to the other only when it means something. The player's choice (the settings,
 * the front door's menu) goes to the account, guest or member, through a note on the device (`languageChoices`), so that it outlasts no network and the
 * web's leaving for a page in that language. An account's language comes to the game when someone signs in, only where a player chose it
 * (`Community.me`) and no choice is still waiting on the device (`followAccountLanguage`, the web's apps/web/src/online/language.ts, but that a phone
 * has no address to put the language in), and nothing is written back for it: the language a profile was first opened in is nobody's choice. The notes
 * are handed in: the device's store is named only by the game's context.
 */

/** Where the device notes the language the player chose, until the account says it kept it. */
export interface LanguageNote {
  read(): string | null;
  write(language: string): void;
  clear(): void;
}

/** The player's choices of a language, on their way to the account. */
export interface LanguageChoices {
  /** The player chose a language: noted at once, sent as soon as someone is signed in to be told. */
  choose(language: string): void;
  /** Whether a choice is still to reach the account: then it wins over the account's. */
  waiting(): boolean;
  /** Sends what is noted now, and again when someone signs in, the connection comes back or the app is in front again. Returns how to stop. */
  keepSending(page: Pick<Page, 'onOnline' | 'onShown'>): () => void;
}

export function languageChoices(account: Account, community: () => Community | null, note: LanguageNote): LanguageChoices {
  let sending = false;
  /** One at a time, however many ask. What changed while one was on its way (another choice, another player) is sent after it. */
  const send = async () => {
    if (sending) return;
    sending = true;
    try {
      for (;;) {
        const language = note.read();
        if (language === null) return;
        if (!isLocale(language)) return note.clear();
        const state = account.state();
        const asked = state.kind === 'offline' ? null : community();
        if (state.kind === 'offline' || !asked?.setLanguage) return;
        const kept = await asked.setLanguage(language).catch(() => false);
        const changed = note.read() !== language;
        if (!kept && !changed) return;
        const now = account.state();
        if (!changed && (now.kind === 'offline' || now.userId === state.userId)) return note.clear();
      }
    } finally {
      sending = false;
    }
  };
  return {
    choose: (language) => {
      note.write(language);
      void send();
    },
    waiting: () => note.read() !== null,
    keepSending: (page) => {
      const again = () => void send();
      again();
      const stops = [account.subscribe(again), page.onOnline(again), page.onShown(again)];
      return () => stops.forEach((stop) => stop());
    },
  };
}

/** Where the phone notes whose account it last saw signed in. */
export interface LastAccount {
  read(): string | null;
  write(userId: string): void;
}

/**
 * The language to change to as someone signs in: the one chosen and kept with their account, when this device
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
 * guest's is this device's own. A choice still waiting on the device (`waiting`) wins: it is what the
 * player asked for last, and it is on its way to this account. Returns how to stop.
 */
export function followAccountLanguage(account: Account, community: () => Community | null, showing: string, last: LastAccount, go: (language: Locale) => void, waiting: () => boolean): () => void {
  let live = true;
  const look = () => {
    const state = account.state();
    if (state.kind === 'offline') return;
    const before = last.read();
    last.write(state.userId);
    if (state.kind !== 'member' || before === null || before === state.userId || waiting()) return;
    void community()
      ?.me()
      .then((me) => {
        const to = languageOnSignIn({ before, now: state.userId, kept: me?.language ?? null, showing });
        if (live && to !== null && !waiting()) go(to);
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
