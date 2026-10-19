import type { LifeDef } from '@ratrace/content';
import { stateHash } from '@ratrace/engine';
import type { Content } from '@ratrace/engine';
import { rankedNote, rankedOf } from '@ratrace/core/session/ranked';
import { openSave } from '@ratrace/core/session/save';
import { SAVE_FORMAT } from '@ratrace/core/session/types';
import type { Earned, FinishedRun, PlayerStore, Profile, SavedGame, StoredGame } from '@ratrace/core/session/types';
import { chooseGame, mergeProgress, mergeRuns, progressOf, readProgress, sameProgress, stepsOf, withProgress } from './merge';
import type { CloudGame, Progress } from './merge';
import type { AccountLife, AccountSaves, CloudSaving, DeviceChange } from './types';

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
  /** The week whose challenge this life practises, or null. */
  challenge?: string | null;
}

/** A finished life as the server wrote it. Every figure is the engine's, worked out on the server. */
export interface CloudRun {
  id: string;
  /** `ranked` for a life the server played itself, `room` for one it played in a room. Left out, a casual one. */
  mode?: 'casual' | 'ranked' | 'room';
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
  /** The week whose challenge this life was, or left out. */
  challenge?: string;
}

/** What the mirror asks of the account. Any of it may fail: the device is then simply ahead for a while. */
export interface SyncCloud {
  /** The player's lives still being played, the latest first. */
  playingGames(): Promise<CloudGame[]>;
  /**
   * Saves the player's own life as one being played, which takes up again one that was given up.
   * `closed`: the server has finished it, and it stays as it is. `taken`: the id is another
   * account's. `behind`: the account holds more of this life than this save does, and keeps it.
   */
  pushGame(game: GameUpload): Promise<'saved' | 'closed' | 'taken' | 'behind'>;
  /** Gives up a life that is being played. It is no longer offered to the player's other devices. */
  abandonGame(id: string): Promise<void>;
  loadProgress(): Promise<unknown>;
  saveProgress(progress: Progress): Promise<void>;
  /** The player's finished lives. */
  listRuns(): Promise<CloudRun[]>;
  /** The ranked life the player has in progress on the server, if they have one. */
  rankedLife(): Promise<{ id: string; lifeId: string; engineVersion: string; contentVersion: string; challenge?: string | null } | null>;
  /** Gives up a ranked life on the server that plays it. Throws if the server cannot be told just now. */
  giveUpRanked(id: string): Promise<void>;
  /**
   * Has the server finish a life it has been sent. `refused` if it would not; `unknown-version` if
   * it does not hold the versions the life was lived on; `failed` if it could not be asked.
   */
  finishRun(gameId: string): Promise<'done' | 'refused' | 'unknown-version' | 'failed'>;
}

interface Options {
  content: Content;
  lives: ReadonlyArray<LifeDef>;
  /** The versions this build plays. A life in progress on others is left alone in the account. */
  versions: { engine: string; content: string };
  /** Makes an id for a life the account will not take under its own. */
  newId(): string;
  /** Does `run` in `ms` milliseconds. A test hands in its own, and runs it when it likes. */
  schedule?(run: () => Promise<void>, ms: number): void;
  /** How many finished lives one go asks the server to finish. The rest follow a little later. */
  finishPerSync?: number;
  /** Where the lives given up are noted until the account has been told, so that closing the page does not forget them. */
  remember?: { read(): string[]; write(ids: string[]): void };
}

/** What the account held when it was last read, kept up with what has been sent to it since. */
interface Known {
  /** The lives the server has finished. */
  finished: Set<string>;
  progress: Progress;
}

/** How long after a write it is sent: long enough for a burst of writes to go as one. */
const SOON = 1_500;
/** How long before the next few finished lives are sent, when there are more than one go takes. */
const NEXT_FEW = 5_000;
/** How long after a failure the first new try comes. Each one after waits twice as long, up to the longest. */
const RETRY = 30_000;
const LONGEST_RETRY = 300_000;

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
  ...(run.mode === 'ranked' ? { ranked: true as const } : {}),
  ...(run.mode === 'room' ? { room: true as const } : {}),
  ...(run.challenge !== undefined ? { challenge: run.challenge } : {}),
});

