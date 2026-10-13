import type { LifeDef } from '@ratrace/content';
import { stateHash } from '@ratrace/engine';
import type { Content } from '@ratrace/engine';
import { openSave } from '@/session/save';
import { SAVE_FORMAT } from '@/session/types';
import type { FinishedRun, PlayerStore, Profile, SavedGame } from '@/session/types';
import { chooseGame, mergeProgress, mergeRuns, progressOf, readProgress, sameProgress, stepsOf, withProgress } from './merge';
import type { CloudGame, Progress } from './merge';

/** A life in progress, as it is sent to the account. */
export interface GameUpload {
  id: string;
  lifeId: string;
  engineVersion: string;
  contentVersion: string;
  seed: string;
  round: number;
  log: unknown;
  stateHash: string;
}

/** A finished life as the server wrote it. Every figure is the engine's, worked out on the server. */
export interface CloudRun {
  id: string;
  lifeId: string;
  engineVersion: string;
  contentVersion: string;
  score: number;
  netWorth: number;
  status: number;
  escapedAtRound: number | null;
  bankruptcies: number;
  badges: string[];
  cities: string[];
  history: number[];
  finishedAt: string;
}

/** What the mirror asks of the account. Any of it may fail: the device is then simply ahead for a while. */
export interface SyncCloud {
  /** The player's lives still being played, the latest first. */
  playingGames(): Promise<CloudGame[]>;
  /** Saves the player's own life in progress. `closed` if the account holds it as abandoned or finished. */
  pushGame(game: GameUpload): Promise<'saved' | 'closed'>;
  abandonGame(id: string): Promise<void>;
  loadProgress(): Promise<unknown>;
  saveProgress(progress: Progress): Promise<void>;
  /** The player's finished lives. */
  listRuns(): Promise<CloudRun[]>;
  /** Has the server finish a life it has been sent. `refused` if it would not; `failed` if it could not be asked. */
  finishRun(gameId: string): Promise<'done' | 'refused' | 'failed'>;
}

/** Whether what is on the device is also in the account: there is no account, not yet, or yes. */
export type CloudSaving = 'off' | 'pending' | 'saved';

/** What a sync changed on the device, for whoever shows it. */
export type DeviceChange = 'game' | 'profile' | 'runs';

interface Options {
  content: Content;
  lives: ReadonlyArray<LifeDef>;
  /** The versions this build plays. A life on others is left alone in the account. */
  versions: { engine: string; content: string };
  /** Asks for a sync a little later. Many writes in a row ask many times and are answered by one sync. */
  schedule?(run: () => void): void;
  /** How many finished lives one sync asks the server to finish. The rest wait for the next. */
  finishPerSync?: number;
}

const asRun = (run: CloudRun): FinishedRun => ({
  format: SAVE_FORMAT,
  runId: run.id,
  engineVersion: run.engineVersion,
  contentVersion: run.contentVersion,
  lifeId: run.lifeId,
  // The seed and the log stay with the game in the account. A life from elsewhere is shown, not replayed.
  seed: '',
  log: [],
  finishedAt: Date.parse(run.finishedAt) || 0,
  score: run.score,
  netWorth: run.netWorth,
  status: run.status,
  escapedAtRound: run.escapedAtRound,
  bankruptcies: run.bankruptcies,
  history: run.history,
  badges: run.badges,
  cities: run.cities,
  verified: false,
});

const uploadOf = (save: Pick<SavedGame, 'gameId' | 'lifeId' | 'engineVersion' | 'contentVersion' | 'seed' | 'log' | 'state'>): GameUpload => ({
  id: save.gameId,
  lifeId: save.lifeId,
  engineVersion: save.engineVersion,
  contentVersion: save.contentVersion,
  seed: save.seed,
  round: save.state.round,
  log: save.log,
  stateHash: stateHash(save.state),
});

