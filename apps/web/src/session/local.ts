import type { LifeDef } from '@ratrace/content';
import { CONTENT_VERSION } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, livedStatus, realNetWorth, viewOf } from '@ratrace/engine';
import type { Content, GameView, RoundChoices } from '@ratrace/engine';
import { StaleSession } from './errors';
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
 */
class LocalSession implements GameSession {
  private current: GameView;
  /** Steps run one after another, in the order they were asked for. */
  private tail: Promise<unknown> = Promise.resolve();
  /** The `updatedAt` of the record the store last took from this session or gave to it. Null until there is one. */
  private stored: number | null;

  /** `stored` says whether `save` is already in the store, as it is for a life that was just loaded. */
  constructor(
    private save: SavedGame,
    private readonly store: PlayerStore,
    private readonly content: Content,
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

  answerCard(option: number): Promise<StepResult> {
    return this.step(async () => {
      await this.mustBeCurrent();
      const state = this.save.state;
      // What is logged must replay to the same game: a whole number, or the first option the engine falls back to.
      const asked = Number.isSafeInteger(option) && option >= 0 ? option : 0;
      const result = applyCard(this.content, state, asked);
      const log = [...this.save.log];
      log[state.round] = { picks: [...(log[state.round]?.picks ?? []), asked], orders: null };
      return this.settle({ ...this.save, log, state: result.state }, result.events);
    });
  }

  playRound(choices: RoundChoices): Promise<StepResult> {
    return this.step(async () => {
      await this.mustBeCurrent();
      const state = this.save.state;
      const result = applyRound(this.content, state, choices);
      const log = [...this.save.log];
      log[state.round] = { picks: log[state.round]?.picks ?? [], orders: structuredClone(choices.orders) };
      let bankruptcies = this.save.bankruptcies;
      for (const event of result.events) if (event.kind === 'bankrupt') bankruptcies += 1;
      const history = [...this.save.history, realNetWorth(result.state)];
      return this.settle({ ...this.save, log, history, bankruptcies, state: result.state }, result.events);
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

  private async settle(next: SavedGame, events: StepResult['events']): Promise<StepResult> {
    this.save = { ...next, updatedAt: this.deps.now() };
    this.current = viewOf(this.save.state);
    await this.persist();
    return { view: this.current, events };
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
        history: [realNetWorth(state)],
        bankruptcies: 0,
        state,
        updatedAt: this.deps.now(),
      },
      this.store,
      this.content,
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
      await this.store.clearGame();
      return { session: null, lost: opened.lost };
    }
    // A repaired save keeps its `updatedAt`, so the stored record is still the one this session answers for.
    const session = new LocalSession(opened.save, this.store, this.content, this.deps, true);
    if (opened.repaired) await session.persist();
    return { session, lost: null };
  }

  async abandon(): Promise<void> {
    await this.store.clearGame();
  }
}

export { StaleSession };
