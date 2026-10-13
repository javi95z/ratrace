import type { RunRow } from './finish.ts';
import type { GameModule, LoggedRound, ReplayedStep } from './game/types.ts';
import { readLog } from './replay.ts';
import type { Reply } from './replay.ts';

/** A row of `games`, as far as a ranked life reads it. */
export interface RankedGameRow {
  id: string;
  user_id: string;
  mode: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  round: number;
  status: string;
  log: unknown;
  /** When the row was last written, exactly as the database says it: a step is written only if this still holds. */
  updated_at: string;
}

/** The kinds of call a ranked life counts. How many of each a player may make is in `rate.ts`. */
export type Counted = 'ranked-start' | 'ranked-step';

/** What a ranked life needs of the outside world. The function hands in the real thing; a test, its own. */
export interface RankedDeps {
  /** Counts this call for this player. False if it is one too many. */
  allow(userId: string, kind: Counted): Promise<boolean>;
  newId(): string;
  /** A seed nobody could find by trying: thirty-two random bytes, in hex. */
  newSeed(): string;
  now(): Date;
  /** The lives this player has unlocked, by id. */
  unlockedLives(userId: string): Promise<string[]>;
  /** Gives up whatever ranked life this player has in progress. */
  abandonRanked(userId: string): Promise<void>;
  /** Makes the game, in progress and with an empty log, and keeps its seed where no player can read it. */
  createGame(row: { id: string; user_id: string; life_id: string; engine_version: string; content_version: string }, seed: string): Promise<void>;
  loadGame(id: string): Promise<RankedGameRow | null>;
  loadSeed(id: string): Promise<string | null>;
  /** Writes the log and the round, if the row is still as it was read. False if someone wrote it first. */
  saveStep(id: string, asRead: string, log: LoggedRound[], round: number): Promise<boolean>;
  /** Writes the run unless one with its id is already there. */
  saveRun(run: RunRow): Promise<void>;
  closeGame(id: string, round: number, status: 'finished' | 'abandoned'): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown, max: number): x is string => typeof x === 'string' && x.length >= 1 && x.length <= max;
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

const bad = (field: string): Reply => ({ status: 400, body: { error: 'bad-request', field } });
const unknownGame: Reply = { status: 404, body: { error: 'unknown-game' } };
const closed: Reply = { status: 409, body: { error: 'closed' } };
const tooMany: Reply = { status: 429, body: { error: 'too-many' } };

/** How much of a life a log holds: every card answered and every round played. The game and the database count the same way. */
function stepsOf(log: readonly LoggedRound[]): number {
  let steps = 0;
  for (const entry of log) steps += entry.picks.length + (entry.orders === null ? 0 : 1);
  return steps;
}

/** A value as text with its keys in order, so that two that say the same read the same. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

/** What a player chose in one step: the option of a card, or the orders of a round. */
type Choice = { card: number } | { orders: unknown[] };

/** The log with one more step in it. The log it was given is not changed. */
function withStep(log: readonly LoggedRound[], choice: Choice): LoggedRound[] {
  const next = log.map((entry) => ({ picks: [...entry.picks], orders: entry.orders }));
  const open = next.length > 0 && next[next.length - 1].orders === null ? next[next.length - 1] : null;
  if ('card' in choice) {
    if (open) open.picks.push(choice.card);
    else next.push({ picks: [choice.card], orders: null });
  } else if (open) open.orders = choice.orders;
  else next.push({ picks: [], orders: choice.orders });
  return next;
}

/** True if the last step of the log is this very choice. */
function lastIs(log: readonly LoggedRound[], choice: Choice): boolean {
  const last = log[log.length - 1];
  if (!last) return false;
  if ('orders' in choice) return last.orders !== null && canonical(last.orders) === canonical(choice.orders);
  return last.orders === null && last.picks.length > 0 && last.picks[last.picks.length - 1] === choice.card;
}

/**
 * A ranked life: one the server plays. The client names what it chooses and nothing else; the
 * seed stays here, every card and every round is played here, and the client is told what it may
 * know of the game as it then stands. So the result can be set beside everyone else's.
 *
 * Nothing but the seed and the log is kept: the life is played again from them at every step,
 * with the engine of its own versions. `userId` is who the token says is asking, and a life that
 * is not theirs gets the answer a life that does not exist gets.
 */
