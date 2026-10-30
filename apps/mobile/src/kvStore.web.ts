import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { MemoryStore } from '@ratrace/core/session/memory';
import { readProfile } from '@ratrace/core/session/profile';
import { readRuns } from '@ratrace/core/session/runs';
import type { FinishedRun, PlayerStore, Profile, StoredGame } from '@ratrace/core/session/types';
import type { LanguageKeep } from './game/locale';
import type { BasketText } from './game/phoneBasket';
import type { ReviewMemory } from './game/reviewTimes';

/*
 * The web export's twin of `kvStore.ts` (Metro picks it for the web). The app on the web keeps the player's things where the Next web keeps them,
 * under the same names, so that a player who opens the app where the Next web was finds their lives as they left them: the same IndexedDB, the
 * same localStorage and sessionStorage keys, the same cookie. Nothing here is the phone's SQLite store.
 */

/** The Next web's database. */
const DATABASE = 'ratrace';
const GAME = 'currentGame';
const RUNS = 'runs';
const PROFILE = 'profile';
const ONLY = 'only';

/** Opens the Next web's database, made as it makes it the first time. */
const openDatabase = (name: string): Promise<IDBPDatabase> =>
  openDB(name, 1, {
    upgrade(db) {
      db.createObjectStore(GAME);
      db.createObjectStore(RUNS, { keyPath: 'runId' });
      db.createObjectStore(PROFILE);
    },
  });

/** The Next web's database, written again here: the app does not depend on `apps/web`. Three stores: the game in progress, the finished lives, the profile. */
class Indexed implements PlayerStore {
  private opened: Promise<IDBPDatabase> | null = null;

  constructor(private readonly name: string) {}

  private db(): Promise<IDBPDatabase> {
    this.opened ??= openDatabase(this.name).catch((error: unknown) => {
      // A browser that refused to open it may take it later: the next call tries again.
      this.opened = null;
      throw error;
    });
    return this.opened;
  }

  async loadGame(): Promise<unknown> {
    return (await (await this.db()).get(GAME, ONLY)) ?? null;
  }
  async saveGame(game: StoredGame): Promise<void> {
    await (await this.db()).put(GAME, game, ONLY);
  }
  async clearGame(): Promise<void> {
    await (await this.db()).delete(GAME, ONLY);
  }
  async addRun(run: FinishedRun): Promise<void> {
    await (await this.db()).put(RUNS, run);
  }
  async removeRun(runId: string): Promise<void> {
    await (await this.db()).delete(RUNS, runId);
  }
  async listRuns(): Promise<FinishedRun[]> {
    return readRuns(await (await this.db()).getAll(RUNS));
  }
  async loadProfile(): Promise<Profile> {
    return readProfile(await (await this.db()).get(PROFILE, ONLY));
  }
  async saveProfile(profile: Profile): Promise<void> {
    await (await this.db()).put(PROFILE, profile, ONLY);
  }
}

/**
 * The player's things in the browser, in the IndexedDB the Next web keeps (`ratrace`): a browser with none keeps them in the page, as the Next web
 * does. What the database refuses (a private window, a full disk) is the game context's resilient store to hold, over this, as it is on the Next web.
 */
export class KvStore implements PlayerStore {
  private readonly device: PlayerStore;

  constructor() {
    this.device = typeof indexedDB === 'undefined' ? new MemoryStore() : new Indexed(DATABASE);
  }

  loadGame = (): Promise<unknown> => this.device.loadGame();
  saveGame = (game: StoredGame): Promise<void> => this.device.saveGame(game);
  clearGame = (): Promise<void> => this.device.clearGame();
  addRun = (run: FinishedRun): Promise<void> => this.device.addRun(run);
  removeRun = (runId: string): Promise<void> => this.device.removeRun(runId);
  listRuns = (): Promise<FinishedRun[]> => this.device.listRuns();
  loadProfile = (): Promise<Profile> => this.device.loadProfile();
  saveProfile = (profile: Profile): Promise<void> => this.device.saveProfile(profile);
}

/** The cookie the Next web keeps the language in (next-intl's), which its server reads on the next visit. */
const LOCALE_COOKIE = 'NEXT_LOCALE';
const LOCALE_COOKIE_AGE = 60 * 60 * 24 * 365;

/** The language the player chose, in the Next web's NEXT_LOCALE cookie: the whole site, a year, SameSite lax. */
/** No choice of the press's click on the web: a page clicks with the game's sound, as the Next web's (the phone's is off until turned on). */
export const kvTapSound = {
  read: (): boolean | null => null,
  write: (): void => undefined,
};

/** Nothing asked on the web, where the game is never rated in a store (`game/askReview.web.ts`). */
export const kvReview: ReviewMemory = {
  read: () => null,
  write: (): void => undefined,
};

