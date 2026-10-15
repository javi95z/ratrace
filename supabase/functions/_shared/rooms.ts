import type { RunRow } from './finish.ts';
import type { GameModule, LoggedRound, ReplayedStep } from './game/types.ts';
import { lastIs, stepsOf, withStep } from './ranked.ts';
import type { Choice } from './ranked.ts';
import { readLog } from './replay.ts';
import type { Reply } from './replay.ts';

/** How long a round may take, in seconds: the host chooses one of these. */
export const ROUND_SECONDS = [90, 180, 300] as const;
/** How long after its deadline a round still waits, for the orders a page sent a moment before it. */
export const GRACE_MS = 5_000;
/** More players than this do not fit in a room. The database holds it to the same. */
export const MAX_MEMBERS = 6;
/** No hand has anywhere near this many cards: answering more is a bug, not a hand. */
const MAX_HAND = 20;
/** How many times a turn is read and written again when something moved under it, before the call gives up. */
const TURN_TRIES = 4;
/** The most a round's orders may weigh, as JSON. Fifty orders of the heaviest kind are a few kilobytes. */
export const MAX_ORDERS_CHARS = 16_000;
/** The most a member's log may weigh once a round is added to it, as JSON: under what its game can hold, whatever was sent. */
export const MAX_LOG_CHARS = 120_000;

/** A row of `rooms`. */
export interface RoomRow {
  id: string;
  code: string;
  /** Null once the host's account is gone: the room plays on, and a lobby with no host cannot be started. */
  host: string | null;
  life_id: string;
  engine_version: string;
  content_version: string;
  seconds: number;
  status: 'open' | 'playing' | 'finished' | 'closed';
  round: number;
  deadline: string | null;
  created_at: string;
}

/** How a member stood when the last round turned. */
export interface Standing {
  /** What the life would score if it ended now; at the end, its score. */
  score: number;
  /** Net worth in start-of-game cents. */
  netWorth: number;
  /** Status averaged over the rounds played, as the score counts it. */
  status: number;
  escaped: boolean;
  bankruptcies: number;
}

/** A row of `room_players`, without its room. */
export interface MemberRow {
  user_id: string;
  game_id: string | null;
  ready_round: number | null;
  left_at: string | null;
  standing: Standing | null;
  joined_at: string;
}

/** A member's game, as far as a room reads it. */
export interface RoomGameRow {
  id: string;
  user_id: string;
  mode: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  room: string | null;
  round: number;
  status: string;
  log: unknown;
  /** When the row was last written, exactly as the database says it: a step is written only if this still holds. */
  updated_at: string;
}

/** One member's life as a turn writes it. */
export interface TurnLife {
  user: string;
  game: string;
  as_read: string;
  log: LoggedRound[];
  round: number;
  finished: boolean;
  /** True if the turn played orders the member kept for the round: they must still be ready, or still not, when it is written. */
  ready: boolean;
  standing: Standing;
}

/** The kinds of call a room counts. How many of each a player may make is in `rate.ts`. */
export type RoomCounted = 'room-make' | 'room-step';

/**
 * What rooms need of the database. Each of the writes is one function of the database that holds
 * the room's row while it works (see the migration of rooms), and answers in the words below.
 */
