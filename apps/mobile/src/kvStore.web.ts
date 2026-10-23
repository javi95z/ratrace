import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { MemoryStore } from '@ratrace/core/session/memory';
import { readProfile } from '@ratrace/core/session/profile';
import { readRuns } from '@ratrace/core/session/runs';
import type { FinishedRun, PlayerStore, Profile, StoredGame } from '@ratrace/core/session/types';
import type { LanguageKeep } from './game/locale';
import type { BasketText } from './game/phoneBasket';

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

/** The Next web's database, written again here: the app does not depend on `apps/web`. Three stores: the game in progress, the finished lives, the profile. */
class Indexed implements PlayerStore {
  private opened: Promise<IDBPDatabase> | null = null;

  constructor(private readonly name: string) {}

  private db(): Promise<IDBPDatabase> {
    this.opened ??= openDB(this.name, 1, {
      upgrade(db) {
        db.createObjectStore(GAME);
        db.createObjectStore(RUNS, { keyPath: 'runId' });
        db.createObjectStore(PROFILE);
      },
    }).catch((error: unknown) => {
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
