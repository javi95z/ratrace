/**
 * The shape of one bundled version of the game, as far as the functions use it. The bundles are
 * plain JavaScript; this is what they are trusted to be. What is inside a state or the content is
 * the engine's business, so here they are opaque.
 */
export interface LoggedRound {
  picks: number[];
  orders: unknown[] | null;
  /** What the others of a game with friends did to the life in this round. Only ever written by the rooms function. */
  room?: RoomEvent[];
}

/** One thing another player of a room did to a life, written by the rooms function: who, by user id, and with what. */
export type RoomEvent =
  | { kind: 'teased'; by: string }
  | { kind: 'lent'; id: string; to: string; amount: number; rateBp: number; rounds: number }
  | { kind: 'borrowed'; id: string; from: string; amount: number; rateBp: number; rounds: number }
  | { kind: 'defaulted'; id: string };

export interface GameState {
  round: number;
  finished: boolean;
  /** Whether the round is waiting for its cards to be answered, or for its orders. */
  phase: 'cards' | 'finance';
  /** What a room may tell the others of a player once a round has turned: where they live, and their job. */
  player: {
    escapedAtRound: number | null;
    cityId?: string;
    life?: { career?: { id: string; level: number } | null };
    /** What a loan between players of a room needs: the cash to pay it out, the debts owed, and what was lent to others. */
    cash: number;
    debts: Array<{ id: string }>;
    lent?: Array<{ id: string; peer: string }>;
  };
}

/** A life played again, with the record of it: what the badges and the graph of a finished life are made from. */
export interface Replayed {
  state: GameState;
  /** Net worth in start-of-game cents at the start and after every round. */
  history: number[];
  bankruptcies: number;
  journal: { cities: string[]; earned: string[] } & Record<string, unknown>;
}

/** One step of a life being played again. */
export interface ReplayedStep {
  events: unknown[];
  /** The badges that step earned in this life. */
  earned: string[];
}

export interface GameModule {
  ENGINE_VERSION: string;
  CONTENT_VERSION: string;
  /**
   * How many bits of a seed reach each random stream. Missing from the versions whose streams
   * could be found by trying, which can finish a casual life but must never hold a ranked one.
   */
  SEED_BITS?: number;
  content: { rounds: number; maxOrdersPerRound: number };
  /** `unlock` is `default` for a life open from the start. Missing from the older versions. */
  lives: ReadonlyArray<{ id: string; start: unknown; unlock?: unknown }>;
  /** What a client may hold of a game: no seed, no saved random stream, no world to come. Missing from the older versions. */
  viewOf?(state: unknown): { round: number; timeline: unknown[] } & Record<string, unknown>;
  /** Plays a game again from its seed and its log. Throws on a log that cannot have been played. */
  replayLog(content: unknown, start: unknown, seed: string, log: readonly LoggedRound[]): GameState;
  /** The same, keeping the record of the life alongside. The newer versions tell of every step as it is played. */
  replayLife(content: unknown, start: unknown, seed: string, log: readonly LoggedRound[], onStep?: (step: ReplayedStep) => void): Replayed;
  /** Takes one more step of a life already played, giving what playing its whole log again would. Missing from the versions before 0.36 / 1.38. */
  stepLife?(content: unknown, from: Replayed, step: { card: number } | { orders: unknown[]; room?: RoomEvent[] }, onStep?: (step: ReplayedStep) => void): Replayed;
  /** How a life begins in a room: marked as played among others, so it may tease them. Missing from the versions before 0.38 / 1.39. */
  roomStart?(start: unknown): unknown;
  stateHash(state: unknown): string;
  finalScore(content: unknown, state: unknown): number;
  realNetWorth(state: unknown): number;
  livedStatus(state: unknown): number;
  /** The challenge of a week, or null for something that is not a week. Missing from the versions before the weekly challenges. */
  challengeOf?(week: string, lives: GameModule['lives']): { week: string; lifeId: string; rule: string } | null;
  /** How a week's challenge begins: its life under the week's rule. */
  challengeStart?(challenge: { week: string; lifeId: string; rule: string }, life: GameModule['lives'][number]): unknown;
}