export interface RoomsDeps {
  /** The versions rooms are opened on, as "engine/content": the rules the game plays now. */
  current: string;
  /** Counts this call for this player. False if it is one too many. */
  allow(userId: string, kind: RoomCounted): Promise<boolean>;
  newId(): string;
  /** A seed nobody could find by trying: thirty-two random bytes, in hex. */
  newSeed(): string;
  now(): Date;
  /** The lives this player has unlocked, by id. */
  unlockedLives(userId: string): Promise<string[]>;
  /** The latest room the player has not left that is not closed: in its lobby, in play, or over. */
  myRoom(userId: string): Promise<string | null>;
  loadRoom(id: string): Promise<RoomRow | null>;
  /** Everyone who has been in the room, in the order they joined, those who left too. */
  members(roomId: string): Promise<MemberRow[]>;
  /** The names players chose, by id; null for one who has none. */
  names(userIds: string[]): Promise<Record<string, string | null>>;
  open(room: { id: string; host: string; life_id: string; engine_version: string; content_version: string; seconds: number }): Promise<{ room: string; code: string } | { error: string; room?: string }>;
  join(code: string, userId: string, engineVersion: string, contentVersion: string): Promise<{ room: string } | { error: string; room?: string; engineVersion?: string; contentVersion?: string }>;
  /** Starts the room with the games named for its members, all on one seed. */
  start(roomId: string, host: string, seed: string, games: Record<string, string>, deadline: Date): Promise<{ ok: true } | { error: string }>;
  leave(roomId: string, userId: string): Promise<{ status: string } | { error: string }>;
  /** Closes the room if nobody has moved it for a day by this clock. True if it was closed now. */
  closeIfStale(roomId: string, now: Date): Promise<boolean>;
  loadGame(id: string): Promise<RoomGameRow | null>;
  loadSeed(gameId: string): Promise<string | null>;
  /** The orders kept for a round, by member. */
  loadOrders(roomId: string, round: number): Promise<Record<string, unknown[]>>;
  /** Writes a card of a member's life, if the room is still in that round, the member is not ready, and the game is as read. */
  step(roomId: string, round: number, userId: string, gameId: string, asRead: string, log: LoggedRound[], gameRound: number): Promise<'ok' | 'moved' | 'closed' | 'ready'>;
  /** Keeps a member's orders for a round and marks them ready. `all` once everyone still in the room is. */
  submit(roomId: string, round: number, userId: string, orders: unknown[]): Promise<{ kept: 'new' | 'same' | 'other' | 'moved' | 'closed'; all: boolean }>;
  /** Writes the turn of a round, every life of it, or nothing. With no deadline the room is over. `invalid` if a log could not be held. */
  turn(roomId: string, round: number, deadline: Date | null, lives: TurnLife[]): Promise<'ok' | 'moved' | 'closed' | 'invalid'>;
  /** Writes the run unless one with its id is already there. */
  saveRun(run: RunRow): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A code as a person may type it: its six characters, in any case, with spaces anywhere. */
const TYPED_CODE = /^[A-Za-z0-9\s]{1,16}$/;
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown, max: number): x is string => typeof x === 'string' && x.length >= 1 && x.length <= max;
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;

const bad = (field: string): Reply => ({ status: 400, body: { error: 'bad-request', field } });
const tooMany: Reply = { status: 429, body: { error: 'too-many' } };
const unknownRoom: Reply = { status: 404, body: { error: 'unknown-room' } };
const closed: Reply = { status: 409, body: { error: 'closed' } };
/** The round this call was about has turned meanwhile: the page looks again at the room and the life. */
const moved: Reply = { status: 409, body: { error: 'moved' } };

const versionsOf = (room: RoomRow) => `${room.engine_version}/${room.content_version}`;
const roundsIn = (log: readonly LoggedRound[]) => log.filter((entry) => entry.orders !== null).length;

/** A life of a room, played from its seed: what it is now, its record, and what its last step did. */
function playerOf(game: GameModule, lifeId: string, seed: string) {
  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) throw new Error(`the life ${lifeId} is not in the content of the room`);
  return (log: readonly LoggedRound[]) => {
    let last: ReplayedStep | null = null;
    const whole = game.replayLife(game.content, life.start, seed, log, (step) => {
      last = step;
    });
    return { ...whole, last: last as ReplayedStep | null };
  };
}
type Played = ReturnType<ReturnType<typeof playerOf>>;

/** The log with every card still waiting in its open round answered with the first option, as a member who did not choose answers it. */
function withCardsAnswered(play: (log: readonly LoggedRound[]) => Played, log: LoggedRound[]): { log: LoggedRound[]; played: Played } {
  let next = log;
  let played = play(next);
  for (let n = 0; !played.state.finished && played.state.phase === 'cards'; n++) {
    if (n >= MAX_HAND) throw new Error('a hand that does not end');
    // The engine takes the first open option for a number that is not one: so does the log, and it plays back the same.
    next = withStep(next, { card: 0 });
    played = play(next);
  }
  return { log: next, played };
}

function standingOf(game: GameModule, played: Played): Standing {
  return {
    score: game.finalScore(game.content, played.state),
    netWorth: game.realNetWorth(played.state),
    status: game.livedStatus(played.state),
    escaped: played.state.player.escapedAtRound !== null,
    bankruptcies: played.bankruptcies,
  };
}

function runOf(row: RoomGameRow, game: GameModule, played: Played, at: Date): RunRow {
  return {
    id: row.id,
    user_id: row.user_id,
    game_id: row.id,
    mode: 'room',
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
    finished_at: at.toISOString(),
    challenge: null,
  };
}

const recordOf = (played: Played) => ({ history: played.history, bankruptcies: played.bankruptcies, journal: played.journal });

