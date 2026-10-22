import type { RankedLifeInTheWay } from './errors';
import type { Journal, Milestone } from '@ratrace/content';
import type { GameEvent, GameState, GameView, Order, RoundChoices } from '@ratrace/engine';

/** What one answer or one round gives back: the game as it now stands, and what happened on the way. */
export interface StepResult {
  view: GameView;
  events: GameEvent[];
  /** Badges this step earned for the first time ever, for the screen to celebrate. */
  earned: string[];
  /** Lives this step unlocked. */
  unlocked: string[];
}

/**
 * A game being played. This and `PlayerStore` are the only two things a screen talks to:
 * today the game behind it runs in the browser, later it may run on a server, and no screen changes.
 */
export interface GameSession {
  readonly gameId: string;
  readonly lifeId: string;
  /** True for a life the server plays, step by step: its result can be set beside everyone else's. Left out, the device plays it. */
  readonly ranked?: boolean;
  /** True for a life a server plays, a ranked one or one in a room: each answer takes a trip there. Left out, the device plays it at once. */
  readonly served?: boolean;
  /** The week whose challenge this life is: the ranked attempt, or a practice. Left out for any other life. */
  readonly challenge?: string;
  /**
   * The engine version of the rules the life is played under, when they are not this page's own: a life
   * begun under older rules is finished under them, and is offered nothing they do not know.
   */
  readonly rules?: string;
  /** The game as the player may see it. The same object until the next answer or round. */
  view(): GameView;
  /** Net worth in start-of-game cents at the start and after every round played, for the graph. */
  history(): number[];
  /** How many times this life has gone bankrupt. */
  bankruptcies(): number;
  /** The badges earned in this life so far, in the order they came. */
  badges(): string[];
  /** What has happened in this life that is worth telling, in the order it came. */
  story(): Milestone[];
  /**
   * Answers the next card of the hand with the option given, and returns what that card did.
   * Cards are answered one at a time: the next one is judged as the player stands after this one.
   */
  answerCard(option: number): Promise<StepResult>;
  /** Plays the round. Cards still unanswered take their first option. */
  playRound(choices: RoundChoices): Promise<StepResult>;
  /**
   * For a life whose rounds may be played without this page asking, in a room: the result of the
   * round played since the page last saw the life, or null if none was. Left out, there never is one.
   */
  catchUp?(): Promise<StepResult | null>;
}

/**
 * Why a saved life could not be opened: it was played under older rules; it cannot be read or
 * rebuilt; or it was written by a newer version of the game than this page, which must leave it be.
 */
/** `waiting`: a life begun under older rules, kept, whose rules cannot be loaded just now (no connection). */
export type Lost = 'outdated' | 'damaged' | 'newer' | 'waiting';

export interface Sessions {
  /**
   * Starts a new life. A life in progress on this device is replaced. `ranked` asks for a life the
   * server plays; when that cannot be had, with no account or no connection, the life is a casual
   * one, and `GameSession.ranked` says which it turned out to be. A player has one ranked life in
   * progress: with another in the way, on another device, this throws `RankedInProgress` and
   * changes nothing, unless `replace` names that life, which is then given up.
   */
  start(lifeId: string, options?: { ranked?: boolean; replace?: string; challenge?: string }): Promise<GameSession>;
  /** Takes up a ranked life in progress elsewhere, where there are ranked lives at all. See `GameSessions.takeUp`. */
  takeUp?(life: RankedLifeInTheWay): Promise<GameSession | null>;
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
  /** The week whose challenge this life practises, under its rule. Left out for any other life. */
  challenge?: string;
  seed: string;
  log: RoundLog[];
  history: number[];
  bankruptcies: number;
  /** What the life has shown so far that the badges need. Rebuilt with the rest when the log is replayed. */
  journal: Journal;
  state: GameState;
  updatedAt: number;
}

/**
 * A ranked life in progress, as the device remembers it: which game it is, and what the server
 * last showed of it. The game itself is on the server. There is no seed here and no world to
 * come: the device could not play it if it tried.
 */
export interface RankedGame {
  format: typeof SAVE_FORMAT;
  ranked: true;
  gameId: string;
  engineVersion: string;
  contentVersion: string;
  lifeId: string;
  /** The week whose challenge this life is the attempt at. Left out for any other ranked life. */
  challenge?: string;
  /** How many steps the server has taken, as far as this device knows. The next one is numbered with it. */
  step: number;
  /** The game as the server last showed it. Null for a life the account brought, which this device has not opened yet. */
  view: GameView | null;
  history: number[];
  bankruptcies: number;
  journal: Journal | null;
  updatedAt: number;
}

/** What the device keeps as the life in progress: a game it plays itself, or the note of one the server plays. */
export type StoredGame = SavedGame | RankedGame;

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
  /** The badges earned in this life, in the order they came. */
  badges: string[];
  /** Every city lived in, the first one first. */
  cities: string[];
  /** Ran on this device, so it counts for personal bests only. */
  verified: false;
  /** True for a life the server played: the one kind that is in the rankings. */
  ranked?: true;
  /** True for a life lived in a room with friends: the server played it too, and it is in no ranking. */
  room?: true;
  /** The week whose challenge this life was: the attempt, if ranked, or a practice. */
  challenge?: string;
}

export interface Settings {
  /** Turns off roll-ups and particles, whatever the system setting says. */
  reducedMotion: boolean;
  /** False for a silent game. */
  sound: boolean;
}

/** When something was earned for the first time, and in which life. */
export interface Earned {
  at: number;
  gameId: string;
}

/** What belongs to the player rather than to one life. */
export interface Profile {
  format: typeof SAVE_FORMAT;
  settings: Settings;
  /** Every badge ever earned, by id. */
  badges: Record<string, Earned>;
  /** Every status item ever owned, across lives, in the order first owned. */
  gallery: string[];
  /** Lives unlocked by play, by id. Lives open from the start are not listed. */
  unlocked: Record<string, Earned>;
  /** The guided first life: the tips already shown, and whether the player turned the guide off. */
  guide: { seen: string[]; off: boolean };
  /**
   * The rat rank: points for every life finished, by the id of the life, so a life counts once. The
   * total is their sum. It is a title and nothing more: no score, ranking or rule reads it. A
   * profile from before ranks has none; it is filled from the finished lives on the device.
   */
  rank: { points: number; lives: Record<string, number> };
}

export const newProfile = (): Profile => ({
  format: SAVE_FORMAT,
  settings: { reducedMotion: false, sound: true },
  badges: {},
  gallery: [],
  unlocked: {},
  guide: { seen: [], off: false },
  rank: { points: 0, lives: {} },
});

/** Where everything the player has is kept. Today that is this device. */
export interface PlayerStore {
  /** The stored game exactly as it was written, unchecked, or null. */
  loadGame(): Promise<unknown>;
  saveGame(game: StoredGame): Promise<void>;
  clearGame(): Promise<void>;
  addRun(run: FinishedRun): Promise<void>;
  /** Takes a finished life out. One that is not there is not an error. */
  removeRun(runId: string): Promise<void>;
  /** Finished lives, the latest first. */
  listRuns(): Promise<FinishedRun[]>;
  /**
   * The ids of the lives `listRuns` gives, in no order, for a store that can tell them without reading every life (the phone's, which keeps an index
   * of them): a step that only needs to know how many lives were finished asks this and leaves the lives unread. A store without it is asked for the
   * lives.
   */
  runIds?(): Promise<string[]>;
  loadProfile(): Promise<Profile>;
  saveProfile(profile: Profile): Promise<void>;
}

export type { RoundChoices };