const uploadOf = (save: SavedGame): GameUpload => ({
  id: save.gameId,
  lifeId: save.lifeId,
  engineVersion: save.engineVersion,
  contentVersion: save.contentVersion,
  seed: save.seed,
  round: save.state.round,
  log: save.log,
  stateHash: stateHash(save.state),
  challenge: save.challenge ?? null,
});
/** A life and how it stands, in a word: two of these are equal when there is nothing new to send. */
const standing = (upload: GameUpload): string => `${upload.id} ${upload.stateHash}`;

/** How a ranked life is written among the lives given up: it is the server that plays it that is told, not the table of games. */
const RANKED = 'ranked:';

/**
 * The player's store, with the account as its mirror.
 *
 * The device is written first and is always enough: every read comes from it, and no write waits
 * for the network. The account follows. When the two meet (the page opens, the connection comes
 * back, someone signs in) the account is read, and the device takes what it lacks. After that
 * every write is sent, and the account is not read again for it. Nothing is queued write by
 * write, because what is sent is always the whole of what the device has; and nothing here ever
 * fails: with no connection the device is simply ahead for a while.
 */
export class MirroredStore implements PlayerStore, AccountSaves {
  private state: CloudSaving = 'off';
  private readonly watchers = new Set<() => void>();
  private readonly changes = new Set<(what: DeviceChange) => void>();
  /** Lives the device gave up, still to be marked so in the account. */
  private readonly abandoned: Set<string>;
  /** A different life waiting in the account: the save it would open as, and what a screen is told of it. */
  private offered: { save: SavedGame; life: AccountLife } | null = null;
  private known: Known | null = null;
  /** The life last sent and how it stood, so that nothing is sent when there is nothing new to say. */
  private sent: string | null = null;
  /** Finished lives the server would not take. They are not sent to it again until the page is opened anew. */
  private readonly refused = new Set<string>();
  /** Pairs of versions the server said it does not hold. No life on them is sent until the page is opened anew. */
  private readonly unheld = new Set<string>();

  private running: Promise<void> | null = null;
  /** What has been asked for and not begun: nothing, sending what the device has, or reading the account first. */
  private wanted: 'nothing' | 'send' | 'meet' = 'nothing';
  private failures = 0;
  private retrying = false;

  constructor(
    private readonly device: PlayerStore,
    private readonly cloud: () => SyncCloud | null,
    private readonly options: Options,
  ) {
    this.abandoned = new Set(options.remember?.read() ?? []);
  }

  // ------------------------------------------------------------------ the device, as it always was
  readonly loadGame = (): Promise<unknown> => this.device.loadGame();
  readonly listRuns = (): Promise<FinishedRun[]> => this.device.listRuns();
  readonly loadProfile = (): Promise<Profile> => this.device.loadProfile();