/** What a step answers: what changed, and no more, as a ranked step answers. The timeline the page holds is not sent again. */
function stepAnswer(game: GameModule, played: Played, step: number, roundBefore: number, run: RunRow | null): Record<string, unknown> {
  const view = (game.viewOf as NonNullable<GameModule['viewOf']>)(played.state);
  const { timeline, ...standing } = view;
  return {
    step,
    view: standing,
    // The world of the round that has just begun, if one has. Never one to come.
    world: view.round > roundBefore ? timeline[view.round] : null,
    events: played.last?.events ?? [],
    earned: played.last?.earned ?? [],
    record: recordOf(played),
    ...(run ? { run } : {}),
  };
}

/** The room as a member may see it: who is in it, who is ready, how each stood when the last round turned, and the clocks. */
async function roomBody(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, room: RoomRow, members: MemberRow[], userId: string): Promise<Record<string, unknown>> {
  const names = await deps.names(members.map((m) => m.user_id));
  return {
    id: room.id,
    code: room.code,
    host: room.host,
    lifeId: room.life_id,
    engineVersion: room.engine_version,
    contentVersion: room.content_version,
    seconds: room.seconds,
    status: room.status,
    round: room.round,
    rounds: games[versionsOf(room)]?.content.rounds ?? null,
    deadline: room.deadline === null ? null : new Date(room.deadline).toISOString(),
    // The server's clock, so that a page counts down to the deadline by it and not by its own.
    now: deps.now().toISOString(),
    members: members.map((m) => ({
      userId: m.user_id,
      name: names[m.user_id] ?? null,
      me: m.user_id === userId,
      host: m.user_id === room.host,
      ready: room.status === 'playing' && m.left_at === null && m.ready_round === room.round,
      left: m.left_at !== null,
      standing: m.standing ?? null,
    })),
  };
}

/** True once the round in play must turn: everyone still in the room is ready, or its deadline and grace have passed. */
function due(room: RoomRow, members: readonly MemberRow[], now: Date): boolean {
  if (room.status !== 'playing' || room.deadline === null) return false;
  const here = members.filter((m) => m.left_at === null);
  return now.getTime() >= Date.parse(room.deadline) + GRACE_MS || (here.length > 0 && here.every((m) => m.ready_round === room.round));
}

/**
 * Turns the round the room is in: every member still in it has their cards left answered with the
 * first option and their kept orders played, or none, and the room moves on together. Read and
 * written again when something moved under it; done by another call meanwhile, it does nothing.
 * At the last round the room is over, and the run of every life is written.
 */
async function turn(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, at: RoomRow): Promise<void> {
  let room = at;
  // Once the database has said it cannot hold a turn, it is played with no orders at all rather than not at all.
  let bare = false;
  for (let attempt = 0; attempt < TURN_TRIES; attempt++) {
    const game = games[versionsOf(room)];
    if (!game?.viewOf) throw new Error(`room ${room.id} is on versions the server does not hold`);
    const members = (await deps.members(room.id)).filter((m) => m.left_at === null);
    const kept = await deps.loadOrders(room.id, room.round);
    const lives: TurnLife[] = [];
    const ends: Array<{ row: RoomGameRow; played: Played }> = [];
    for (const member of members) {
      const row = member.game_id ? await deps.loadGame(member.game_id) : null;
      const seed = row ? await deps.loadSeed(row.id) : null;
      const log = row ? readLog(row.log, game) : null;
      if (row === null || seed === null || log === null) throw new Error(`room ${room.id}: the life of ${member.user_id} cannot be opened`);
      const play = playerOf(game, room.life_id, seed);
      const answered = withCardsAnswered(play, log);
      const ready = Object.hasOwn(kept, member.user_id);
      const orders = !bare && ready && Array.isArray(kept[member.user_id]) ? kept[member.user_id] : [];
      let next = withStep(answered.log, { orders });
      // A log its game could not hold would stop the room for everyone: the round is played without these orders.
      if (JSON.stringify(next).length > MAX_LOG_CHARS) next = withStep(answered.log, { orders: [] });
      let played: Played;
      try {
        played = play(next);
      } catch (error) {
        // Orders are tried when they are kept, so this does not happen; if it did, the round is played with none rather than not at all.
        console.error('room orders refused at the turn:', error instanceof Error ? error.message : error);
        next = withStep(answered.log, { orders: [] });
        played = play(next);
      }
      lives.push({ user: member.user_id, game: row.id, as_read: row.updated_at, log: next, round: played.state.round, finished: played.state.finished, ready, standing: standingOf(game, played) });
      ends.push({ row, played });
    }
    const over = lives.length > 0 && lives.every((life) => life.finished);
    const said = await deps.turn(room.id, room.round, over ? null : new Date(deps.now().getTime() + room.seconds * 1000), lives);
    if (said === 'ok') {
      if (over) for (const end of ends) await deps.saveRun(runOf(end.row, game, end.played, deps.now()));
      return;
    }
    if (said === 'closed') return;
    if (said === 'invalid') {
      console.error(`room ${room.id}: a turn could not be held; the round is played with no orders`);
      bare = true;
      continue;
    }
    // Moved: another call turned it, or a member came, went, played a card or kept orders while it was being read.
    const now = await deps.loadRoom(room.id);
    if (now === null || now.status !== 'playing' || now.round !== room.round) return;
    room = now;
  }
  throw new Error(`room ${room.id}: the round could not be turned`);
}

