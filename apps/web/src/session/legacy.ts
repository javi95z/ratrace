import type { LifeDef, Milestone } from '@ratrace/content';
import type { Content, GameView, RoundChoices } from '@ratrace/engine';
import { StaleSession } from './errors';
import { tellProfile } from './profile';
import { SAVE_FORMAT } from './types';
import type { FinishedRun, GameSession, PlayerStore, SavedGame, StepResult } from './types';
import { upToDateView } from './upgrade';

/**
 * The rules of an older version of the game, as the server holds them to finish lives begun under
 * them: one bundle of the engine and the content of that version. What a page needs of them to play
 * a life to its end. The newer ones can also take one step at a time; the older replay the log.
 */
export interface OlderRules {
  content: unknown;
  lives: ReadonlyArray<{ id: string; start: unknown }>;
  replayLife(content: unknown, start: unknown, seed: string, log: SavedGame['log'], onStep?: (step: { events: unknown[]; earned: string[] }) => void): OlderLife;
  stepLife?(content: unknown, from: OlderLife, step: { card: number } | { orders: unknown[] }, onStep?: (step: { events: unknown[]; earned: string[] }) => void): OlderLife;
  viewOf(state: unknown): unknown;
  finalScore(content: unknown, state: unknown): number;
  realNetWorth(state: unknown): number;
  livedStatus(state: unknown): number;
  challengeOf?(week: string, lives: OlderRules['lives']): unknown;
  challengeStart?(challenge: unknown, life: OlderRules['lives'][number]): unknown;
}

/** A life as older rules play it: the game, and its record. */
interface OlderLife {
  state: SavedGame['state'];
  history: number[];
  bankruptcies: number;
  journal: SavedGame['journal'];
}

/**
 * Finds the rules of a version: the bundle, `gone` when no version of the game holds them any more,
 * or `unreachable` when they cannot be had just now (no connection), to be asked for again later.
 */
export type LoadRules = (versions: { engine: string; content: string }) => Promise<OlderRules | 'gone' | 'unreachable'>;

/**
 * The rules of older versions as the web serves them, next to the page: loaded only for a life
 * begun under them. The import is the browser's own, so the page's bundler leaves the file alone.
 * A life is never let go for rules the site does not have just now: a site put out a moment before
 * its rules, or a cache, is no reason to lose it. It waits, kept, and is asked for again later.
 */
export const loadRulesFromSite: LoadRules = async ({ engine, content }) => {
  const url = `/rules/v${engine}-${content}.js`;
  try {
    const load = new Function('url', 'return import(url)') as (url: string) => Promise<OlderRules>;
    return await load(url);
  } catch {
    return 'unreachable';
  }
};

/** How a life begins under older rules: its life, under a week's rule when it was a practice of a challenge. Null if those rules do not have it. */
export function olderStart(rules: OlderRules, lifeId: string, challenge?: string): unknown {
  const life = rules.lives.find((one) => one.id === lifeId);
  if (!life) return null;
  if (challenge === undefined) return life.start;
  const week = rules.challengeOf?.(challenge, rules.lives);
  return week && rules.challengeStart ? rules.challengeStart(week, life) : null;
}

/**
 * A life this device began under rules that have changed since, played to its end under them: the
 * same seed and log give the same game they always did, by the engine of its version. The screens
 * show it with the page's own, as they show a game a server plays.
 */
export class OlderSession implements GameSession {
  readonly ranked = false;
  private current: GameView;
  private tail: Promise<unknown> = Promise.resolve();
  private stored: number | null;
  private ofGallery: string[] = [];

  constructor(
    private save: SavedGame,
    private readonly rules: OlderRules,
    private readonly start: unknown,
    private readonly store: PlayerStore,
    private readonly content: Content,
    private readonly lives: ReadonlyArray<LifeDef>,
    private readonly now: () => number,
    private readonly onSaveError: ((error: unknown) => void) | undefined,
    stored: boolean,
  ) {
    this.current = this.shown();
    this.stored = stored ? save.updatedAt : null;
  }

  /**
   * Opens a saved life under the rules it was begun with, played again from its seed and log: what
   * the save says of the game is not taken on trust. Null if those rules cannot play it.
   */
  static open(raw: SavedGame, rules: OlderRules, deps: { store: PlayerStore; content: Content; lives: ReadonlyArray<LifeDef>; now: () => number; onSaveError?: (error: unknown) => void }): OlderSession | null {
    const start = olderStart(rules, raw.lifeId, raw.challenge);
    if (start === null) return null;
    try {
      const life = rules.replayLife(rules.content, start, raw.seed, raw.log);
      return new OlderSession({ ...raw, ...life }, rules, start, deps.store, deps.content, deps.lives, deps.now, deps.onSaveError, true);
    } catch {
      return null;
    }
  }

