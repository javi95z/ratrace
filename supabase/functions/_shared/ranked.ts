import type { RunRow } from './finish.ts';
import type { GameModule, LoggedRound } from './game/types.ts';
import { isWeek, startOf } from './challenge.ts';
import { canonical, lifePlayer } from './played.ts';
import type { CardPick } from './played.ts';
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
  /** The week whose challenge this game is the attempt at, or null. */
  challenge: string | null;
}

export { canonical } from './played.ts';
export type { CardPick } from './played.ts';

/** The kinds of call a ranked life counts. How many of each a player may make is in `rate.ts`. */
export type Counted = 'ranked-start' | 'ranked-step';

/** What a ranked life needs of the outside world. The function hands in the real thing; a test, its own. */
export interface RankedDeps {
  /** The versions ranked lives are started on, as "engine/content": the rules the game plays now, not any the server still holds. */
  current: string;
  /** Counts this call for this player. False if it is one too many. */
  allow(userId: string, kind: Counted): Promise<boolean>;
  newId(): string;
  /** A seed nobody could find by trying: thirty-two random bytes, in hex. */
  newSeed(): string;
  now(): Date;
  /** The lives this player has unlocked, by id. */
  unlockedLives(userId: string): Promise<string[]>;
  /** The ranked life this player has in progress, if they have one. A player has one at most. */
  playingRanked(userId: string): Promise<RankedGameRow | null>;
  /** Makes the game, in progress and with an empty log, and keeps its seed where no player can read it. */
  createGame(row: { id: string; user_id: string; life_id: string; engine_version: string; content_version: string; challenge: string | null }, seed: string): Promise<void>;
  /** The seed of a week's challenge: the one already made for it, or a new one kept for it from now on. Every attempt of the week plays it. */
  challengeSeed(week: string, fresh: string): Promise<string>;
  /** True if the player has had their attempt of a week on a day ("2026-10-13", UTC), in progress, given up or finished. */
  challengeEntered(userId: string, week: string, day: string): Promise<boolean>;
  /** Enters the player's attempt of a week on a day. False if they have had that day's already. */
  enterChallenge(userId: string, week: string, day: string, gameId: string): Promise<boolean>;
  /** Keeps what an attempt chose on each card, for the sums told to those who have finished the week. */
  savePicks(runId: string, week: string, picks: readonly CardPick[]): Promise<void>;
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
export function stepsOf(log: readonly LoggedRound[]): number {
  let steps = 0;
  for (const entry of log) steps += entry.picks.length + (entry.orders === null ? 0 : 1);
  return steps;
}

/** What a player chose in one step: the option of a card, or the orders of a round. */
export type Choice = { card: number } | { orders: unknown[] };

/** The log with one more step in it. The log it was given is not changed. */
export function withStep(log: readonly LoggedRound[], choice: Choice): LoggedRound[] {
  // What the others did to the life in a round of a room stays with that round.
  const next = log.map((entry) => ({ picks: [...entry.picks], orders: entry.orders, ...(entry.room ? { room: entry.room } : {}) }));
  const open = next.length > 0 && next[next.length - 1].orders === null ? next[next.length - 1] : null;
  if ('card' in choice) {
    if (open) open.picks.push(choice.card);
    else next.push({ picks: [choice.card], orders: null });
  } else if (open) open.orders = choice.orders;
  else next.push({ picks: [], orders: choice.orders });
  return next;
}

/** True if the last step of the log is this very choice. */
export function lastIs(log: readonly LoggedRound[], choice: Choice): boolean {
  const last = log[log.length - 1];
  if (!last) return false;
  if ('orders' in choice) return last.orders !== null && canonical(last.orders) === canonical(choice.orders);
  return last.orders === null && last.picks.length > 0 && last.picks[last.picks.length - 1] === choice.card;
}

/**
 * A ranked game opened to be played: its log, how to play a log from its seed, and how to write the
 * run of a life that is over. Null if the server cannot open it: it no longer holds the game's
 * versions, or the game has no seed or no sound log.
 */
async function opened(games: Readonly<Record<string, GameModule>>, deps: RankedDeps, row: RankedGameRow, seedRead?: Promise<string | null>) {
  const game = games[`${row.engine_version}/${row.content_version}`];
  const start = game ? startOf(game, row.life_id, row.challenge ?? null) : null;
  const seed = await (seedRead ?? deps.loadSeed(row.id));
  const log = game ? readLog(row.log, game) : null;
  if (!game || !game.viewOf || start === null || log === null || seed === null) return null;
  const viewOf = game.viewOf;
  const { play, step } = lifePlayer(game, row.id, `${row.engine_version}/${row.content_version}`, start, seed);
  /** Writes the run of a life that is over and closes its game. Done again, it changes nothing. */
  const settle = async (played: ReturnType<typeof play>): Promise<RunRow> => {
    const run: RunRow = {
      id: row.id,
      user_id: row.user_id,
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
      challenge: row.challenge ?? null,
    };
    await deps.saveRun(run);
    // The choices are kept before the game is closed: a settle done again writes the same ones again.
    if (row.challenge) await deps.savePicks(row.id, row.challenge, played.picks);
    await deps.closeGame(row.id, played.state.round, 'finished');
    return run;
  };
  return { game, viewOf, log, play, step, settle };
}

/**
 * Finishes a game in progress whose last round was already played: the run that was never written
 * is written now. True if it was such a game. A life that is over is never given up, whatever
 * stopped the server between its last step and its run.
 */
async function settledIfOver(games: Readonly<Record<string, GameModule>>, deps: RankedDeps, row: RankedGameRow): Promise<boolean> {
  const life = await opened(games, deps, row);
  if (life === null) return false;
  const played = life.play(life.log);
  if (!played.state.finished) return false;
  await life.settle(played);
  return true;
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

    // Counted whatever it turns out to ask for, and looked up meanwhile: a step waits for one trip to the database, not three.
    // The seed is read with the rest and used only for a game that is the player's.
    const seedRead = deps.loadSeed(gameId);
    seedRead.catch(() => undefined);
    const [allowed, row] = await Promise.all([deps.allow(userId, 'ranked-step'), deps.loadGame(gameId)]);
    if (!allowed) return tooMany;
    if (row === null || row.user_id !== userId || row.mode !== 'ranked') return unknownGame;
    if (raw.action === 'abandon') {
      if (row.status === 'playing' && !(await settledIfOver(games, deps, row))) await deps.closeGame(row.id, row.round, 'abandoned');
      return { status: 200, body: {} };
    }
    if (row.status === 'abandoned') return closed;

    const life = await opened(games, deps, row, seedRead);
    // A ranked game the server made itself can always be opened. One that cannot is broken, and that is the server's fault.
    if (life === null) throw new Error(`ranked game ${row.id} cannot be opened`);
    const { game, viewOf, log, play, step, settle } = life;
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
          view: viewOf(played.state),
          record: recordOf(played),
          ...(run ? { run } : {}),
        },
      };
    }

    /** What a step answers: what changed, and no more. The timeline the client holds is not sent again. */
    const answer = async (played: ReturnType<typeof play>, step: number, roundBefore: number): Promise<Reply> => {
      const view = viewOf(played.state);
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
      played = step(log, next, choice);
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

/**
 * Starts a ranked life. A player has one in progress at most, and it is never ended unasked: with
 * one in the way the answer says which, and the new life begins only when the request names that
 * very one in `replace`.
 *
 * With `challenge`, the life is the attempt at this week's challenge: the life and the rule are the
 * week's, any life may be played whether unlocked or not, the seed is the week's own, and each
 * player has one attempt a day, counted the moment it begins. The ranking keeps each player's best.
 */
async function start(games: Readonly<Record<string, GameModule>>, deps: RankedDeps, userId: string, raw: Record<string, unknown>): Promise<Reply> {
  const { lifeId, engineVersion, contentVersion, replace, challenge } = raw;
  if (!isText(lifeId, 40)) return bad('lifeId');
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');
  if (replace !== undefined && replace !== null && (typeof replace !== 'string' || !UUID.test(replace))) return bad('replace');
  if (challenge !== undefined && challenge !== null && !isWeek(challenge)) return bad('challenge');
  const week = typeof challenge === 'string' ? challenge : null;
  // Counted before anything is looked up: a call costs the same whatever it turns out to ask for.
  if (!(await deps.allow(userId, 'ranked-start'))) return tooMany;

  const key = `${engineVersion}/${contentVersion}`;
  if (!Object.hasOwn(games, key)) return { status: 409, body: { error: 'unknown-version', versions: Object.keys(games) } };
  const game = games[key];
  // A version whose random streams could be found by trying can finish a casual life. It must never hold a ranked one.
  // Nor does a ranked life begin under rules the game no longer plays: the server holds them to finish lives, and every
  // score in a ranking is set beside the others.
  if (!game.viewOf || (game.SEED_BITS ?? 0) < 128 || key !== deps.current) return { status: 409, body: { error: 'cannot-rank' } };
  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) return { status: 400, body: { error: 'unknown-life' } };
  let begins: unknown = life.start;
  if (week !== null) {
    // Only this week's challenge can be played, and only as this week's life: the server's clock says which week it is.
    if (!game.challengeOf || week !== weekOfServer(deps.now())) return { status: 409, body: { error: 'challenge-closed' } };
    begins = startOf(game, life.id, week);
    if (begins === null) return { status: 400, body: { error: 'unknown-life' } };
    // Asked before anything is given up for it: a second attempt ends nothing.
    if (await deps.challengeEntered(userId, week, dayOfServer(deps.now()))) return { status: 409, body: { error: 'challenge-played' } };
  } else if (life.unlock !== 'default' && !(await deps.unlockedLives(userId)).includes(life.id)) {
    // Which lives a player may choose is the game's rule, kept here as the device keeps it.
    return { status: 403, body: { error: 'locked-life' } };
  }

  const playing = await deps.playingRanked(userId);
  if (playing !== null && !(await settledIfOver(games, deps, playing))) {
    if (replace !== playing.id) {
      return { status: 409, body: { error: 'in-progress', gameId: playing.id, lifeId: playing.life_id, round: playing.round, engineVersion: playing.engine_version, contentVersion: playing.content_version } };
    }
    await deps.closeGame(playing.id, playing.round, 'abandoned');
  }
  const id = deps.newId();
  const seed = week === null ? deps.newSeed() : await deps.challengeSeed(week, deps.newSeed());
  await deps.createGame({ id, user_id: userId, life_id: life.id, engine_version: engineVersion, content_version: contentVersion, challenge: week }, seed);
  // The attempt is the day's from the moment it begins. One that loses the race to an attempt already entered is given up at once.
  if (week !== null && !(await deps.enterChallenge(userId, week, dayOfServer(deps.now()), id))) {
    await deps.closeGame(id, 0, 'abandoned');
    return { status: 409, body: { error: 'challenge-played' } };
  }
  const played = game.replayLife(game.content, begins, seed, []);
  return {
    status: 200,
    body: { gameId: id, lifeId: life.id, step: 0, view: game.viewOf(played.state), record: { history: played.history, bankruptcies: played.bankruptcies, journal: played.journal } },
  };
}

/** The day a moment falls on, in UTC, as "2026-10-13": the day of an attempt, by the server's clock as by the database's. */
export function dayOfServer(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** The ISO week a moment falls in, in UTC, as "2026-W42": the server's own count, so that no client can choose its week. */
export function weekOfServer(at: Date): string {
  const day = Math.floor(at.getTime() / 86_400_000);
  const weekday = ((((day + 3) % 7) + 7) % 7) + 1;
  const thursday = new Date((day - weekday + 4) * 86_400_000);
  const year = thursday.getUTCFullYear();
  const number = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 / 7) + 1;
  return `${year}-W${String(number).padStart(2, '0')}`;
}