/**
 * What every look at a room does first: a room nobody has moved for a day is closed, and a round
 * that is due is turned. Answers the room and its members as they then stand, and whether a round
 * turned in this very call.
 */
async function upkeep(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, room: RoomRow, members: MemberRow[]) {
  let changed = false;
  let turned = false;
  try {
    if ((room.status === 'open' || room.status === 'playing') && (await deps.closeIfStale(room.id, deps.now()))) changed = true;
    else if (due(room, members, deps.now())) {
      await turn(games, deps, room);
      changed = true;
      turned = true;
    }
  } catch (error) {
    // A round that cannot be turned now is turned on a later look. Meanwhile the room is shown as it stands, and can be left.
    console.error(`room ${room.id}: upkeep failed:`, error instanceof Error ? error.message : error);
    return { room, members, turned: false };
  }
  if (!changed) return { room, members, turned };
  const now = await deps.loadRoom(room.id);
  if (now === null) throw new Error(`room ${room.id} is gone`);
  return { room: now, members: await deps.members(room.id), turned };
}

/**
 * Rooms: two to six players live the same life in the same world, a round at a time. Each
 * member's life is played here, from the room's seed and the member's log, as a ranked life is;
 * cards are played as they come, and orders wait until the round turns for everyone, so nobody sees
 * how a round turns out before all have chosen.
 *
 * `userId` is who the token says is asking. A room they are not in gets the answer a room that
 * does not exist gets.
 */
export async function rooms(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string, raw: unknown): Promise<Reply> {
  if (!isRecord(raw)) return bad('body');
  try {
    switch (raw.action) {
      case 'mine':
        return await mine(games, deps, userId);
      case 'open':
        return await open(games, deps, userId, raw);
      case 'join':
        return await join(games, deps, userId, raw);
      case 'start':
      case 'leave':
      case 'state':
      case 'view':
      case 'card':
      case 'submit':
        return await inRoom(games, deps, userId, raw);
      default:
        return bad('action');
    }
  } catch (error) {
    console.error('rooms failed:', error instanceof Error ? error.message : error);
    return { status: 500, body: { error: 'server' } };
  }
}

/** The room the player is in, as it stands, or none. */
async function mine(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string): Promise<Reply> {
  if (!(await deps.allow(userId, 'room-step'))) return tooMany;
  const id = await deps.myRoom(userId);
  const found = id === null ? null : await deps.loadRoom(id);
  if (found === null) return { status: 200, body: { room: null } };
  const { room, members } = await upkeep(games, deps, found, await deps.members(found.id));
  return { status: 200, body: { room: await roomBody(games, deps, room, members, userId) } };
}

/** Answers the room the call ended in, as the asker sees it. */
async function answerRoom(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, id: string, userId: string, extra: Record<string, unknown> = {}): Promise<Reply> {
  const room = await deps.loadRoom(id);
  if (room === null) throw new Error(`room ${id} is gone`);
  return { status: 200, body: { room: await roomBody(games, deps, room, await deps.members(id), userId), ...extra } };
}