  readonly saveGame = async (game: StoredGame): Promise<void> => {
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

  readonly removeRun = (runId: string): Promise<void> => this.device.removeRun(runId);

  readonly saveProfile = async (profile: Profile): Promise<void> => {
    await this.device.saveProfile(profile);
    this.poke();
  };

  /** A life in progress that is about to give way to another is given up in the account too. */
  private async noteReplaced(next: string | null): Promise<void> {
    const held = await this.device.loadGame().catch(() => null);
    const note = rankedOf(held);
    if (note !== null) {
      // A ranked life is given up on the server only if this device was living it: shown to its player, and not over.
      // One nobody opened here was never asked about. One begun under other rules may still be lived elsewhere under them.
      const ours = note.engineVersion === this.options.versions.engine && note.contentVersion === this.options.versions.content;
      if (note.gameId !== next && note.view !== null && !note.view.finished && ours) this.giveUp(`${RANKED}${note.gameId}`);
      return;
    }
    const current = this.open(held);
    if (current !== null && current.gameId !== next && !current.state.finished) this.giveUp(current.gameId);
  }

  private giveUp(id: string): void {
    this.abandoned.add(id);
    this.options.remember?.write([...this.abandoned]);
  }

  // ------------------------------------------------------------------ what whoever shows it can ask
  readonly status = (): CloudSaving => this.state;

  /** Calls `listener` when the status or the offer changes. Returns how to stop. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.watchers.add(listener);
    return () => {
      this.watchers.delete(listener);
    };
  };

  /** Calls `listener` when the account has changed what the device holds. Returns how to stop. */
  readonly onDeviceChanged = (listener: (what: DeviceChange) => void): (() => void) => {
    this.changes.add(listener);
    return () => {
      this.changes.delete(listener);
    };
  };

  /** A different life in progress waiting in the account, if there is one. It is never taken unasked. */
  readonly offer = (): AccountLife | null => this.offered?.life ?? null;

  /**
   * Takes the offered life in place of the device's own, which is given up. False if there was none.
   * Whoever asked is not told that the device changed: they know. The account is then read again,
   * so if the life has been played further since it was offered, it is the further copy that stays.
   */
  readonly takeOffer = async (): Promise<boolean> => {
    const offered = this.offered;
    if (offered === null) return false;
    await this.noteReplaced(offered.save.gameId);
    await this.device.saveGame(offered.save);
    this.sent = standing(uploadOf(offered.save));
    this.setOffer(null);
    this.later(() => this.sync(), 0);
    return true;
  };

  /** Ends the offered life in the account instead. The life on the device is left as it is. */
  readonly declineOffer = async (): Promise<void> => {
    const offered = this.offered;
    if (offered === null) return;
    this.giveUp(offered.save.gameId);
    this.setOffer(null);
    this.poke();
  };

  /**
   * Brings the device and the account together: reads the account, takes what the device lacks,
   * sends what the account lacks. Never throws. One runs at a time; asked again meanwhile, it runs
   * once more when the first is done, so the latest writes are not missed.
   */
  readonly sync = (): Promise<void> => this.run('meet');

  /**
   * Someone else is signed in now: nothing is assumed about what their account holds. It is read,
   * and what the device has goes up to it. What it will not take under its own id, because the
   * account this device was before still holds that id, gets a new one.
   */
  readonly accountChanged = (): Promise<void> => {
    this.known = null;
    this.refused.clear();
    this.setOffer(null);
    return this.run('meet');
  };

  // ------------------------------------------------------------------ when it runs
  private later(run: () => Promise<void>, ms: number): void {
    (this.options.schedule ?? ((go, wait) => void setTimeout(() => void go(), wait)))(run, ms);
  }

  /** The device has written something: it is sent a little later, with whatever else is written until then. */
  private poke(): void {
    if (this.cloud() === null) return;
    if (this.state !== 'waiting') this.set('sending');
    this.later(() => this.run('send'), SOON);
  }

  private run(what: 'send' | 'meet'): Promise<void> {
    if (what === 'meet' || this.wanted === 'nothing') this.wanted = what;
    return (this.running ??= this.drain());
  }

  private async drain(): Promise<void> {
    // Not in the same breath as whoever asked: `running` is theirs to read before the first pass begins.
    await Promise.resolve();
    try {
      while (this.wanted !== 'nothing') {
        const meet = this.wanted === 'meet';
        this.wanted = 'nothing';
        await this.pass(meet);
      }
    } finally {
      this.running = null;
    }
  }

  private async pass(meet: boolean): Promise<void> {
    const cloud = this.cloud();
    if (cloud === null) {
      this.set('off');
      return;
    }
    if (this.state === 'off') this.set('sending');
    try {
      await this.giveUpThere(cloud);
      const met = meet || this.known === null;
      const known = met ? (this.known = await this.meet(cloud)) : (this.known as Known);
      const outcome = await this.send(cloud, known, met);
      if (outcome === 'failed') throw new Error('the account did not take it');
      if (outcome === 'meet') {
        // The account knows something this device does not. It is read before anything is called saved.
        this.wanted = 'meet';
        return;
      }
      this.failures = 0;
      this.set(outcome === 'more' ? 'sending' : 'saved');
      if (outcome === 'more') this.later(() => this.run('send'), NEXT_FEW);
    } catch {
      // No connection, or the account would not answer. The device has everything, and what it has is sent
      // whole by the next try: one comes by itself, later each time, and any write or return of the connection is one too.
      this.set('waiting');
      if (!this.retrying) {
        this.retrying = true;
        const wait = Math.min(RETRY * 2 ** this.failures, LONGEST_RETRY);
        this.failures += 1;
        this.later(() => {
          this.retrying = false;
          return this.run('meet');
        }, wait);
      }
    }
  }

  // ------------------------------------------------------------------ what it does
  private set(next: CloudSaving): void {
    if (this.state === next) return;
    this.state = next;
    for (const watcher of this.watchers) watcher();
  }

  private setOffer(next: SavedGame | null): void {
    if ((this.offered?.save.gameId ?? null) === (next?.gameId ?? null) && this.offered?.save.state.round === next?.state.round) return;
    this.offered = next === null ? null : { save: next, life: { gameId: next.gameId, lifeId: next.lifeId, round: next.state.round, cityId: next.state.player.cityId } };
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

  /**
   * A life from the account as a save of this device: rebuilt by playing its log again, so a copy
   * that has been damaged or tampered with cannot be opened as sound. Null if it cannot, or if it is over.
   */
  private adopt(game: CloudGame): SavedGame | null {
    const save = this.open({
      format: SAVE_FORMAT,
      gameId: game.id,
      engineVersion: game.engineVersion,
      contentVersion: game.contentVersion,
      lifeId: game.lifeId,
      ...(game.challenge ? { challenge: game.challenge } : {}),
      seed: game.seed,
      log: game.log,
      updatedAt: Date.parse(game.updatedAt) || 0,
    });
    return save === null || save.state.finished ? null : save;
  }

  /** Marks in the account the lives the device gave up. First of all, or they would come back as lives waiting there. */
  private async giveUpThere(cloud: SyncCloud): Promise<void> {
    if (this.abandoned.size === 0) return;
    const current = this.open(await this.device.loadGame());
    for (const id of [...this.abandoned]) {
      if (id.startsWith(RANKED)) {
        // The server that plays ranked lives is asked on its own, and may be away when the account is not. The life
        // stays on the list for the next time, and nothing else waits for it.
        try {
          await cloud.giveUpRanked(id.slice(RANKED.length));
        } catch {
          continue;
        }
      } else if (id !== current?.gameId) await cloud.abandonGame(id);
      this.abandoned.delete(id);
      this.options.remember?.write([...this.abandoned]);
    }
  }

  /** Reads the account, and gives the device what it lacks: a life in progress, and the lives finished elsewhere. */
  private async meet(cloud: SyncCloud): Promise<Known> {
    // Everything is asked of the account first, and the device is looked at only then: what the
    // player did while the answers were on their way is not decided over.
    const runs = await cloud.listRuns();
    const playing = await cloud.playingGames();
    const progress = readProgress(await cloud.loadProgress());
    const finished = new Set(runs.map((run) => run.id));
    // Only a device with no life at all takes the ranked life the account has in progress, so only it asks for one:
    // a first look says whether to. One the device has yet to give up is not one to take back.
    const before = await this.device.loadGame();
    const living = this.open(before);
    const empty = rankedOf(before) === null && (living === null || (!living.state.finished && finished.has(living.gameId)));
    const there = empty ? await cloud.rankedLife() : null;
    const ranked = there !== null && !this.abandoned.has(`${RANKED}${there.id}`) ? there : null;
    let moved = false;

    // The device is looked at for good only now, with everything asked: a life begun meanwhile is the one it has.
    const held = await this.device.loadGame();
    // A ranked life is the server's. The device holds a note of it, which is not a game to send, to
    // replace or to judge here: it stands for "this device has a life", and that is all.
    let note = rankedOf(held);
    let current = note === null ? this.open(held) : null;
    // A life this device was still living that has been lived to the end elsewhere is over here too.
    // Its result is among the finished lives.
    if (current !== null && !current.state.finished && finished.has(current.gameId)) {
      await this.device.clearGame();
      current = null;
      moved = true;
    }
    // A device with no life at all takes the ranked life the account has in progress, as a note: the
    // life is opened from the server when the player goes to it.
    if (current === null && note === null && ranked !== null && ranked.engineVersion === this.options.versions.engine && ranked.contentVersion === this.options.versions.content) {
      note = rankedNote({ gameId: ranked.id, lifeId: ranked.lifeId, engineVersion: ranked.engineVersion, contentVersion: ranked.contentVersion, challenge: ranked.challenge ?? null });
      await this.device.saveGame(note);
      moved = true;
    }

    // Which life is played here. One the player has given up since the account answered is not one to
    // take or to offer; a copy that does not play back to a sound life is passed over, and the next is tried.
    let games = playing.filter((game) => !this.abandoned.has(game.id));
    let waiting: SavedGame | null = null;
    for (;;) {
      const mine = note !== null ? { gameId: note.gameId, steps: 0, finished: note.view?.finished === true } : current === null ? null : { gameId: current.gameId, steps: stepsOf(current.log), finished: current.state.finished };
      const choice = chooseGame(mine, games, this.options.versions);
      const candidate = choice.take === 'cloud' ? choice.game : choice.offer;
      if (candidate === null) break;
      games = games.filter((game) => game !== candidate);
      const save = this.adopt(candidate);
      if (save === null) continue;
      if (choice.take === 'device') {
        waiting = save;
        break;
      }
      await this.device.saveGame(save);
      current = save;
      moved = true;
    }
    // What the device holds goes up next, unless the account has that very copy, standing there
    // exactly as it does here: the one just taken from it, for one. A copy written over the
    // device's own there, since this device last sent, does not stand.
    const mine = current === null ? null : uploadOf(current);
    const theirs = playing.find((game) => game.id === current?.gameId);
    this.sent = mine !== null && theirs?.stateHash === mine.stateHash ? standing(mine) : null;
    this.setOffer(waiting);
    if (moved) this.tell('game');

    const { added } = mergeRuns(await this.device.listRuns(), runs.map(asRun));
    for (const run of added) await this.device.addRun(run);
    if (added.length > 0) this.tell('runs');
    return { finished, progress };
  }

  /**
   * Gives a life of the device a new id, wherever the device keeps it: the life in progress, its
   * record among the finished lives, and what it earned. Returns the id. For a life the account
   * will not take under its own: an id belongs to whoever saved it first, and that was the account
   * this device was before, most often a guest whose player has since signed in as someone else.
   */
  private async renamed(oldId: string): Promise<string> {
    const id = this.options.newId();
    const game = this.open(await this.device.loadGame());
    if (game?.gameId === oldId) await this.device.saveGame({ ...game, gameId: id });
    const run = (await this.device.listRuns()).find((one) => one.runId === oldId);
    if (run) {
      // In under its new id before it is out under the old one: never neither.
      await this.device.addRun({ ...run, runId: id });
      await this.device.removeRun(oldId);
    }
    const profile = await this.device.loadProfile();
    const pointed = (earned: Record<string, Earned>): Record<string, Earned> =>
      Object.fromEntries(Object.entries(earned).map(([what, entry]) => [what, entry.gameId === oldId ? { ...entry, gameId: id } : entry]));
    await this.device.saveProfile({ ...profile, badges: pointed(profile.badges), unlocked: pointed(profile.unlocked) });
    this.tell('renamed');
    return id;
  }

  /**
   * Sends what the device has that the account, as far as is known, lacks. `more` if there are
   * finished lives left for another go; `meet` if the account turned out to know something this
   * device does not, and must be read first; `failed` if it could not take what it was sent.
   */
  private async send(cloud: SyncCloud, known: Known, justMet: boolean): Promise<'all' | 'more' | 'meet' | 'failed'> {
    // The life in progress, unless it stands exactly as it did when it was last sent.
    let current = this.open(await this.device.loadGame());
    if (current !== null && !known.finished.has(current.gameId)) {
      let upload = uploadOf(current);
      if (standing(upload) !== this.sent) {
        let answer = await cloud.pushGame(upload);
        if (answer === 'taken') {
          await this.renamed(current.gameId);
          current = this.open(await this.device.loadGame());
          if (current === null) return 'failed';
          upload = uploadOf(current);
          answer = await cloud.pushGame(upload);
        }
        // The account holds more of this life, or the server has finished it. That is news: the
        // account is read before anything is called saved. If it has just been read and still
        // will not take the life, there is nothing to do but wait and try again.
        if (answer === 'behind' || answer === 'taken') return justMet ? 'failed' : 'meet';
        if (answer === 'closed' && !justMet) return 'meet';
        this.sent = standing(upload);
      }
    }

    // Finished lives the server has not seen: it is sent the whole game, and finishes it itself.
    const { finishPerSync = 5 } = this.options;
    const versionsOf = (run: FinishedRun) => `${run.engineVersion}/${run.contentVersion}`;
    // One known only by its result has no log to send; one the server would not take is not sent again.
    const unseen = (await this.device.listRuns()).filter((run) => !known.finished.has(run.runId) && !this.refused.has(run.runId) && run.seed !== '');
    let asked = 0;
    let more = false;
    for (const run of unseen) {
      // The server said it does not hold these versions: no life on them is worth sending.
      if (this.unheld.has(versionsOf(run))) continue;
      // The rest wait for another go; what is unlocked does not wait for them.
      if (asked === finishPerSync) {
        more = true;
        break;
      }
      asked += 1;
      let id = run.runId;
      // The life still on the device has just gone up.
      if (id !== current?.gameId) {
        const whole = (as: string): GameUpload => ({
          id: as,
          lifeId: run.lifeId,
          engineVersion: run.engineVersion,
          contentVersion: run.contentVersion,
          seed: run.seed,
          round: this.options.content.rounds,
          log: run.log,
          stateHash: '',
          challenge: run.challenge ?? null,
        });
        if ((await cloud.pushGame(whole(id))) === 'taken') {
          id = await this.renamed(id);
          await cloud.pushGame(whole(id));
        }
      }
      const answer = await cloud.finishRun(id);
      if (answer === 'failed') return 'failed';
      if (answer === 'done') {
        known.finished.add(id);
        continue;
      }
      // It answered, and would not: asking again will not change its mind. What it will not finish
      // is not left in the account as a life being played, where another device would be offered it.
      if (answer === 'unknown-version') this.unheld.add(versionsOf(run));
      else this.refused.add(id);
      await cloud.abandonGame(id);
    }

    // What is unlocked: both sides end with everything either had. Another device may have added to
    // the account since it was last read, so it is read again before it is written over.
    const profile = await this.device.loadProfile();
    const here = progressOf(profile);
    let both = mergeProgress(here, known.progress);
    if (!sameProgress(both, known.progress)) {
      if (!justMet) {
        known.progress = readProgress(await cloud.loadProgress());
        both = mergeProgress(here, known.progress);
      }
      if (!sameProgress(both, known.progress)) {
        await cloud.saveProgress(both);
        known.progress = both;
      }
    }
    if (!sameProgress(both, here)) {
      await this.device.saveProfile(withProgress(profile, both));
      this.tell('profile');
    }
    return more ? 'more' : 'all';
  }
}