/**
 * The player's store, with the account as its mirror.
 *
 * The device is written first and is always enough: every read comes from it, and no write waits
 * for the network. A sync then brings the two together. It takes down what the device lacks,
 * sends up what the account lacks, and never fails: with no connection it leaves the device as it
 * is and tries again when asked. Nothing is queued write by write, because a sync sends the whole
 * of what the device has.
 */
export class MirroredStore implements PlayerStore {
  private state: CloudSaving = 'off';
  private readonly watchers = new Set<() => void>();
  private readonly changes = new Set<(what: DeviceChange) => void>();
  /** Lives the device gave up for another one, still to be marked so in the account. */
  private readonly abandoned = new Set<string>();
  private offered: CloudGame | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  /** The game last sent and how it stood, so that a sync with nothing new to say about it says nothing. */
  private sent: string | null = null;

  constructor(
    private readonly device: PlayerStore,
    private readonly cloud: () => SyncCloud | null,
    private readonly options: Options,
  ) {}

  // ------------------------------------------------------------------ the device, as it always was
  readonly loadGame = (): Promise<unknown> => this.device.loadGame();
  readonly listRuns = (): Promise<FinishedRun[]> => this.device.listRuns();
  readonly loadProfile = (): Promise<Profile> => this.device.loadProfile();

  readonly saveGame = async (game: SavedGame): Promise<void> => {
    await this.noteReplaced(game.gameId);
    await this.device.saveGame(game);
    this.poke();
  };

  readonly clearGame = async (): Promise<void> => {
    await this.noteReplaced(null);
    await this.device.clearGame();
    this.poke();
  };

  readonly addRun = async (run: FinishedRun): Promise<void> => {
    await this.device.addRun(run);
    this.poke();
  };

  readonly saveProfile = async (profile: Profile): Promise<void> => {
    await this.device.saveProfile(profile);
    this.poke();
  };

  /** A life in progress that is about to give way to another is abandoned in the account too. */
  private async noteReplaced(next: string | null): Promise<void> {
    const current = this.open(await this.device.loadGame().catch(() => null));
    if (current !== null && current.gameId !== next && !current.state.finished) this.abandoned.add(current.gameId);
  }

