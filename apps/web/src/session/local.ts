import type { LifeDef } from '@ratrace/content';
import { CONTENT_VERSION } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, livedStatus, realNetWorth, viewOf } from '@ratrace/engine';
import type { Content, GameView, RoundChoices } from '@ratrace/engine';
import { StaleSession } from './errors';
import { profileAfter, updateProfile } from './profile';
import { recordStart, recordStep } from './record';
import { openSave } from './save';
import { SAVE_FORMAT } from './types';
import type { FinishedRun, GameSession, Lost, PlayerStore, SavedGame, Sessions, StepResult } from './types';

/** The things a session needs from the outside world. Tests supply their own, so nothing here is random or timed. */
export interface SessionDeps {
  newId(): string;
  newSeed(): string;
  now(): number;
  /** Told when a save could not be written. The game goes on; only the safety net is gone. */
  onSaveError?(error: unknown): void;
}

/**
 * A game that runs in the browser. It keeps the full game to itself, and hands out views:
 * the screens never hold the seed or a future world, exactly as they will not in ranked online play.
 * It also judges the badges of each step and tells the profile, as a server will later.
 */
class LocalSession implements GameSession {
  private current: GameView;
  /** Steps run one after another, in the order they were asked for. */
  private tail: Promise<unknown> = Promise.resolve();
  /** The `updatedAt` of the record the store last took from this session or gave to it. Null until there is one. */
  private stored: number | null;
  /** Badges the profile counts as earned in this life that the life's own journal cannot know: those of the gallery. */
  private ofGallery: string[] = [];

  /** `stored` says whether `save` is already in the store, as it is for a life that was just loaded. */
  constructor(
    private save: SavedGame,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly deps: SessionDeps,
    stored: boolean,
  ) {
    this.current = viewOf(save.state);
    this.stored = stored ? save.updatedAt : null;
  }

  get gameId(): string {
    return this.save.gameId;
  }

  get lifeId(): string {
    return this.save.lifeId;
  }

  view(): GameView {
    return this.current;
  }

  history(): number[] {
    return [...this.save.history];
  }

  bankruptcies(): number {
    return this.save.bankruptcies;
  }

  badges(): string[] {
    return [...this.save.journal.earned, ...this.ofGallery];
  }

  answerCard(option: number): Promise<StepResult> {
    return this.step(async () => {
      await this.mustBeCurrent();
      const state = this.save.state;
      // What is logged must replay to the same game: a whole number, or the first option the engine falls back to.
      const asked = Number.isSafeInteger(option) && option >= 0 ? option : 0;
      const result = applyCard(this.content, state, asked);
      const log = [...this.save.log];
      log[state.round] = { picks: [...(log[state.round]?.picks ?? []), asked], orders: null };
      return this.settle(log, result, []);
    });
  }

  playRound(choices: RoundChoices): Promise<StepResult> {
    return this.step(async () => {
      await this.mustBeCurrent();
      const state = this.save.state;
      const result = applyRound(this.content, state, choices);
      const log = [...this.save.log];
      log[state.round] = { picks: log[state.round]?.picks ?? [], orders: structuredClone(choices.orders) };
      return this.settle(log, result, choices.orders);
    });
  }

  /**
   * Writes the game as it stands. A failure is reported and otherwise ignored.
   * A finished life is recorded as a run and also kept as the game, so that closing the page on
   * the last ledger or on the score does not lose the result; the next life replaces it.
   */
  async persist(): Promise<void> {
    try {
      if (this.save.state.finished) await this.store.addRun(this.asRun());
      await this.store.saveGame(this.save);
      this.stored = this.save.updatedAt;
    } catch (error) {
      this.deps.onSaveError?.(error);
    }
  }

  /**
   * Tells the profile everything the life has earned and owned so far: badges it has not held
   * before, the gallery, and the lives those unlock. It tells all of it every time, not only the
   * step just played, so that whatever a failed write or an older version of the game left out
   * is put right by the next step. Returns what is new, for the screen to celebrate.
   */
  async tellProfile(): Promise<{ earned: string[]; unlocked: string[] }> {
    const { save } = this;
    try {
      // Lives lived to the end, this one included if it just ended. A list that cannot be read counts as empty.
      const runs = await this.store.listRuns().catch(() => []);
      const finished = Math.max(runs.length, save.state.finished ? 1 : 0);
      const step = { gameId: save.gameId, at: save.updatedAt, earned: save.journal.earned, collection: save.state.player.life.collection, finished };
      let news = { earned: [] as string[], unlocked: [] as string[] };
      const profile = await updateProfile(this.store, (current) => {
        const after = profileAfter(this.content, this.lives, current, step);
        news = { earned: after.earned, unlocked: after.unlocked };
        return after.profile;
      });
      this.ofGallery = Object.keys(profile.badges).filter((id) => profile.badges[id].gameId === save.gameId && !save.journal.earned.includes(id));
      return news;
    } catch (error) {
      this.deps.onSaveError?.(error);
      return { earned: [], unlocked: [] };
    }
  }