/** Opens a room on the rules the server plays now, for a life the host may play, with a round of so many seconds. */
async function open(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string, raw: Record<string, unknown>): Promise<Reply> {
  const { lifeId, seconds, engineVersion, contentVersion } = raw;
  if (!isText(lifeId, 40)) return bad('lifeId');
  if (!ROUND_SECONDS.includes(seconds as (typeof ROUND_SECONDS)[number])) return bad('seconds');
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');
  // Counted before anything is looked up: a call costs the same whatever it turns out to ask for.
  if (!(await deps.allow(userId, 'room-make'))) return tooMany;

  const key = `${engineVersion}/${contentVersion}`;
  const game = Object.hasOwn(games, key) ? games[key] : null;
  // Every member's life is set beside the others: a room is played on the rules the game plays now, with a seed nobody can find.
  if (game === null || !game.viewOf || (game.SEED_BITS ?? 0) < 128 || key !== deps.current) return { status: 409, body: { error: 'cannot-room' } };
  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) return { status: 400, body: { error: 'unknown-life' } };
  if (life.unlock !== 'default' && !(await deps.unlockedLives(userId)).includes(life.id)) return { status: 403, body: { error: 'locked-life' } };

  const made = await deps.open({ id: deps.newId(), host: userId, life_id: life.id, engine_version: engineVersion, content_version: contentVersion, seconds: seconds as number });
  if ('error' in made) return { status: 409, body: { error: made.error, ...(made.room ? { roomId: made.room } : {}) } };
  return await answerRoom(games, deps, made.room, userId);
}

/** Joins a room by its code, from a page on the room's rules. */
async function join(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string, raw: Record<string, unknown>): Promise<Reply> {
  const { code, engineVersion, contentVersion } = raw;
  if (typeof code !== 'string' || !TYPED_CODE.test(code)) return bad('code');
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');
  if (!(await deps.allow(userId, 'room-make'))) return tooMany;

  const joined = await deps.join(code, userId, engineVersion, contentVersion);
  if ('error' in joined) {
    if (joined.error === 'unknown-room') return unknownRoom;
    return {
      status: 409,
      body: {
        error: joined.error,
        ...(joined.room ? { roomId: joined.room } : {}),
        ...(joined.engineVersion ? { engineVersion: joined.engineVersion, contentVersion: joined.contentVersion } : {}),
      },
    };
  }
  return await answerRoom(games, deps, joined.room, userId);
}

