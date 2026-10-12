import type { GameEvent, GameState, GameView, Order, RoundChoices } from '@ratrace/engine';

/** What one answer or one round gives back: the game as it now stands, and what happened on the way. */
export interface StepResult {
  view: GameView;
  events: GameEvent[];
}

/**
 * A game being played. This and `PlayerStore` are the only two things a screen talks to:
 * today the game behind it runs in the browser, later it may run on a server, and no screen changes.
 */
export interface GameSession {
  readonly gameId: string;
  readonly lifeId: string;
  /** The game as the player may see it. The same object until the next answer or round. */
  view(): GameView;
  /** Net worth in start-of-game cents at the start and after every round played, for the graph. */
  history(): number[];
  /**
   * Answers the next card of the hand with the option given, and returns what that card did.
   * Cards are answered one at a time: the next one is judged as the player stands after this one.
   */
  answerCard(option: number): Promise<StepResult>;
  /** Plays the round. Cards still unanswered take their first option. */
  playRound(choices: RoundChoices): Promise<StepResult>;
}

/** Why a saved life could not be opened. */
export type Lost = 'outdated' | 'damaged';

export interface Sessions {
  /** Starts a new life. A life in progress is replaced. */
  start(lifeId: string): Promise<GameSession>;
  /** The life in progress. `lost` says why there is none when a save existed but could not be opened. */
  resume(): Promise<{ session: GameSession | null; lost: Lost | null }>;
  /** Drops the life in progress. */
  abandon(): Promise<void>;
}

/**
 * What the player did in one round. `picks` is the option taken on each card answered so far, in
 * the order of the hand; `orders` is null until the round is played.
 */
export interface RoundLog {
  picks: number[];
  orders: Order[] | null;
}

export const SAVE_FORMAT = 1;

/**
 * A game in progress, as it is stored. The seed and the log are enough to rebuild the state,
 * so a damaged state is not a lost game.
 */
export interface SavedGame {
  format: typeof SAVE_FORMAT;
  /** A UUID made on the device, so the record can be uploaded later without renumbering. */
  gameId: string;
  engineVersion: string;
  contentVersion: string;
  lifeId: string;
  seed: string;
  log: RoundLog[];
  history: number[];
  bankruptcies: number;
  state: GameState;
  updatedAt: number;
}

/** A finished life. */
export interface FinishedRun {
  format: typeof SAVE_FORMAT;
  runId: string;
  engineVersion: string;
  contentVersion: string;
  lifeId: string;
  seed: string;
  log: RoundLog[];
  finishedAt: number;
  score: number;
  /** Net worth at the end, in start-of-game cents. */
  netWorth: number;
  /** Status averaged over the life, which is what the score counted. */
  status: number;
  /** The round of the escape that still held at the end, or null. */
  escapedAtRound: number | null;
  bankruptcies: number;
  history: number[];
  /** Ran on this device, so it counts for personal bests only. */
  verified: false;
}

export interface Settings {
  /** Turns off roll-ups and particles, whatever the system setting says. */
  reducedMotion: boolean;
}

/** What belongs to the player rather than to one life. Unlocks, achievements and the collection join it in step 9. */
export interface Profile {
  format: typeof SAVE_FORMAT;
  settings: Settings;
}

export const newProfile = (): Profile => ({ format: SAVE_FORMAT, settings: { reducedMotion: false } });

/** Where everything the player has is kept. Today that is this device. */
export interface PlayerStore {
  /** The stored game exactly as it was written, unchecked, or null. */
  loadGame(): Promise<unknown>;
  saveGame(game: SavedGame): Promise<void>;
  clearGame(): Promise<void>;
  addRun(run: FinishedRun): Promise<void>;
  /** Finished lives, the latest first. */
  listRuns(): Promise<FinishedRun[]>;
  loadProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
}

export type { RoundChoices };
