import type { GameModule, LoggedRound } from './game/types.ts';

/** What a function answers: a status and a body, both decided here so they can be tested without a server. */
export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown, max: number): x is string => typeof x === 'string' && x.length >= 1 && x.length <= max;
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

/** No card of the game has anywhere near this many in a hand: a longer list is not a hand. */
const MAX_PICKS = 20;

const bad = (field: string): Reply => ({ status: 400, body: { error: 'bad-request', field } });

/** No room holds anywhere near this many players to do something to one life in a round. */
const MAX_ROOM_EVENTS = 16;
const isRoomEvent = (x: unknown): boolean => isRecord(x) && x.kind === 'teased' && isText(x.by, 64);

/**
 * Reads a log, or null if it is not one. Its length is bounded before anything is played. What the
 * others of a game with friends did to the life is kept only with `room`, for a log the server
 * wrote itself in a room: anywhere else it is left out, and nobody can write it into their own life.
 */
export function readLog(raw: unknown, game: GameModule, room = false): LoggedRound[] | null {
  if (!Array.isArray(raw) || raw.length > game.content.rounds) return null;
  const log: LoggedRound[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) return null;
    const { picks, orders } = entry;
    if (!Array.isArray(picks) || picks.length > MAX_PICKS || !picks.every(isCount)) return null;
    if (orders !== null && (!Array.isArray(orders) || orders.length > game.content.maxOrdersPerRound)) return null;
    if (room && entry.room !== undefined) {
      if (!Array.isArray(entry.room) || entry.room.length > MAX_ROOM_EVENTS || !entry.room.every(isRoomEvent)) return null;
      log.push({ picks, orders, room: entry.room as LoggedRound['room'] });
    } else log.push({ picks, orders });
  }
  return log;
}

/**
 * Plays a game again from the versions, the life, the seed and the log a client names, and says
 * where it stands. Nothing is trusted: a request that is not one, versions the server does not
 * hold, and a log that could not have been played each get their own answer, and none of them
 * makes the function fail.
 */
export function replayRequest(games: Readonly<Record<string, GameModule>>, raw: unknown): Reply {
  if (!isRecord(raw)) return bad('body');
  const { engineVersion, contentVersion, lifeId, seed } = raw;
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');
  if (!isText(lifeId, 40)) return bad('lifeId');
  if (!isText(seed, 80)) return bad('seed');

  const key = `${engineVersion}/${contentVersion}`;
  // A game finishes on the versions it started with. One this server no longer holds, or never did, cannot be judged here.
  if (!Object.hasOwn(games, key)) return { status: 409, body: { error: 'unknown-version', versions: Object.keys(games) } };
  const game = games[key];

  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) return { status: 400, body: { error: 'unknown-life' } };
  const log = readLog(raw.log, game);
  if (log === null) return bad('log');

  try {
    const state = game.replayLog(game.content, life.start, seed, log);
    return {
      status: 200,
      body: {
        engineVersion,
        contentVersion,
        lifeId,
        round: state.round,
        finished: state.finished,
        hash: game.stateHash(state),
        // A life has a score when it is over, and not before.
        score: state.finished ? game.finalScore(game.content, state) : null,
        netWorth: game.realNetWorth(state),
        status: game.livedStatus(state),
      },
    };
  } catch (error) {
    // The engine refuses what could not have happened: a card that was not in the hand, an order that is not one.
    // It also stops on a broken rule of its own, which is a bug to hear of: the log says which it was.
    console.error('replay refused:', error instanceof Error ? error.message : error);
    return { status: 422, body: { error: 'cannot-replay' } };
  }
}