  // ------------------------------------------------------------------ what whoever shows it can ask
  readonly status = (): CloudSaving => this.state;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.watchers.add(listener);
    return () => {
      this.watchers.delete(listener);
    };
  };

  /** Calls `listener` when a sync has changed what the device holds. Returns how to stop. */
  readonly onDeviceChanged = (listener: (what: DeviceChange) => void): (() => void) => {
    this.changes.add(listener);
    return () => {
      this.changes.delete(listener);
    };
  };

  /** A different life in progress waiting in the account, if there is one. It is never taken unasked. */
  readonly offer = (): { gameId: string; lifeId: string; round: number } | null =>
    this.offered === null ? null : { gameId: this.offered.id, lifeId: this.offered.lifeId, round: this.offered.round };

  /** Takes the offered life in place of the device's own, which is abandoned. False if there was none, or it could not be opened. */
  readonly takeOffer = async (): Promise<boolean> => {
    const offered = this.offered;
    if (offered === null) return false;
    const save = this.adopt(offered);
    if (save === null) return false;
    await this.noteReplaced(save.gameId);
    await this.device.saveGame(save);
    this.offered = null;
    this.tell('game');
    this.poke();
    return true;
  };

  /**
   * Brings the device and the account together. Never throws. One runs at a time; asked again
   * meanwhile, it runs once more when the first is done, so the latest writes are not missed.
   */
  readonly sync = (): Promise<void> => {
    if (this.running !== null) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.pass();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  };

  // ------------------------------------------------------------------ the sync itself
  private poke(): void {
    if (this.cloud() === null) return;
    this.set('pending');
    (this.options.schedule ?? ((run) => setTimeout(run, 1_500)))(() => void this.sync());
  }

  private set(next: CloudSaving): void {
    if (this.state === next) return;
    this.state = next;
    for (const watcher of this.watchers) watcher();
  }

  private tell(what: DeviceChange): void {
    for (const listener of this.changes) listener(what);
  }

  /** The stored game, if it is a sound one of this build. */
  private open(raw: unknown): SavedGame | null {
    const opened = openSave(raw, this.options.content, this.options.lives);
    return opened.ok ? opened.save : null;
  }

  /** A life from the account as a save of this device: rebuilt by playing its log again, so a bad copy cannot be opened as sound. */
  private adopt(game: CloudGame): SavedGame | null {
    return this.open({ format: SAVE_FORMAT, gameId: game.id, engineVersion: game.engineVersion, contentVersion: game.contentVersion, lifeId: game.lifeId, seed: game.seed, log: game.log, updatedAt: Date.parse(game.updatedAt) || 0 });
  }

  /** Sends the life in progress, unless it stands exactly as it did when it was last sent. */
  private async send(cloud: SyncCloud, upload: GameUpload): Promise<void> {
    const standing = `${upload.id} ${upload.stateHash}`;
    if (standing === this.sent) return;
    await cloud.pushGame(upload);
    this.sent = standing;
  }

  private async pass(): Promise<void> {
    const cloud = this.cloud();
    if (cloud === null) {
      this.set('off');
      return;
    }
    this.set('pending');
    try {
      const cloudRuns = await cloud.listRuns();
      const finishedThere = new Set(cloudRuns.map((run) => run.id));

      // The life in progress: which copy is played here. What the device gave up is marked so first,
      // or it would come back as a life waiting in the account.
      let current = this.open(await this.device.loadGame());
      for (const id of [...this.abandoned]) {
        if (id !== current?.gameId) await cloud.abandonGame(id);
        this.abandoned.delete(id);
      }
      const choice = chooseGame(current === null ? null : { gameId: current.gameId, steps: stepsOf(current.log), finished: current.state.finished }, await cloud.playingGames(), this.options.versions);
      if (choice.take === 'cloud') {
        const taken = this.adopt(choice.game);
        if (taken !== null) {
          await this.device.saveGame(taken);
          current = taken;
          this.tell('game');
        }
        this.offered = null;
      } else {
        this.offered = choice.offer;
        // A life the server has already finished is closed in the account: there is nothing to send.
        if (current !== null && !finishedThere.has(current.gameId)) await this.send(cloud, uploadOf(current));
      }

      // What is unlocked: both sides end with everything either had.
      const profile = await this.device.loadProfile();
      const here = progressOf(profile);
      const there = readProgress(await cloud.loadProgress());
      const both = mergeProgress(here, there);
      if (!sameProgress(both, here)) {
        await this.device.saveProfile(withProgress(profile, both));
        this.tell('profile');
      }
      if (!sameProgress(both, there)) await cloud.saveProgress(both);

      // Finished lives: the server finishes the ones it has not seen, and the device learns of the ones it has not lived.
      const mine = await this.device.listRuns();
      const { versions, finishPerSync = 5 } = this.options;
      const unfinished = mine.filter((run) => !finishedThere.has(run.runId) && run.seed !== '' && run.engineVersion === versions.engine && run.contentVersion === versions.content);
      let behind = unfinished.length > finishPerSync;
      for (const run of unfinished.slice(0, finishPerSync)) {
        // The server finishes a life from the game it has been sent: the whole of it goes up first,
        // unless it is the life still on the device, which has just gone.
        if (run.runId !== current?.gameId) {
          await cloud.pushGame({ id: run.runId, lifeId: run.lifeId, engineVersion: run.engineVersion, contentVersion: run.contentVersion, seed: run.seed, round: this.options.content.rounds, log: run.log, stateHash: '' });
        }
        if ((await cloud.finishRun(run.runId)) === 'failed') behind = true;
      }
      const { added } = mergeRuns(mine, cloudRuns.map(asRun));
      for (const run of added) await this.device.addRun(run);
      if (added.length > 0) this.tell('runs');

      this.set(behind ? 'pending' : 'saved');
    } catch {
      // No connection, or the account would not answer. The device has everything; the next sync sends it.
      this.set('pending');
    }
  }
}