export const kvLanguage: LanguageKeep = {
  read: () => {
    try {
      for (const part of document.cookie.split(';')) {
        const at = part.indexOf('=');
        if (at !== -1 && part.slice(0, at).trim() === LOCALE_COOKIE) return decodeURIComponent(part.slice(at + 1).trim());
      }
      return null;
    } catch {
      return null;
    }
  },
  write: (locale) => {
    try {
      document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${LOCALE_COOKIE_AGE}; samesite=lax`;
    } catch {
      // A browser that keeps no cookies: the language is chosen again on the next visit.
    }
  },
};

const BASKET = 'ratrace.basket';

/** The orders of the round being planned, as text, in the localStorage key the Next web keeps its basket under. A browser that keeps nothing starts each page with none. */
export const kvBasket: BasketText = {
  read: () => {
    try {
      return localStorage.getItem(BASKET);
    } catch {
      return null;
    }
  },
  write: (text) => {
    try {
      if (text === null) localStorage.removeItem(BASKET);
      else localStorage.setItem(BASKET, text);
    } catch {
      // Not kept: the orders are still on screen for as long as the page is.
    }
  },
};

const MILESTONES = 'ratrace.milestones';

/** The milestones of lives (game/phoneMilestones.ts), as text, in the browser's localStorage. A browser that keeps nothing keeps them for the page. */
export const kvMilestones: BasketText = {
  read: () => {
    try {
      return localStorage.getItem(MILESTONES);
    } catch {
      return null;
    }
  },
  write: (text) => {
    try {
      if (text === null) localStorage.removeItem(MILESTONES);
      else localStorage.setItem(MILESTONES, text);
    } catch {
      // Not kept: a life opened again may celebrate a milestone twice, and nothing worse.
    }
  },
};

/**
 * Where the account's client keeps its session: the browser's localStorage, with no prefix, as the client keeps it on its own. The web wiring
 * passes the client no storage (it uses localStorage by itself); this stays so that the export is there.
 */
export const kvSession = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // A browser that keeps nothing: the player signs in again on the next visit.
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to take away from a browser that keeps nothing.
    }
  },
  /** Takes away the client's own keys (`sb-…`): with no prefix of the app's, nothing else in localStorage is the session's to remove. */
  clear: async (): Promise<void> => {
    try {
      for (const key of Object.keys(localStorage)) if (key.startsWith('sb-')) localStorage.removeItem(key);
    } catch {
      // Nothing to take away from a browser that keeps nothing.
    }
  },
};

/** Short texts read and written at once (synchronously), as a browser's localStorage reads and writes them: the lists the account is still to be told of. */
export type KeptText = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export const kvText: KeptText = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // A browser that keeps nothing: the list is simply not kept.
    }
  },
};

/** Noted while a guest is away at Google keeping their account, in sessionStorage as on the Next web, so the account kept is counted once. */
const KEEPING = 'ratrace:keeping-account';

/** The note of a guest gone to keep their account. A browser that keeps nothing simply counts nothing. */
export const kvKeeping = {
  set: (): void => {
    try {
      sessionStorage.setItem(KEEPING, '1');
    } catch {
      // Nothing: the account is kept all the same, only not counted.
    }
  },
  /** True once, if the note was there: it is taken away as it is read. */
  take: (): boolean => {
    try {
      const was = sessionStorage.getItem(KEEPING) !== null;
      if (was) sessionStorage.removeItem(KEEPING);
      return was;
    } catch {
      return false;
    }
  },
};

/** What the app remembers of the game's notices (`online/push.ts`), in the same shape as the phone's. The web has no such notices; this keeps the export. */
const PUSH = 'ratrace:push';

export const kvPush = {
  read: (): { state: 'on' | 'off' | 'refused'; token: string | null } | null => {
    try {
      const text = localStorage.getItem(PUSH);
      const noted: unknown = text === null ? null : JSON.parse(text);
      if (typeof noted !== 'object' || noted === null) return null;
      const { state, token } = noted as { state?: unknown; token?: unknown };
      if (state !== 'on' && state !== 'off' && state !== 'refused') return null;
      return { state, token: typeof token === 'string' ? token : null };
    } catch {
      return null;
    }
  },
  write: (noted: { state: 'on' | 'off' | 'refused'; token: string | null }): void => {
    try {
      localStorage.setItem(PUSH, JSON.stringify({ state: noted.state, token: noted.token }));
    } catch {
      // A browser that keeps nothing: the notices are not kept on.
    }
  },
};

const LAST_ACCOUNT = 'ratrace.lastAccount';

/** Whose account the browser last saw signed in, under the Next web's key: for the language of an account to follow a sign-in. */
export const kvLastAccount = {
  read: (): string | null => {
    try {
      return localStorage.getItem(LAST_ACCOUNT);
    } catch {
      return null;
    }
  },
  write: (userId: string): void => {
    try {
      localStorage.setItem(LAST_ACCOUNT, userId);
    } catch {
      // A browser that keeps nothing: the language is simply not brought over on its next sign-in.
    }
  },
};

/** The lists of lives the account was still to be told of (`givenUpIn` and `refusedIn` of `online/over.ts`, in `kvText`). */
const ACCOUNT_LISTS = ['ratrace:given-up', 'ratrace:refused'];

/**
 * Takes out of the browser what is left of a player whose account was deleted, beside what the game clears through the store (the life in progress,
 * and the profile, which keeps its settings): every finished life in the database, whether or not the list could show it, the account's session (the client's `sb-…` keys), the round being planned, the lists of lives the account was
 * to be told of, whose account it was, the phone's note of the notices, and a trip to Google noted. What is the browser's own stays: the language
 * chosen (its cookie), the offer to install the game. A browser that keeps nothing has nothing to take away.
 */
export async function kvForget(): Promise<void> {
  if (typeof indexedDB !== 'undefined') {
    try {
      const db = await openDatabase(DATABASE);
      await db.clear(RUNS);
      db.close();
    } catch {
      // A database the browser will not open: there are no lives in it to take away.
    }
  }
  const theirs = (key: string) => key.startsWith('sb-') || key === BASKET || key === LAST_ACCOUNT || key === PUSH || ACCOUNT_LISTS.includes(key);
  try {
    for (const key of Object.keys(localStorage)) if (theirs(key)) localStorage.removeItem(key);
  } catch {
    // Nothing to take away from a browser that keeps nothing.
  }
  try {
    sessionStorage.removeItem(KEEPING);
  } catch {
    // The same.
  }
}

/** The news that the player's account was deleted in a tab of the site, for the others: a channel between tabs, and a key of the storage they share. */
const FORGOTTEN = 'ratrace:forgotten';
/** This tab, for the news it tells: it starts again by itself, and does not hear its own. */
const THIS_TAB = Math.random().toString(36).slice(2);

/**
 * Another tab of the site, or the installed game beside it, still holds the deleted player in its memory (the life on screen, the lists for the
 * account) and would write them back, into the database shared with this one and up to the next account. The tab that deleted tells the others,
 * and each one hearing it starts afresh from what the browser now holds (the game's context loads the page again). Told on a `BroadcastChannel`, and
 * in the storage too for a browser with none (another tab hears it as a `storage` event); heard once however it comes, and never by the tab that
 * told it. Never throws.
 */
export const kvForgotten = {
  tell: (): void => {
    try {
      const channel = new BroadcastChannel(FORGOTTEN);
      channel.postMessage({ from: THIS_TAB });
      channel.close();
    } catch {
      // No channel between tabs: the storage tells them.
    }
    try {
      localStorage.setItem(FORGOTTEN, `${THIS_TAB} ${Date.now()}`);
    } catch {
      // A browser that keeps nothing keeps no other tab's copy of the player either.
    }
  },
  listen: (then: () => void): (() => void) => {
    if (typeof window === 'undefined') return () => undefined;
    let heard = false;
    const once = (from: unknown) => {
      if (heard || from === THIS_TAB) return;
      heard = true;
      then();
    };
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel === 'function') {
        channel = new BroadcastChannel(FORGOTTEN);
        channel.onmessage = (event: MessageEvent) => once((event.data as { from?: unknown } | null)?.from);
      }
    } catch {
      channel = null;
    }
    const stored = (event: StorageEvent) => {
      if (event.key === FORGOTTEN && event.newValue !== null) once(event.newValue.split(' ')[0]);
    };
    window.addEventListener('storage', stored);
    return () => {
      channel?.close();
      window.removeEventListener('storage', stored);
    };
  },
};

const INSTALL_OFFER = 'ratrace.installOffer';

/**
 * What the browser keeps of the offer to install the game (`pwa/install.web.tsx`), under the Next web's key: in localStorage how many visits the player
 * has made and whether they said no, and in sessionStorage that this visit is counted. A browser that keeps nothing makes no offer.
 */
export const kvInstallOffer = {
  /** Counts this visit unless it is counted already (one however often Home is shown in it), and says what is kept: null where the browser keeps nothing. */
  visit: (): { visits: number; dismissed: boolean } | null => {
    try {
      const kept = JSON.parse(localStorage.getItem(INSTALL_OFFER) ?? '{}') as { visits?: number; dismissed?: boolean };
      let visits = kept.visits ?? 0;
      if (sessionStorage.getItem(INSTALL_OFFER) === null) {
        visits += 1;
        sessionStorage.setItem(INSTALL_OFFER, '1');
        localStorage.setItem(INSTALL_OFFER, JSON.stringify({ ...kept, visits }));
      }
      return { visits, dismissed: kept.dismissed === true };
    } catch {
      return null;
    }
  },
  /** The player's no, for good. */
  dismiss: (): void => {
    try {
      const kept = JSON.parse(localStorage.getItem(INSTALL_OFFER) ?? '{}') as object;
      localStorage.setItem(INSTALL_OFFER, JSON.stringify({ ...kept, dismissed: true }));
    } catch {
      // Not kept: it is offered again next time, which is no harm.
    }
  },
};
