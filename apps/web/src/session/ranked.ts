import type { Journal, LifeDef, LifeRecord, Milestone } from '@ratrace/content';
import type { Content, GameEvent, GameView, Order, RoundChoices, WorldState } from '@ratrace/engine';
import { StaleSession, Unreachable } from './errors';
import { tellProfile } from './profile';
import { SAVE_FORMAT } from './types';
import type { FinishedRun, GameSession, PlayerStore, RankedGame, StepResult } from './types';

/** A ranked life as it stands: how many steps the server has taken, what a client may see of it, and its record. */
export interface RankedStanding {
  step: number;
  view: GameView;
  record: LifeRecord;
}

/** A finished ranked life as the server wrote it. Every figure is the engine's, worked out on the server. */
export interface RankedRun {
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

/** What one step answers: what changed, and no more. `world` is the world of the round that has just begun, if one has. */
export interface RankedStep {
  step: number;
  view: Omit<GameView, 'timeline'>;
  world: WorldState | null;
  events: GameEvent[];
  record: LifeRecord;
  run: RankedRun | null;
}

/**
 * What a ranked life asks of the server. Every one of these throws `Unreachable` when the server
 * cannot answer just now: nothing has changed then, and the same thing can be asked again.
 */
export interface RankedApi {
  start(lifeId: string, versions: { engine: string; content: string }): Promise<RankedStanding & { gameId: string }>;
  /** The life as it stands. `gone` if it was given up, or is nobody's. */
  view(gameId: string): Promise<(RankedStanding & { run: RankedRun | null }) | 'gone'>;
  /** Answers the next card, as step number `step`. `moved` if the life is not where this client thinks it is. */
  card(gameId: string, step: number, option: number): Promise<RankedStep | 'moved'>;
  /** Plays the round, as step number `step`. */
  round(gameId: string, step: number, orders: Order[]): Promise<RankedStep | 'moved'>;
  abandon(gameId: string): Promise<void>;
}

/** The things a ranked session needs from the outside world. */
export interface RankedDeps {
  now(): number;
  /** Told when the device could not write. The game goes on. */
  onSaveError?(error: unknown): void;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** The device's note of a ranked life, if that is what it holds. What the note says of the game is the server's to confirm. */
export function rankedOf(raw: unknown): RankedGame | null {
  if (!isRecord(raw) || raw.format !== SAVE_FORMAT || raw.ranked !== true) return null;
  const { gameId, lifeId, engineVersion, contentVersion, step, view, journal, history, bankruptcies, updatedAt } = raw;
  if (typeof gameId !== 'string' || typeof lifeId !== 'string' || typeof engineVersion !== 'string' || typeof contentVersion !== 'string') return null;
  const seen = isRecord(view) && isRecord(journal) && Array.isArray(view.timeline) && isRecord(view.player);
  return {
    format: SAVE_FORMAT,
    ranked: true,
    gameId,
    lifeId,
    engineVersion,
    contentVersion,
    step: typeof step === 'number' && Number.isSafeInteger(step) && step >= 0 ? step : 0,
    // Seen whole, or not seen at all: half a view is not one.
    view: seen ? (view as unknown as GameView) : null,
    journal: seen ? (journal as unknown as Journal) : null,
    history: Array.isArray(history) ? history.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)) : [],
    bankruptcies: typeof bankruptcies === 'number' && Number.isSafeInteger(bankruptcies) && bankruptcies >= 0 ? bankruptcies : 0,
    updatedAt: typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0,
  };
}

type Seen = RankedGame & { view: GameView; journal: Journal };

/**
 * A life the server plays. This session holds what the server last showed of it and asks for one
 * step at a time; it can change nothing itself. It keeps the device's note of the life up to
 * date, so the life is found again when the page is, and tells the profile what the life earns,
 * exactly as a life played on the device does.
 */
class RankedSession implements GameSession {
  readonly ranked = true;
  /** Steps run one after another, in the order they were asked for. */
  private tail: Promise<unknown> = Promise.resolve();
  /** The `updatedAt` of the note the store last took from this session or gave to it. Null until there is one. */
  private stored: number | null;
  private ofGallery: string[] = [];

