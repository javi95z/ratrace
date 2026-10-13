/**
 * The shape of one bundled version of the game, as far as the functions use it. The bundles are
 * plain JavaScript; this is what they are trusted to be. What is inside a state or the content is
 * the engine's business, so here they are opaque.
 */
export interface LoggedRound {
  picks: number[];
  orders: unknown[] | null;
}

export interface GameState {
  round: number;
  finished: boolean;
}

export interface GameModule {
  ENGINE_VERSION: string;
  CONTENT_VERSION: string;
  content: { rounds: number; maxOrdersPerRound: number };
  lives: ReadonlyArray<{ id: string; start: unknown }>;
  /** Plays a game again from its seed and its log. Throws on a log that cannot have been played. */
  replayLog(content: unknown, start: unknown, seed: string, log: readonly LoggedRound[]): GameState;
  stateHash(state: unknown): string;
  finalScore(content: unknown, state: unknown): number;
  realNetWorth(state: unknown): number;
  livedStatus(state: unknown): number;
}
