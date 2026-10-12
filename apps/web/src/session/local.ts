import type { LifeDef } from '@ratrace/content';
import { CONTENT_VERSION } from '@ratrace/content';
import { applyCards, applyRound, createGame, ENGINE_VERSION, finalScore, realNetWorth, viewOf } from '@ratrace/engine';
import type { CardPicks, Content, GameView, RoundChoices } from '@ratrace/engine';
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

  constructor(
    private save: SavedGame,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly deps: SessionDeps,
  ) {
    this.current = viewOf(save.state);
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

  answerCards(picks: CardPicks): Promise<StepResult> {
    return this.step(async () => {
      const state = this.save.state;
      const result = applyCards(this.content, state, picks);
      const log = [...this.save.log];
      log[state.round] = { picks: structuredClone(picks), orders: null };
      return this.settle({ ...this.save, log, state: result.state }, result.events);
    });
  }

  playRound(choices: RoundChoices): Promise<StepResult> {
    return this.step(async () => {
      const state = this.save.state;
      const result = applyRound(this.content, state, choices);
      const log = [...this.save.log];
      log[state.round] = { picks: log[state.round]?.picks ?? null, orders: structuredClone(choices.orders) };
      let bankruptcies = this.save.bankruptcies;
      for (const event of result.events) if (event.kind === 'bankrupt') bankruptcies += 1;
      const history = [...this.save.history, realNetWorth(result.state)];
      return this.settle({ ...this.save, log, history, bankruptcies, state: result.state }, result.events);
    });
  }

  /** Writes the game as it stands. A failure is reported and otherwise ignored. */
  async persist(): Promise<void> {
    try {
      if (this.save.state.finished) {
        await this.store.addRun(this.asRun());
        await this.store.clearGame();
      } else {
        await this.store.saveGame(this.save);
      }
    } catch (error) {
      this.deps.onSaveError?.(error);
    }
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
      status: save.state.player.statusPoints,
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
    const session = new LocalSession(opened.save, this.store, this.content, this.deps);
    if (opened.repaired) await session.persist();
    return { session, lost: null };
  }

  async abandon(): Promise<void> {
    await this.store.clearGame();
  }
}