  constructor(
    private game: Seen,
    private readonly api: () => RankedApi | null,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly deps: RankedDeps,
    stored: boolean,
  ) {
    this.stored = stored ? game.updatedAt : null;
  }

  get gameId(): string {
    return this.game.gameId;
  }

  get lifeId(): string {
    return this.game.lifeId;
  }

  view(): GameView {
    return this.game.view;
  }

  history(): number[] {
    return [...this.game.history];
  }

  bankruptcies(): number {
    return this.game.bankruptcies;
  }

  badges(): string[] {
    return [...this.game.journal.earned, ...this.ofGallery];
  }

  story(): Milestone[] {
    return this.game.journal.story.milestones;
  }

  answerCard(option: number): Promise<StepResult> {
    return this.take((api, step) => api.card(this.game.gameId, step, option));
  }

  playRound(choices: RoundChoices): Promise<StepResult> {
    return this.take((api, step) => api.round(this.game.gameId, step, choices.orders));
  }

  private take(ask: (api: RankedApi, step: number) => Promise<RankedStep | 'moved'>): Promise<StepResult> {
    const run = async (): Promise<StepResult> => {
      await this.mustBeCurrent();
      const api = this.api();
      if (api === null) throw new Unreachable('nobody is signed in');
      const reply = await ask(api, this.game.step);
      // The server is somewhere else in this life than this session thought: it is opened again as it stands.
      if (reply === 'moved') throw new StaleSession();
      const before = this.game.view;
      const view = { ...reply.view, timeline: reply.world ? [...before.timeline, reply.world] : before.timeline } as GameView;
      // A view always holds one world a round and the one it is in. Anything else is not the life this session was following.
      if (view.timeline.length !== view.round + 1) throw new StaleSession();
      this.game = { ...this.game, step: reply.step, view, history: reply.record.history, bankruptcies: reply.record.bankruptcies, journal: reply.record.journal, updatedAt: this.deps.now() };
      await this.persist(reply.run);
      const had = this.ofGallery.length;
      const news = await this.learn();
      // The run was written before the profile could say which gallery badges this life earned: write it again with them.
      if (reply.run && this.ofGallery.length !== had) await this.persist(reply.run);
      return { view, events: reply.events, earned: news.earned, unlocked: news.unlocked };
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  /**
   * Refuses to go on if the store holds something other than what this session last put there:
   * another tab has started or taken up another life on this device.
   */
  private async mustBeCurrent(): Promise<void> {
    if (this.stored === null) return;
    let raw: unknown;
    try {
      raw = await this.store.loadGame();
    } catch {
      return;
    }
    const record = isRecord(raw) ? raw : null;
    if (record === null || record.gameId !== this.game.gameId || record.updatedAt !== this.stored) throw new StaleSession();
  }

  /** Writes the note of the life as it stands, and its record among the finished lives once it is over. A failure is reported and otherwise ignored. */
  async persist(run: RankedRun | null = null): Promise<void> {
    try {
      if (run) await this.store.addRun(this.asRun(run));
      await this.store.saveGame(this.game);
      this.stored = this.game.updatedAt;
    } catch (error) {
      this.deps.onSaveError?.(error);
    }
  }

  async learn(): Promise<{ earned: string[]; unlocked: string[] }> {
    try {
      const { game } = this;
      const told = await tellProfile(this.store, this.content, this.lives, { gameId: game.gameId, at: game.updatedAt, earned: game.journal.earned, collection: game.view.player.life.collection, over: game.view.finished });
      this.ofGallery = told.ofGallery;
      return { earned: told.earned, unlocked: told.unlocked };
    } catch (error) {
      this.deps.onSaveError?.(error);
      return { earned: [], unlocked: [] };
    }
  }

  /** The finished life for the records of this device. The figures are the server's; the seed and the log stay with it. */
  private asRun(run: RankedRun): FinishedRun {
    return {
      format: SAVE_FORMAT,
      runId: run.id,
      engineVersion: run.engineVersion,
      contentVersion: run.contentVersion,
      lifeId: run.lifeId,
      seed: '',
      log: [],
      finishedAt: Date.parse(run.finishedAt) || this.deps.now(),
      score: run.score,
      netWorth: run.netWorth,
      status: run.status,
      escapedAtRound: run.escapedAtRound,
      bankruptcies: run.bankruptcies,
      history: run.history,
      badges: this.badges(),
      cities: run.cities,
      verified: false,
      ranked: true,
    };
  }
}

/** Ranked lives: the ones the server plays. `api` is the server while someone is signed in, and null otherwise. */
export class RankedSessions {
  constructor(
    private readonly api: () => RankedApi | null,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly versions: { engine: string; content: string },
    private readonly deps: RankedDeps,
  ) {}

  /** True while there is a server to ask. It may still not answer. */
  available(): boolean {
    return this.api() !== null;
  }

  /** Starts a ranked life. Throws `Unreachable` if the server cannot take it now, and the life then begins as a casual one. */
  async start(lifeId: string): Promise<GameSession> {
    const life = this.lives.find((candidate) => candidate.id === lifeId);
    if (!life) throw new Error(`unknown life: ${lifeId}`);
    // Which lives a player may choose is decided here, as for a casual life, and again by the server.
    if (life.unlock !== 'default' && !Object.hasOwn((await this.store.loadProfile()).unlocked, life.id)) throw new Error(`locked life: ${lifeId}`);
    const api = this.api();
    if (api === null) throw new Unreachable('nobody is signed in');
    const begun = await api.start(lifeId, this.versions);
    const session = this.open({ format: SAVE_FORMAT, ranked: true, gameId: begun.gameId, lifeId, engineVersion: this.versions.engine, contentVersion: this.versions.content, updatedAt: this.deps.now() }, begun, false);
    await session.persist();
    return session;
  }

  /**
   * Takes up the ranked life the device has a note of. The server says where it stands; with no
   * connection it is shown as it was last seen, if it ever was. Null if it was given up meanwhile,
   * and the note is then thrown away.
   */
  async resume(note: RankedGame): Promise<GameSession | null> {
    const api = this.api();
    let now: (RankedStanding & { run: RankedRun | null }) | 'gone' | null = null;
    if (api !== null) {
      try {
        now = await api.view(note.gameId);
      } catch (error) {
        if (!(error instanceof Unreachable)) throw error;
      }
    }
    if (now === 'gone') {
      await this.store.clearGame();
      return null;
    }
    if (now === null) {
      // Nobody to ask. What was last seen can be looked at; what was never seen waits.
      if (note.view === null || note.journal === null) return null;
      const session = new RankedSession(note as Seen, this.api, this.store, this.content, this.lives, this.deps, true);
      void session.learn();
      return session;
    }
    // Played further elsewhere, or never seen here: the note is brought up to what the server says.
    const moved = note.view === null || note.step !== now.step;
    const session = this.open({ ...note, updatedAt: moved ? this.deps.now() : note.updatedAt }, now, !moved);
    if (moved || now.run) await session.persist(now.run);
    void session.learn();
    return session;
  }

  /** Gives a ranked life up on the server. Quietly: if it cannot be told now, starting the next ranked life tells it. */
  async giveUp(gameId: string): Promise<void> {
    try {
      await this.api()?.abandon(gameId);
    } catch {
      // The server gives up a ranked life in progress whenever a new one is started.
    }
  }

  private open(header: Omit<RankedGame, 'step' | 'view' | 'history' | 'bankruptcies' | 'journal'>, at: RankedStanding, stored: boolean): RankedSession {
    const game: Seen = { ...header, step: at.step, view: at.view, history: at.record.history, bankruptcies: at.record.bankruptcies, journal: at.record.journal };
    return new RankedSession(game, this.api, this.store, this.content, this.lives, this.deps, stored);
  }
}
