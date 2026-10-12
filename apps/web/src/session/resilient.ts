import { MemoryStore } from './memory';
import type { FinishedRun, PlayerStore, Profile, SavedGame } from './types';

/**
 * A store that never fails the game. It uses the device's database while that works; the first
 * time the database refuses (a private window, a full disk, a blocked upgrade) it switches to
 * memory for the rest of the visit and says so once. The player can still play; only the save is gone.
 */
export class ResilientStore implements PlayerStore {
  private readonly memory = new MemoryStore();
  private failed = false;

  constructor(
    private readonly primary: PlayerStore,
    private readonly onFailure: (error: unknown) => void = () => {},
  ) {}

  /** True once the device's database has been given up on. */
  get degraded(): boolean {
    return this.failed;
  }

  private async run<T>(action: (store: PlayerStore) => Promise<T>): Promise<T> {
    if (!this.failed) {
      try {
        return await action(this.primary);
      } catch (error) {
        this.failed = true;
        this.onFailure(error);
      }
    }
    return action(this.memory);
  }

  loadGame = (): Promise<unknown> => this.run((store) => store.loadGame());
  saveGame = (game: SavedGame): Promise<void> => this.run((store) => store.saveGame(game));
  clearGame = (): Promise<void> => this.run((store) => store.clearGame());
  addRun = (run: FinishedRun): Promise<void> => this.run((store) => store.addRun(run));
  listRuns = (): Promise<FinishedRun[]> => this.run((store) => store.listRuns());
  loadProfile = (): Promise<Profile> => this.run((store) => store.loadProfile());
  saveProfile = (profile: Profile): Promise<void> => this.run((store) => store.saveProfile(profile));
}
