import { startOf } from './challenge.ts';
import type { GameModule } from './game/types.ts';
import { readLog } from './replay.ts';
import type { Reply } from './replay.ts';

/** A row of `games`, as far as finishing a life reads it. */
export interface GameRow {
  id: string;
  user_id: string;
  mode: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  seed: string | null;
  round: number;
  status: string;
  log: unknown;
  /** The week whose challenge this life is: a ranked attempt, or a practice. Null for any other life. */
  challenge: string | null;
}

/** A row of `runs`, as the server writes it. */
export interface RunRow {
  id: string;
  user_id: string;
  game_id: string;
  /** `casual`: a life the device played and the server played again. `ranked`: one the server played itself. */
  mode: 'casual' | 'ranked';
  life_id: string;
  engine_version: string;
  content_version: string;
  score: number;
  net_worth: number;
  status: number;
  escaped_at_round: number | null;
  bankruptcies: number;
  badges: string[];
  cities: string[];
  history: number[];
  verified: true;
  finished_at: string;
  /** The week whose challenge this life was, or null. */
  challenge: string | null;
}

/** What finishing a life needs of the database. The function hands in the real thing; a test, its own. */
export interface FinishDeps {
  loadGame(id: string): Promise<GameRow | null>;
  loadRun(id: string): Promise<RunRow | null>;
  /** Writes the run unless one with its id is already there. */
  saveRun(run: RunRow): Promise<void>;
  /** Marks the game as finished at this round, which closes it to its owner. */
  closeGame(id: string, round: number): Promise<void>;
  now(): Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cannotReplay: Reply = { status: 422, body: { error: 'cannot-replay' } };

/**
 * Finishes a casual life: plays the game the player has saved again, from its seed and its log,
 * and writes the run. The client names the game and nothing else; every figure of the run is the
 * engine's. The run takes the game's id, so asking twice writes once and answers the same.
 *
 * `userId` is who the token says is asking. A game that is not theirs gets the answer a game
 * that does not exist gets.
 */
export async function finishRun(games: Readonly<Record<string, GameModule>>, deps: FinishDeps, userId: string, raw: unknown): Promise<Reply> {
  const gameId = typeof raw === 'object' && raw !== null ? (raw as { gameId?: unknown }).gameId : undefined;
  if (typeof gameId !== 'string' || !UUID.test(gameId)) return { status: 400, body: { error: 'bad-request', field: 'gameId' } };

  try {
    const done = await deps.loadRun(gameId);
    const row = await deps.loadGame(gameId);
    if (done !== null && done.user_id === userId) {
      // The run was written before. If its game was left open then, by a failure between the two
      // writes, it is closed now: an open game is a life offered to the player's other devices.
      if (row !== null && row.user_id === userId && row.status !== 'finished') await deps.closeGame(row.id, row.round);
      return { status: 200, body: { run: done } };
    }
    if (row === null || row.user_id !== userId) return { status: 404, body: { error: 'unknown-game' } };
    // A ranked life is played by the server round by round; it is never finished from a log a device kept.
    if (row.mode !== 'casual') return { status: 409, body: { error: 'not-casual' } };

    const key = `${row.engine_version}/${row.content_version}`;
    if (!Object.hasOwn(games, key)) return { status: 409, body: { error: 'unknown-version', versions: Object.keys(games) } };
    const game = games[key];
    const start = startOf(game, row.life_id, row.challenge ?? null);
    const log = readLog(row.log, game);
    if (start === null || log === null || typeof row.seed !== 'string' || row.seed.length === 0) return cannotReplay;

    let played;
    try {
      played = game.replayLife(game.content, start, row.seed, log);
    } catch (error) {
      console.error('finish refused:', error instanceof Error ? error.message : error);
      return cannotReplay;
    }
    if (!played.state.finished) return { status: 409, body: { error: 'not-finished' } };

    const run: RunRow = {
      id: row.id,
      user_id: userId,
      game_id: row.id,
      mode: 'casual',
      life_id: row.life_id,
      engine_version: row.engine_version,
      content_version: row.content_version,
      score: game.finalScore(game.content, played.state),
      net_worth: game.realNetWorth(played.state),
      status: game.livedStatus(played.state),
      escaped_at_round: played.state.player.escapedAtRound,
      bankruptcies: played.bankruptcies,
      badges: played.journal.earned,
      cities: played.journal.cities,
      history: played.history,
      verified: true,
      finished_at: deps.now().toISOString(),
      challenge: row.challenge ?? null,
    };
    await deps.saveRun(run);
    await deps.closeGame(row.id, played.state.round);
    return { status: 200, body: { run } };
  } catch (error) {
    console.error('finish failed:', error instanceof Error ? error.message : error);
    return { status: 500, body: { error: 'server' } };
  }
}