/** Everything done in a room the player is in. */
async function inRoom(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string, raw: Record<string, unknown>): Promise<Reply> {
  const { roomId } = raw;
  if (typeof roomId !== 'string' || !UUID.test(roomId)) return bad('roomId');
  let choice: Choice | null = null;
  if (raw.action === 'card' || raw.action === 'submit') {
    if (!isCount(raw.step)) return bad('step');
    if (raw.action === 'submit' && !Array.isArray(raw.orders)) return bad('orders');
    // What is logged must play back to the same game: a whole number, or the first option, which is what the engine falls back to.
    choice = raw.action === 'card' ? { card: isCount(raw.option) ? raw.option : 0 } : { orders: raw.orders as unknown[] };
  }
  if (!(await deps.allow(userId, 'room-step'))) return tooMany;

  const found = await deps.loadRoom(roomId);
  const everyone = found === null ? [] : await deps.members(roomId);
  if (found === null || !everyone.some((m) => m.user_id === userId)) return unknownRoom;
  const { room, members, turned } = await upkeep(games, deps, found, everyone);
  const me = members.find((m) => m.user_id === userId) as MemberRow;
  const game = games[versionsOf(room)];

  if (raw.action === 'state') return { status: 200, body: { room: await roomBody(games, deps, room, members, userId) } };

  if (raw.action === 'leave') {
    const left = await deps.leave(room.id, userId);
    if ('error' in left) return closed;
    // Everyone still in the room may have been waiting only for the one who left.
    const now = await deps.loadRoom(room.id);
    if (now !== null) await upkeep(games, deps, now, await deps.members(room.id));
    return await answerRoom(games, deps, room.id, userId);
  }

  if (raw.action === 'start') {
    if (room.status !== 'open') return { status: 409, body: { error: 'started' } };
    if (room.host !== userId) return { status: 403, body: { error: 'not-host' } };
    if (!game?.viewOf) return { status: 409, body: { error: 'cannot-room' } };
    const named: Record<string, string> = {};
    for (const member of members) if (member.left_at === null) named[member.user_id] = deps.newId();
    const begun = await deps.start(room.id, userId, deps.newSeed(), named, new Date(deps.now().getTime() + room.seconds * 1000));
    if ('error' in begun) return { status: begun.error === 'not-host' ? 403 : 409, body: { error: begun.error } };
    return await answerRoom(games, deps, room.id, userId);
  }

  // The rest is about the member's own life in the room.
  if (me.left_at !== null) return closed;
  if (room.status === 'open') return { status: 409, body: { error: 'not-started' } };
  const row = me.game_id ? await deps.loadGame(me.game_id) : null;
  if (row === null || row.status === 'abandoned') return closed;
  const seed = await deps.loadSeed(row.id);
  const log = game ? readLog(row.log, game) : null;
  // A game the server made itself can always be opened. One that cannot is broken, and that is the server's fault.
  if (!game?.viewOf || seed === null || log === null) throw new Error(`room ${room.id}: the life of ${userId} cannot be opened`);
  const viewOf = game.viewOf;
  const play = playerOf(game, room.life_id, seed);
  const steps = stepsOf(log);

  if (raw.action === 'view') {
    const played = play(log);
    let run: RunRow | null = null;
    if (played.state.finished) {
      // Written at the turn of the last round. Written again here, which changes nothing, if the call that turned it stopped before.
      run = runOf(row, game, played, deps.now());
      await deps.saveRun(run);
    }
    return {
      status: 200,
      body: {
        gameId: row.id,
        lifeId: row.life_id,
        engineVersion: row.engine_version,
        contentVersion: row.content_version,
        step: steps,
        view: viewOf(played.state),
        record: recordOf(played),
        // What the last step did: the round a member waited for, or the one the clock played for them.
        events: played.last?.events ?? [],
        earned: played.last?.earned ?? [],
        ...(run ? { run } : {}),
      },
    };
  }

  const picked = choice as Choice;
  if (room.status !== 'playing' || row.status !== 'playing') return closed;
  // The round this was chosen in turned during this very call.
  if (turned) return moved;

  if ('card' in picked) {
    // The card was taken before, with this very option: the answer was lost on its way, and is given again.
    if (raw.step === steps - 1 && lastIs(log, picked) && roundsIn(log) === room.round) return { status: 200, body: stepAnswer(game, play(log), steps, room.round, null) };
    if (raw.step !== steps) return { status: 409, body: { error: 'out-of-step', step: steps } };
    if (me.ready_round === room.round) return { status: 409, body: { error: 'ready' } };
    if (roundsIn(log) !== room.round) return moved;
    const next = withStep(log, picked);
    let played: Played;
    try {
      played = play(next);
    } catch (error) {
      // The engine refuses what cannot happen: a card when none is waiting.
      console.error('room card refused:', error instanceof Error ? error.message : error);
      return { status: 422, body: { error: 'cannot-play' } };
    }
    const said = await deps.step(room.id, room.round, userId, row.id, row.updated_at, next, played.state.round);
    if (said === 'ready') return { status: 409, body: { error: 'ready' } };
    if (said === 'closed') return closed;
    if (said === 'moved') return moved;
    return { status: 200, body: stepAnswer(game, played, steps + 1, room.round, null) };
  }

  // Orders for the round: tried now, played when the round turns.
  if (picked.orders.length > game.content.maxOrdersPerRound || JSON.stringify(picked.orders).length > MAX_ORDERS_CHARS) return bad('orders');
  if (raw.step !== steps) return { status: 409, body: { error: 'out-of-step', step: steps } };
  if (roundsIn(log) !== room.round) return moved;
  const answered = withCardsAnswered(play, log);
  try {
    play(withStep(answered.log, picked));
  } catch (error) {
    console.error('room orders refused:', error instanceof Error ? error.message : error);
    return { status: 422, body: { error: 'cannot-play' } };
  }
  const kept = await deps.submit(room.id, room.round, userId, picked.orders);
  if (kept.kept === 'other') return { status: 409, body: { error: 'ready' } };
  if (kept.kept === 'moved') return moved;
  if (kept.kept === 'closed') return closed;
  if (!kept.all) return await answerRoom(games, deps, room.id, userId, { result: null });

  // The last to play turns the round, and is answered their round as a step is.
  const before = room.round;
  const now = await deps.loadRoom(room.id);
  if (now !== null && now.round === before) await turn(games, deps, now);
  const after = await deps.loadGame(row.id);
  const played = after ? readLog(after.log, game) : null;
  if (after === null || played === null || roundsIn(played) <= before) return await answerRoom(games, deps, room.id, userId, { result: null });
  const mine = play(played);
  const run = mine.state.finished ? runOf(after, game, mine, deps.now()) : null;
  return await answerRoom(games, deps, room.id, userId, { result: stepAnswer(game, mine, stepsOf(played), before, run) });
}
