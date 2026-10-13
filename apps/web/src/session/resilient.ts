import { readProfile } from './profile';
import type { FinishedRun, PlayerStore, Profile, SavedGame } from './types';

/** What the device has not taken yet. The game and the profile are whole records, so only the latest of each matters. */
interface Pending {
  game?: { save: SavedGame } | { clear: true };
  runs: FinishedRun[];
  profile?: Profile;
}

/**
 * A store that never fails the game. It writes to the device's database; what the database
 * refuses (a private window, a full disk) is kept here and offered again with every later write,
 * because a save is the whole record and so can always be sent again. Meanwhile it reads back
 * what this visit wrote, so the game goes on exactly as if it had been saved.
 *
 * `degraded` is true while the device is behind or cannot be read: the player is told, because
 * closing the page then loses what the device has not taken.
 */
export class ResilientStore implements PlayerStore {
  private pending: Pending = { runs: [] };
  /** The last game and profile this visit wrote or read, for when the device cannot be read at all. */
  private mirror: { game: SavedGame | null; profile: Profile | null } = { game: null, profile: null };
  private unreadable = false;
  private reported = false;
  /** Writes reach the device one at a time, in the order they were made. */
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private readonly primary: PlayerStore,
    private readonly onChange: (degraded: boolean, error?: unknown) => void = () => {},
  ) {}

  /** True while the device is missing something this visit wrote, or cannot be read. */
  get degraded(): boolean {
    return this.unreadable || this.pending.game !== undefined || this.pending.runs.length > 0 || this.pending.profile !== undefined;
  }

  /** Tells whoever listens when saving stops working and when it works again, once each time. */
  private report(error?: unknown): void {
    const now = this.degraded;
    if (now === this.reported) return;
    this.reported = now;
    this.onChange(now, error);
  }

  /** Offers the device everything it has not taken, finished lives first. Stops at the first refusal and tries again next time. */
  private flush(): Promise<void> {
    const run = async () => {
      try {
        while (this.pending.runs.length > 0) {
          await this.primary.addRun(this.pending.runs[0]);
          this.pending.runs.shift();
        }
        const game = this.pending.game;
        if (game !== undefined) {
          if ('save' in game) await this.primary.saveGame(game.save);
          else await this.primary.clearGame();
          if (this.pending.game === game) this.pending.game = undefined;
        }
        const profile = this.pending.profile;
        if (profile !== undefined) {
          await this.primary.saveProfile(profile);
          if (this.pending.profile === profile) this.pending.profile = undefined;
        }
        // A device that takes writes is working again.
        this.unreadable = false;
        this.report();
      } catch (error) {
        this.report(error);
      }
    };
    this.tail = this.tail.then(run, run);
    return this.tail;
  }

  private async read<T>(fromDevice: () => Promise<T>, otherwise: () => T): Promise<T> {
    try {
      const value = await fromDevice();
      if (this.unreadable) {
        this.unreadable = false;
        this.report();
      }
      return value;
    } catch (error) {
      this.unreadable = true;
      this.report(error);
      return otherwise();
    }
  }

  loadGame = async (): Promise<unknown> => {
    const waiting = this.pending.game;
    if (waiting !== undefined) return 'save' in waiting ? structuredClone(waiting.save) : null;
    return this.read(
      async () => {
        const game = await this.primary.loadGame();
        this.mirror.game = (structuredClone(game) as SavedGame | null) ?? null;
        return game;
      },
      () => structuredClone(this.mirror.game),
    );
  };

  saveGame = (game: SavedGame): Promise<void> => {
    const copy = structuredClone(game);
    this.mirror.game = copy;
    this.pending.game = { save: copy };
    return this.flush();
  };

  clearGame = (): Promise<void> => {
    this.mirror.game = null;
    this.pending.game = { clear: true };
    return this.flush();
  };

  addRun = (run: FinishedRun): Promise<void> => {
    this.pending.runs.push(structuredClone(run));
    return this.flush();
  };

  /** Finished lives, the latest first: what the device has, and what it has not taken yet. */
  listRuns = async (): Promise<FinishedRun[]> => {
    const stored = await this.read(
      () => this.primary.listRuns(),
      () => [],
    );
    const waiting = this.pending.runs.filter((run) => !stored.some((other) => other.runId === run.runId));
    return structuredClone([...stored, ...waiting]).sort((a, b) => b.finishedAt - a.finishedAt);
  };

  loadProfile = async (): Promise<Profile> => {
    if (this.pending.profile !== undefined) return structuredClone(this.pending.profile);
    return this.read(
      async () => {
        // What was read is remembered: if the device then stops answering, the profile it held is not mistaken for none.
        const profile = await this.primary.loadProfile();
        this.mirror.profile = structuredClone(profile);
        return profile;
      },
      () => readProfile(structuredClone(this.mirror.profile)),
    );
  };

  saveProfile = (profile: Profile): Promise<void> => {
    const copy = structuredClone(profile);
    this.mirror.profile = copy;
    this.pending.profile = copy;
    return this.flush();
  };
}