  /**
   * Refuses to go on if the store holds something other than what this session last put there:
   * two tabs on one life would otherwise overwrite each other without a word.
   * A store that cannot be read cannot contradict the session, and the game goes on.
   */
  private async mustBeCurrent(): Promise<void> {
    if (this.stored === null) return;
    let raw: unknown;
    try {
      raw = await this.store.loadGame();
    } catch {
      return;
    }
    const record = typeof raw === 'object' && raw !== null ? (raw as Partial<SavedGame>) : null;
    if (record === null || record.gameId !== this.save.gameId || record.updatedAt !== this.stored) throw new StaleSession();
  }

  /** Takes a step the engine has played: keeps the record, saves, tells the profile, and hands back the view. */
  private async settle(log: SavedGame['log'], result: { state: SavedGame['state']; events: StepResult['events'] }, orders: RoundChoices['orders']): Promise<StepResult> {
    const before = this.save;
    const { record } = recordStep(this.content, { history: before.history, bankruptcies: before.bankruptcies, journal: before.journal }, before.state, result.state, result.events, orders);
    this.save = { ...before, log, ...record, state: result.state, updatedAt: this.deps.now() };
    this.current = viewOf(this.save.state);
    await this.persist();
    const had = this.ofGallery.length;
    const news = await this.tellProfile();
    // The run was written before the profile could say which gallery badges this life earned: write it again with them.
    if (this.save.state.finished && this.ofGallery.length !== had) await this.persist();
    return { view: this.current, events: result.events, earned: news.earned, unlocked: news.unlocked };
  }

  private step<T>(run: () => Promise<T>): Promise<T> {
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

  private asRun(): FinishedRun {
    const { save } = this;
    return {
      format: SAVE_FORMAT,
      runId: save.gameId,
      engineVersion: save.engineVersion,
      contentVersion: save.contentVersion,
      lifeId: save.lifeId,
      seed: save.seed,
      log: save.log,
      finishedAt: save.updatedAt,
      score: finalScore(this.content, save.state),
      netWorth: realNetWorth(save.state),
      status: livedStatus(save.state),
      escapedAtRound: save.state.player.escapedAtRound,
      bankruptcies: save.bankruptcies,
      history: save.history,
      badges: this.badges(),
      cities: save.journal.cities,
      verified: false,
    };
  }
}

/** Games that run on this device. */
export class LocalSessions implements Sessions {
  constructor(
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly deps: SessionDeps,
  ) {}

  async start(lifeId: string): Promise<GameSession> {
    const life = this.lives.find((candidate) => candidate.id === lifeId);
    if (!life) throw new Error(`unknown life: ${lifeId}`);
    // Which lives a player may choose is decided here, not by a button that happens to be disabled.
    if (life.unlock !== 'default' && !Object.hasOwn((await this.store.loadProfile()).unlocked, life.id)) throw new Error(`locked life: ${lifeId}`);
    const gameId = this.deps.newId();
    const seed = this.deps.newSeed();
    const state = createGame({ content: this.content, start: life.start }, seed);
    const session = new LocalSession(
      {
        format: SAVE_FORMAT,
        gameId,
        engineVersion: ENGINE_VERSION,
        contentVersion: CONTENT_VERSION,
        lifeId,
        seed,
        log: [],
        ...recordStart(this.content, state),
        state,
        updatedAt: this.deps.now(),
      },
      this.store,
      this.content,
      this.lives,
      this.deps,
      false,
    );
    await session.persist();
    return session;
  }

  async resume(): Promise<{ session: GameSession | null; lost: Lost | null }> {
    const raw = await this.store.loadGame();
    if (raw === null || raw === undefined) return { session: null, lost: null };
    const opened = openSave(raw, this.content, this.lives);
    if (!opened.ok) {
      // A save this page is too old to read is not this page's to throw away: the newer page that wrote it can open it.
      if (opened.lost !== 'newer') await this.store.clearGame();
      return { session: null, lost: opened.lost };
    }
    // A repaired save keeps its `updatedAt`, so the stored record is still the one this session answers for.
    const session = new LocalSession(opened.save, this.store, this.content, this.lives, this.deps, true);
    if (opened.repaired) await session.persist();
    // Whatever the life had earned that the profile does not hold yet is put right now. Opening the life does not
    // wait for it: it is bookkeeping, and the first step would do the same.
    void session.tellProfile();
    return { session, lost: null };
  }

  async abandon(): Promise<void> {
    await this.store.clearGame();
  }
}

export { StaleSession };
