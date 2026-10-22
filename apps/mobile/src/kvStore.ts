import Storage from 'expo-sqlite/kv-store';
import { readProfile } from '@ratrace/core/session/profile';
import { readRun, readRuns } from '@ratrace/core/session/runs';
import type { FinishedRun, PlayerStore, Profile, StoredGame } from '@ratrace/core/session/types';
import type { LanguageKeep } from './game/locale';
import type { BasketText } from './game/phoneBasket';

const GAME = 'ratrace:game';
/** Every finished life in one value, by id: how the phone kept them before each had a key of its own. Moved on the first read, then gone. */
const RUNS_BEFORE = 'ratrace:runs';
/** A finished life, under its id. */
const RUN = 'ratrace:run:';
/** The ids of the finished lives, oldest first. */
const INDEX = 'ratrace:runs:index';
const PROFILE = 'ratrace:profile';
const LOCALE = 'ratrace:locale';
const BASKET = 'ratrace:basket';

const read = async (key: string): Promise<unknown> => {
  const text = await Storage.getItem(key);
  return text === null ? null : JSON.parse(text);
};
const write = (key: string, value: unknown) => Storage.setItem(key, JSON.stringify(value));

/** A value as it was written, or null for one that cannot be read (the list leaves it out, `readRuns`). */
const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** The ids an index holds: each once, in its order. Anything else is none. */
const idsOf = (text: string | null): string[] => {
  const value = text === null ? null : parsed(text);
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];
};

/**
 * The finished lives as this store last read or wrote them: each as its text on the phone, oldest first; the ids of those that can be shown (a life
 * that cannot be read is left out of the list, `readRun`); and the index they were under. Held as text, each life is made anew from it for every
 * list (parsed): a caller's change to one, its log too, is its own, and the list needs no copy on its way to the game.
 */
interface Held {
  index: string | null;
  runs: Map<string, string>;
  shown: Set<string>;
}

/** Whether a life's text is one the list shows. */
const shows = (text: string): boolean => readRun(parsed(text)) !== null;

/**
 * Moves the lives kept the old way, in one value, each to a key of its own: every life first, then the index, and the old value taken away last. Killed
 * at any point, the old value is still there, and the next read does it all again: a life written twice is the same life, and the index is the old
 * value's ids (with any it already named), so nothing is lost and nothing is there twice. An old value that cannot be read is taken away as an empty one.
 */
async function moveOld(): Promise<void> {
  const text = await Storage.getItem(RUNS_BEFORE);
  if (text === null) return;
  // A value that cannot be read holds no life that can be had: it is let go like an empty one, not thrown on every list for ever after.
  const old = parsed(text);
  const runs = typeof old === 'object' && old !== null && !Array.isArray(old) ? Object.entries(old as Record<string, unknown>) : [];
  for (const [id, run] of runs) await write(RUN + id, run);
  const ids = [...new Set([...runs.map(([id]) => id), ...idsOf(await Storage.getItem(INDEX))])];
  await Storage.setItem(INDEX, JSON.stringify(ids));
  await Storage.removeItem(RUNS_BEFORE);
}

/**
 * Every finished life on the phone, read whole: the lives kept the old way moved first, then the index and the lives it names. A write cut short is
 * mended: an id whose life is gone (a removal killed between its two writes) is left out, and a life no id names (an addition killed between its two)
 * is taken in, after the others; the index is written again if either was found.
 */
async function readAll(): Promise<Held> {
  await moveOld();
  const index = await Storage.getItem(INDEX);
  const ids = idsOf(index);
  const texts = await Promise.all(ids.map((id) => Storage.getItem(RUN + id)));
  const runs = new Map<string, string>();
  ids.forEach((id, i) => {
    const text = texts[i];
    if (text !== null) runs.set(id, text);
  });
  const named = new Set(ids);
  const strays = (await Storage.getAllKeys()).filter((key) => key.startsWith(RUN) && !named.has(key.slice(RUN.length)));
  const found: Array<[string, string]> = [];
  for (const key of strays) {
    const text = await Storage.getItem(key);
    if (text !== null) found.push([key.slice(RUN.length), text]);
  }
  const day = (text: string) => {
    const run = parsed(text);
    return typeof run === 'object' && run !== null && typeof (run as { finishedAt?: unknown }).finishedAt === 'number' ? (run as { finishedAt: number }).finishedAt : 0;
  };
  for (const [id, text] of found.sort((a, b) => day(a[1]) - day(b[1]))) runs.set(id, text);
  const shown = new Set([...runs].filter(([, text]) => shows(text)).map(([id]) => id));
  if (runs.size === ids.length && found.length === 0) return { index, runs, shown };
  const mended = JSON.stringify([...runs.keys()]);
  await Storage.setItem(INDEX, mended);
  return { index: mended, runs, shown };
}

/**
 * The player's things on the phone, in its SQLite key-value store: the same shape the web keeps in IndexedDB. Each finished life has a key of its
 * own, and an index of their ids (oldest first): ending a life writes that life and the index, never every life before it, which made the round that
 * ends a long life slow with many lives kept (a whole JSON value read and written on that step). The lives are read once and held; read again, only the
 * index is (another store on the phone may have written: the timing probe puts lives with its own), and the lives again only if it changed. The store's
 * calls about lives are made one at a time, in order.
 */
export class KvStore implements PlayerStore {
  private held: Held | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  /** One call about the lives at a time; a failed one leaves nothing held, so the next reads the phone again. */
  private inTurn<T>(work: () => Promise<T>): Promise<T> {
    const turn = this.queue.then(async () => {
      try {
        return await work();
      } catch (error) {
        this.held = null;
        throw error;
      }
    });
    this.queue = turn.catch(() => undefined);
    return turn;
  }

