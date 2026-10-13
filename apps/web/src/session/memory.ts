import { readProfile } from './profile';
import { readRuns } from './runs';
import type { FinishedRun, PlayerStore, Profile, SavedGame } from './types';

/**
 * A store that lives only as long as the page. Used by tests, and by the game itself when the
 * browser gives it no database to write to, as some private windows do: the game still plays.
 */
export class MemoryStore implements PlayerStore {
  private game: SavedGame | null = null;
  private runs = new Map<string, FinishedRun>();
  private profile: unknown = null;

  loadGame = async (): Promise<unknown> => structuredClone(this.game);

  saveGame = async (game: SavedGame): Promise<void> => {
    this.game = structuredClone(game);
  };

  clearGame = async (): Promise<void> => {
    this.game = null;
  };

  addRun = async (run: FinishedRun): Promise<void> => {
    this.runs.set(run.runId, structuredClone(run));
  };

  listRuns = async (): Promise<FinishedRun[]> => readRuns(structuredClone([...this.runs.values()]));

  loadProfile = async (): Promise<Profile> => readProfile(structuredClone(this.profile));

  saveProfile = async (profile: Profile): Promise<void> => {
    this.profile = structuredClone(profile);
  };
}
