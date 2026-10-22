import { readProfile } from './profile';
import type { FinishedRun, PlayerStore, Profile, StoredGame } from './types';

/** What the device has not taken yet. The game and the profile are whole records, so only the latest of each matters. */
interface Pending {
  game?: { save: StoredGame } | { clear: true };
  /** What was done to the finished lives, in the order it was done: a life put in, or one taken out by id. */
  runs: Array<{ add: FinishedRun } | { remove: string }>;
  profile?: Profile;
}

/**
 * A store that never fails the game. It writes to the device's database; what the database
 * refuses (a private window, a full disk) is kept here and offered again with every later write,
 * because a save is the whole record and so can always be sent again. Meanwhile it reads back
 * what this visit wrote, so the game goes on exactly as if it had been saved.
 *
 * `degraded` is true once the device has refused a write or a read, until it works again: the
 * player is told, because closing the page then loses what the device has not taken. A write that
 * is merely on its way is not a refusal, and does not count.
 */
export class ResilientStore implements PlayerStore {
  private pending: Pending = { runs: [] };
  /** The last game and profile this visit wrote or read, for when the device cannot be read at all. */
  private mirror: { game: StoredGame | null; profile: Profile | null } = { game: null, profile: null };
  private unreadable = false;
  /** True from a write the device refused until one it takes. */
  private refusing = false;
  private reported = false;
  /** Writes reach the device one at a time, in the order they were made. */
  private tail: Promise<void> = Promise.resolve();

  /** The ids of the finished lives, as `listRuns` would give them: there only when the device's store tells them (`PlayerStore.runIds`). */
  readonly runIds?: () => Promise<string[]>;

  /**
   * `freshReads`: the device's store makes the finished lives it gives anew for each call (the phone's: each parsed from its text), so they are handed
   * on as they come, not copied again; what this store holds itself is still copied. Off by default (the web's IndexedDB may hand back what it holds).
   */
  constructor(
    private readonly primary: PlayerStore,
    private readonly onChange: (degraded: boolean, error?: unknown) => void = () => {},
    private readonly options: { freshReads?: boolean } = {},
  ) {
    const ids = primary.runIds?.bind(primary);
    if (ids !== undefined) {
      this.runIds = async () => {
        const stored = await this.read(ids, () => []);
        // What the device has, with what it has not taken yet done to it in the same order.
        const runs = new Set(stored);
        for (const next of this.pending.runs) {
          if ('add' in next) runs.add(next.add.runId);
          else runs.delete(next.remove);
        }
        return [...runs];
      };
    }
  }

  /**
   * True from the moment the device refuses something until it works again. It changes only when
   * whoever listens is told, so a screen that reads it between two tellings always reads the truth.
   */
  get degraded(): boolean {
    return this.reported;
  }

  /** Tells whoever listens when saving stops working and when it works again, once each time. */
  private report(error?: unknown): void {
    // What is waiting only because a write is on its way, or because another was made meanwhile, is not a failure.
    const now = this.unreadable || this.refusing;
    if (now === this.reported) return;
    this.reported = now;
    this.onChange(now, error);
  }

  /** Offers the device everything it has not taken, finished lives first. Stops at the first refusal and tries again next time. */
  private flush(): Promise<void> {
    const run = async () => {
      try {
        // The list is only ever added to at its end, so the one being offered is still the first when the device has taken it.
        while (this.pending.runs.length > 0) {
          const next = this.pending.runs[0];
          if ('add' in next) await this.primary.addRun(next.add);
          else await this.primary.removeRun(next.remove);
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
        this.refusing = false;
        this.report();
      } catch (error) {
        this.refusing = true;
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
        this.mirror.game = (structuredClone(game) as StoredGame | null) ?? null;
        return game;
      },
      () => structuredClone(this.mirror.game),
    );
  };

  saveGame = (game: StoredGame): Promise<void> => {
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
    this.pending.runs.push({ add: structuredClone(run) });
    return this.flush();
  };

  removeRun = (runId: string): Promise<void> => {
    this.pending.runs.push({ remove: runId });
    return this.flush();
  };

  /** Finished lives, the latest first: what the device has, and what it has not taken yet. */
  listRuns = async (): Promise<FinishedRun[]> => {
    const stored = await this.read(
      () => this.primary.listRuns(),
      () => [],
    );
    // What the device has, with what it has not taken yet done to it in the same order. What the device gave anew is handed on; what is held here, copied.
    const fresh = this.options.freshReads === true;
    const runs = new Map(stored.map((run) => [run.runId, run]));
    for (const next of this.pending.runs) {
      if ('add' in next) runs.set(next.add.runId, fresh ? structuredClone(next.add) : next.add);
      else runs.delete(next.remove);
    }
    return (fresh ? [...runs.values()] : structuredClone([...runs.values()])).sort((a, b) => b.finishedAt - a.finishedAt);
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