export async function ranked(games: Readonly<Record<string, GameModule>>, deps: RankedDeps, userId: string, raw: unknown): Promise<Reply> {
  if (!isRecord(raw)) return bad('body');
  try {
    if (raw.action === 'start') return await start(games, deps, userId, raw);
    if (raw.action !== 'view' && raw.action !== 'card' && raw.action !== 'round' && raw.action !== 'abandon') return bad('action');
    const { gameId } = raw;
    if (typeof gameId !== 'string' || !UUID.test(gameId)) return bad('gameId');

    let choice: Choice | null = null;
    if (raw.action === 'card' || raw.action === 'round') {
      if (!isCount(raw.step)) return bad('step');
      if (raw.action === 'round' && !Array.isArray(raw.orders)) return bad('orders');
      // What is logged must play back to the same game: a whole number, or the first option, which is what the engine falls back to.
      choice = raw.action === 'card' ? { card: isCount(raw.option) ? raw.option : 0 } : { orders: raw.orders as unknown[] };
    }

    const row = await deps.loadGame(gameId);
    if (row === null || row.user_id !== userId || row.mode !== 'ranked') return unknownGame;
    if (raw.action === 'abandon') {
      if (row.status === 'playing') await deps.closeGame(row.id, row.round, 'abandoned');
      return { status: 200, body: {} };
    }
    if (row.status === 'abandoned') return closed;
    if (!(await deps.allow(userId, 'ranked-step'))) return tooMany;

    const game = games[`${row.engine_version}/${row.content_version}`];
    const life = game?.lives.find((one) => one.id === row.life_id);
    const seed = await deps.loadSeed(row.id);
    const log = game ? readLog(row.log, game) : null;
    // A ranked game the server made itself always has these. One that does not is broken, and that is the server's fault.
    if (!game || !game.viewOf || !life || log === null || seed === null) throw new Error(`ranked game ${row.id} cannot be opened`);
    const play = (played: readonly LoggedRound[]) => {
      let last: ReplayedStep | null = null;
      const whole = game.replayLife(game.content, life.start, seed, played, (step) => {
        last = step;
      });
      return { ...whole, last: last as ReplayedStep | null };
    };
    const runOf = (played: ReturnType<typeof play>): RunRow => ({
      id: row.id,
      user_id: userId,
      game_id: row.id,
      mode: 'ranked',
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
    });
    /** Writes the run of a life that is over and closes its game. Done again, it changes nothing. */
    const settle = async (played: ReturnType<typeof play>): Promise<RunRow> => {
      const run = runOf(played);
      await deps.saveRun(run);
      await deps.closeGame(row.id, played.state.round, 'finished');
      return run;
    };
    const recordOf = (played: ReturnType<typeof play>) => ({ history: played.history, bankruptcies: played.bankruptcies, journal: played.journal });

    const steps = stepsOf(log);
    if (choice === null) {
      const played = play(log);
      // The last round was played and the run never written: it is written now, by whoever looks first.
      const run = played.state.finished ? await settle(played) : null;
      return {
        status: 200,
        body: {
          gameId: row.id,
          lifeId: row.life_id,
          engineVersion: row.engine_version,
          contentVersion: row.content_version,
          status: played.state.finished ? 'finished' : 'playing',
          step: steps,
          view: game.viewOf(played.state),
          record: recordOf(played),
          ...(run ? { run } : {}),
        },
      };
    }

    /** What a step answers: what changed, and no more. The timeline the client holds is not sent again. */
    const answer = async (played: ReturnType<typeof play>, step: number, roundBefore: number): Promise<Reply> => {
      const view = (game.viewOf as NonNullable<GameModule['viewOf']>)(played.state);
      const { timeline, ...standing } = view;
      const run = played.state.finished ? await settle(played) : null;
      return {
        status: 200,
        body: {
          step,
          view: standing,
          // The world of the round that has just begun, if one has. Never one to come.
          world: view.round > roundBefore ? timeline[view.round] : null,
          events: played.last?.events ?? [],
          earned: played.last?.earned ?? [],
          record: recordOf(played),
          ...(run ? { run } : {}),
        },
      };
    };
    const roundsIn = (played: readonly LoggedRound[]) => played.filter((entry) => entry.orders !== null).length;

    // The step was taken before, with this very choice: the answer was lost on its way, and is given again.
    if (raw.step === steps - 1 && lastIs(log, choice)) {
      const before = roundsIn(log) - ('orders' in choice ? 1 : 0);
      return await answer(play(log), steps, before);
    }
    if (raw.step !== steps) return { status: 409, body: { error: 'out-of-step', step: steps } };
    if (row.status !== 'playing') return closed;
    if ('orders' in choice && choice.orders.length > game.content.maxOrdersPerRound) return bad('orders');

    const next = withStep(log, choice);
    let played;
    try {
      played = play(next);
    } catch (error) {
      // The engine refuses what cannot happen: a card when none is waiting, an order that is not one.
      console.error('ranked step refused:', error instanceof Error ? error.message : error);
      return { status: 422, body: { error: 'cannot-play' } };
    }
    // Two steps that arrive at once were both read from the same row. One is written; the other is told to look again.
    if (!(await deps.saveStep(row.id, row.updated_at, next, played.state.round))) return { status: 409, body: { error: 'out-of-step', step: steps } };
    return await answer(played, steps + 1, roundsIn(log));
  } catch (error) {
    console.error('ranked failed:', error instanceof Error ? error.message : error);
    return { status: 500, body: { error: 'server' } };
  }
}

async function start(games: Readonly<Record<string, GameModule>>, deps: RankedDeps, userId: string, raw: Record<string, unknown>): Promise<Reply> {
  const { lifeId, engineVersion, contentVersion } = raw;
  if (!isText(lifeId, 40)) return bad('lifeId');
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');

  const key = `${engineVersion}/${contentVersion}`;
  if (!Object.hasOwn(games, key)) return { status: 409, body: { error: 'unknown-version', versions: Object.keys(games) } };
  const game = games[key];
  // A version whose random streams could be found by trying can finish a casual life. It must never hold a ranked one.
  if (!game.viewOf || (game.SEED_BITS ?? 0) < 128) return { status: 409, body: { error: 'cannot-rank' } };
  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) return { status: 400, body: { error: 'unknown-life' } };
  // Which lives a player may choose is the game's rule, kept here as the device keeps it.
  if (life.unlock !== 'default' && !(await deps.unlockedLives(userId)).includes(life.id)) return { status: 403, body: { error: 'locked-life' } };
  if (!(await deps.allow(userId, 'ranked-start'))) return tooMany;

  await deps.abandonRanked(userId);
  const id = deps.newId();
  const seed = deps.newSeed();
  await deps.createGame({ id, user_id: userId, life_id: life.id, engine_version: engineVersion, content_version: contentVersion }, seed);
  const played = game.replayLife(game.content, life.start, seed, []);
  return {
    status: 200,
    body: { gameId: id, lifeId: life.id, step: 0, view: game.viewOf(played.state), record: { history: played.history, bankruptcies: played.bankruptcies, journal: played.journal } },
  };
}
