import Storage from 'expo-sqlite/kv-store';
import { readProfile } from '@ratrace/core/session/profile';
import { readRuns } from '@ratrace/core/session/runs';
import type { FinishedRun, PlayerStore, Profile, StoredGame } from '@ratrace/core/session/types';
import type { LanguageKeep } from './game/locale';

const GAME = 'ratrace:game';
const RUNS = 'ratrace:runs';
const PROFILE = 'ratrace:profile';
const LOCALE = 'ratrace:locale';

const read = async (key: string): Promise<unknown> => {
  const text = await Storage.getItem(key);
  return text === null ? null : JSON.parse(text);
};
const write = (key: string, value: unknown) => Storage.setItem(key, JSON.stringify(value));

/** The player's things on the phone, in its SQLite key-value store: the same shape the web keeps in IndexedDB. */
export class KvStore implements PlayerStore {
  loadGame = (): Promise<unknown> => read(GAME);
  saveGame = (game: StoredGame): Promise<void> => write(GAME, game);
  clearGame = async (): Promise<void> => {
    await Storage.removeItem(GAME);
  };
  addRun = async (run: FinishedRun): Promise<void> => {
    const runs = ((await read(RUNS)) ?? {}) as Record<string, FinishedRun>;
    await write(RUNS, { ...runs, [run.runId]: run });
  };
  removeRun = async (runId: string): Promise<void> => {
    const runs = { ...(((await read(RUNS)) ?? {}) as Record<string, FinishedRun>) };
    delete runs[runId];
    await write(RUNS, runs);
  };
  listRuns = async (): Promise<FinishedRun[]> => readRuns(Object.values(((await read(RUNS)) ?? {}) as Record<string, unknown>));
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