  /** The lives on the phone: those held, unless the index says another store wrote since. */
  private async lives(): Promise<Held> {
    if (this.held !== null && (await Storage.getItem(INDEX)) === this.held.index) return this.held;
    this.held = await readAll();
    return this.held;
  }

  /** Writes the index of the lives held, in their order. */
  private async writeIndex(held: Held): Promise<void> {
    const index = JSON.stringify([...held.runs.keys()]);
    await Storage.setItem(INDEX, index);
    held.index = index;
  }

  loadGame = (): Promise<unknown> => read(GAME);
  saveGame = (game: StoredGame): Promise<void> => write(GAME, game);
  clearGame = async (): Promise<void> => {
    await Storage.removeItem(GAME);
  };
  /** The life under its key, then its id at the end of the index (not written again for a life it already names: one saved again). */
  addRun = (run: FinishedRun): Promise<void> =>
    this.inTurn(async () => {
      const held = await this.lives();
      const text = JSON.stringify(run);
      await Storage.setItem(RUN + run.runId, text);
      const known = held.runs.has(run.runId);
      held.runs.set(run.runId, text);
      if (shows(text)) held.shown.add(run.runId);
      else held.shown.delete(run.runId);
      if (!known) await this.writeIndex(held);
    });
  /** The life's key taken away, then its id from the index: killed between the two, the next read leaves out an id with no life. */
  removeRun = (runId: string): Promise<void> =>
    this.inTurn(async () => {
      const held = await this.lives();
      await Storage.removeItem(RUN + runId);
      held.shown.delete(runId);
      if (!held.runs.delete(runId)) return;
      await this.writeIndex(held);
    });
  /** Every finished life that can be shown, the latest first: each parsed anew from its text, so a caller's change to one (its log too) is its own. */
  listRuns = (): Promise<FinishedRun[]> => this.inTurn(async () => readRuns([...(await this.lives()).runs.values()].map(parsed)));
  /** The ids of the lives the list shows, from the index and what is held: no life is read for them (a step that does not end a life asks only this). */
  runIds = (): Promise<string[]> => this.inTurn(async () => [...(await this.lives()).shown]);
  loadProfile = async (): Promise<Profile> => readProfile(await read(PROFILE));
  saveProfile = (profile: Profile): Promise<void> => write(PROFILE, profile);
}

/**
 * The language the player chose, on the phone: the web's NEXT_LOCALE cookie. Read at once (synchronously)
 * when the app opens, so that nothing is ever shown in another language first.
 */
export const kvLanguage: LanguageKeep = {
  read: () => {
    try {
      return Storage.getItemSync(LOCALE);
    } catch {
      return null;
    }
  },
  write: (locale) => {
    try {
      Storage.setItemSync(LOCALE, locale);
    } catch {
      // A phone that keeps nothing: the language is chosen again on the next start.
    }
  },
};

/**
 * The orders of the round being planned, as text, on the phone: the web's basket in its localStorage. Read and written at once
 * (synchronously), because the round store keeps the basket as it changes, and reads it when a life is opened.
 */
export const kvBasket: BasketText = {
  read: () => Storage.getItemSync(BASKET),
  write: (text) => {
    if (text === null) Storage.removeItemSync(BASKET);
    else Storage.setItemSync(BASKET, text);
  },
};

/** The account's session, under keys of the app's own: nothing of the phone's store is the client's but these. */
const SESSION = 'ratrace:session:';

/**
 * Where the account's client keeps its session on the phone (the browser's localStorage, on the web): who is signed in, and the proof of a trip to
 * Google while it is under way. Kept in the phone's store, so the player who opened the app last time is the one who opens it now, never a new guest.
 */
export const kvSession = {
  getItem: (key: string): Promise<string | null> => Storage.getItem(SESSION + key),
  setItem: (key: string, value: string): Promise<void> => Storage.setItem(SESSION + key, value),
  removeItem: async (key: string): Promise<void> => {
    await Storage.removeItem(SESSION + key);
  },
  /** Takes away every key of the session: for signing out, which leaves nothing of the player on the phone for the next to find. */
  clear: async (): Promise<void> => {
    for (const key of await Storage.getAllKeys()) if (key.startsWith(SESSION)) await Storage.removeItem(key);
  },
};

/** Short texts read and written at once (synchronously), as a browser's localStorage reads and writes them: the lists the account is still to be told of. */
export type KeptText = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
export const kvText: KeptText = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
};

/** Noted while a guest is away at Google keeping their account (the web's sessionStorage note), so the account kept is counted once. */
const KEEPING = 'ratrace:keeping-account';

/** The note of a guest gone to keep their account. A phone that keeps nothing simply counts nothing. */
export const kvKeeping = {
  set: (): void => {
    try {
      Storage.setItemSync(KEEPING, '1');
    } catch {
      // Nothing: the account is kept all the same, only not counted.
    }
  },
  /** True once, if the note was there: it is taken away as it is read. */
  take: (): boolean => {
    try {
      const was = Storage.getItemSync(KEEPING) !== null;
      if (was) Storage.removeItemSync(KEEPING);
      return was;
    } catch {
      return false;
    }
  },
};

/** Where the phone notes whose account it last saw signed in, under the web's key: for the language of an account to follow a sign-in. */
const LAST_ACCOUNT = 'ratrace.lastAccount';

export const kvLastAccount = {
  read: (): string | null => {
    try {
      return Storage.getItemSync(LAST_ACCOUNT);
    } catch {
      return null;
    }
  },
  write: (userId: string): void => {
    try {
      Storage.setItemSync(LAST_ACCOUNT, userId);
    } catch {
      // A phone that keeps nothing: the language is simply not brought over on its next sign-in.
    }
  },
};