  get gameId(): string {
    return this.save.gameId;
  }

  get lifeId(): string {
    return this.save.lifeId;
  }

  get challenge(): string | undefined {
    return this.save.challenge;
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

  story(): Milestone[] {
    return this.save.journal.story.milestones;
  }

  answerCard(option: number): Promise<StepResult> {
    const asked = Number.isSafeInteger(option) && option >= 0 ? option : 0;
    return this.step({ card: asked }, (log, round) => {
      log[round] = { picks: [...(log[round]?.picks ?? []), asked], orders: null };
    });
  }

  playRound(choices: RoundChoices): Promise<StepResult> {
    return this.step({ orders: structuredClone(choices.orders) }, (log, round) => {
      log[round] = { picks: log[round]?.picks ?? [], orders: structuredClone(choices.orders) };
    });
  }

  /** Writes the life as it stands, and its run once it is over. A failure is reported and otherwise ignored. */
  async persist(): Promise<void> {
    try {
      if (this.save.state.finished) await this.store.addRun(this.asRun());
      await this.store.saveGame(this.save);
      this.stored = this.save.updatedAt;
    } catch (error) {
      this.onSaveError?.(error);
    }
  }

  async tellProfile(): Promise<{ earned: string[]; unlocked: string[] }> {
    const { save } = this;
    try {
      const told = await tellProfile(this.store, this.content, this.lives, { gameId: save.gameId, at: save.updatedAt, earned: save.journal.earned, collection: save.state.player.life.collection, over: save.state.finished });
      this.ofGallery = told.ofGallery;
      return { earned: told.earned, unlocked: told.unlocked };
    } catch (error) {
      this.onSaveError?.(error);
      return { earned: [], unlocked: [] };
    }
  }

  private shown(): GameView {
    return upToDateView(this.rules.viewOf(this.save.state)) as GameView;
  }

  /** One step under the older rules: from where the life stands when they can take a single one, by playing the log again when not. */
  private step(choice: { card: number } | { orders: unknown[] }, write: (log: SavedGame['log'], round: number) => void): Promise<StepResult> {
    const run = async (): Promise<StepResult> => {
      await this.mustBeCurrent();
      const log = [...this.save.log];
      write(log, this.save.state.round);
      let last: { events: unknown[]; earned: string[] } | null = null;
      const heard = (step: { events: unknown[]; earned: string[] }) => {
        last = step;
      };
      const { state, history, bankruptcies, journal } = this.save;
      const life = this.rules.stepLife
        ? this.rules.stepLife(this.rules.content, { state, history, bankruptcies, journal }, choice, heard)
        : this.rules.replayLife(this.rules.content, this.start, this.save.seed, log, heard);
      this.save = { ...this.save, log, state: life.state, history: life.history, bankruptcies: life.bankruptcies, journal: life.journal, updatedAt: this.now() };
      this.current = this.shown();
      await this.persist();
      const had = this.ofGallery.length;
      const news = await this.tellProfile();
      if (this.save.state.finished && this.ofGallery.length !== had) await this.persist();
      return { view: this.current, events: ((last as { events: unknown[] } | null)?.events ?? []) as StepResult['events'], earned: news.earned, unlocked: news.unlocked };
    };
    const result = this.tail.then(run, run);
    this.tail = result.catch(() => undefined);
    return result;
  }

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

  private asRun(): FinishedRun {
    const { save, rules } = this;
    return {
      format: SAVE_FORMAT,
      runId: save.gameId,
      engineVersion: save.engineVersion,
      contentVersion: save.contentVersion,
      lifeId: save.lifeId,
      ...(save.challenge !== undefined ? { challenge: save.challenge } : {}),
      seed: save.seed,
      log: save.log,
      finishedAt: save.updatedAt,
      score: rules.finalScore(rules.content, save.state),
      netWorth: rules.realNetWorth(save.state),
      status: rules.livedStatus(save.state),
      escapedAtRound: save.state.player.escapedAtRound,
      bankruptcies: save.bankruptcies,
      history: save.history,
      badges: this.badges(),
      cities: save.journal.cities,
      verified: false,
    };
  }
}
