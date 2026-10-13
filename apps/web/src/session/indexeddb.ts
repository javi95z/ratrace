import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { readProfile } from './profile';
import { readRuns } from './runs';
import type { FinishedRun, PlayerStore, Profile, SavedGame } from './types';

const GAME = 'currentGame';
const RUNS = 'runs';
const PROFILE = 'profile';
const ONLY = 'only';

/**
 * Everything the player has, kept in the browser's IndexedDB in three stores (spec 8.5):
 * the game in progress, finished lives, and the profile.
 */
export class LocalStore implements PlayerStore {
  private opened: Promise<IDBPDatabase> | null = null;

  constructor(private readonly name = 'ratrace') {}

  private db(): Promise<IDBPDatabase> {
    this.opened ??= openDB(this.name, 1, {
      upgrade(db) {
        db.createObjectStore(GAME);
        db.createObjectStore(RUNS, { keyPath: 'runId' });
        db.createObjectStore(PROFILE);
      },
    });
    return this.opened;
  }

  async loadGame(): Promise<unknown> {
    return (await (await this.db()).get(GAME, ONLY)) ?? null;
  }

  async saveGame(game: SavedGame): Promise<void> {
    await (await this.db()).put(GAME, game, ONLY);
  }

  async clearGame(): Promise<void> {
    await (await this.db()).delete(GAME, ONLY);
  }

  async addRun(run: FinishedRun): Promise<void> {
    await (await this.db()).put(RUNS, run);
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
