import type { RunRow } from './finish.ts';
import type { GameModule, LoggedRound, RoomEvent } from './game/types.ts';
import { lifePlayer } from './played.ts';
import type { Played } from './played.ts';
import { lastIs, stepsOf, withStep } from './ranked.ts';
import type { NoticeAbout } from './notice.ts';
import type { Choice } from './ranked.ts';
import { readLog } from './replay.ts';
import type { Reply } from './replay.ts';

/** How long a round may take, in seconds: the host chooses one of these. */
export const ROUND_SECONDS = [90, 180, 300, 43_200, 86_400] as const;
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
  /** The rematch opened from this room once it was over, if one was. */
  rematch: string | null;
  /** The room this one is the rematch of, if it is one. */
  rematch_of: string | null;
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
  /** How the member stood the round before, for what changed: their score and their place. Null after the first round. */
  before?: { score: number; place: number } | null;
  /** Where they live, and their job and its rung: what the others may know of a life once the round has turned. */
  cityId?: string;
  career?: { id: string; level: number } | null;
}

/** A row of `room_players`, without its room. */
export interface MemberRow {
  user_id: string;
  game_id: string | null;
  ready_round: number | null;
  left_at: string | null;
  standing: Standing | null;
  joined_at: string;
  /** The last thing the member shouted to the others, and when. */
  shout: number | null;
  shout_at: string | null;
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

/** A loan offered between two players of a room, as the database keeps it. Amounts in cents, the rate in basis points. */
export interface LoanRow {
  id: string;
  room_id: string;
  round: number;
  proposer: string;
  lender: string;
  borrower: string;
  amount: number;
  rate_bp: number;
  rounds: number;
  status: 'open' | 'accepted' | 'refused' | 'withdrawn' | 'paid' | 'failed' | 'expired';
}

/** What a loan between players may be: from a hundred dollars to ten million, up to twenty per cent a year in whole points, for one to five rounds. */
export const LOAN_LIMITS = { minAmount: 10_000, maxAmount: 1_000_000_000, maxRateBp: 2_000, rateStepBp: 100, maxRounds: 5 } as const;

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
  /** The rat each player chose to be seen as (`rat_<colour>`), by id; null for one who has not chosen. */
  avatars(userIds: string[]): Promise<Record<string, string | null>>;
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
  /** Opens the rematch of a room that is over. `rematch-open`, with its room and code, if another member opened it first. */
  rematch(oldRoom: string, room: { id: string; host: string; life_id: string; engine_version: string; content_version: string; seconds: number }): Promise<{ room: string; code: string } | { error: string; room?: string; code?: string }>;
  /** Sends a member's shout to everyone in the room. `soon` if they sent one a moment ago, `closed` if they cannot. */
  shout(roomId: string, userId: string, shout: number, now: Date): Promise<'ok' | 'soon' | 'closed'>;
  /** The rooms the player was in that are over, the latest first, at most `limit`, each with everyone who was in it. */
  history(userId: string, limit: number): Promise<Array<{ room: RoomRow; members: Array<MemberRow & { quit: boolean }> }>>;
  /** Every loan offered in the room, in any round. */
  loans(roomId: string): Promise<LoanRow[]>;
  /** Offers a loan in the round the room is in, in place of the proposer's last offer to the same player that round. */
  offerLoan(loan: Omit<LoanRow, 'status'>): Promise<'ok' | 'closed' | 'moved'>;
  /** The other player's answer to an open offer, or its proposer withdrawing it with a no. `gone` for one no longer open. */
  answerLoan(id: string, userId: string, yes: boolean): Promise<'ok' | 'gone'>;
  /** Writes what came of the offers of a round that has turned: `paid` were paid out. */
  closeLoans(roomId: string, round: number, paid: string[]): Promise<void>;
  /** Tells players, on the devices that asked for notices, that their game needs them. Never fails: a notice lost is no reason to refuse a move. */
  notify(userIds: string[], about: RoomNotice): Promise<void>;
}

/** What a game with friends tells its players by a notice. */
export type RoomNotice = Extract<NoticeAbout, { kind: 'roomStarted' } | { kind: 'yourTurn' } | { kind: 'newRound' } | { kind: 'rematch' } | { kind: 'loanOffer' }>;

/** How many shouts there are to choose from: the page draws them, the server keeps their number. */
export const SHOUTS = 14;
/** How long a shout is news: a page that comes back later does not show it. */
const SHOUT_FRESH_MS = 60_000;
/** How many games over a history holds. */
export const HISTORY_LIMIT = 20;

/** A room whose rounds take this long or more is played at a distance: each new round is told. */
const SLOW_SECONDS = 3_600;

/** A round with less than this left is not worth a notice: by the time it is read, the round has turned. */
const NOTICE_MIN_MS = 20_000;

/**
 * Once everyone but one has played a round, the one left is told the others are waiting, with the
 * time left. Told once a round: only the play that leaves exactly one waiting tells them.
 */
async function tellTheLastOne(deps: RoomsDeps, room: RoomRow, rounds: number): Promise<void> {
  if (room.deadline === null) return;
  const left = Date.parse(room.deadline) - deps.now().getTime();
  if (left < NOTICE_MIN_MS) return;
  const here = (await deps.members(room.id)).filter((m) => m.left_at === null);
  const waiting = here.filter((m) => m.ready_round !== room.round);
  if (here.length < 2 || waiting.length !== 1) return;
  await deps.notify([waiting[0].user_id], { kind: 'yourTurn', round: room.round + 1, rounds, secondsLeft: Math.round(left / 1000) });
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

/** A member's life in a room, played from its seed: to where a log leaves it, or one step further. */
function playerOf(game: GameModule, room: RoomRow, gameId: string, seed: string) {
  const life = game.lives.find((one) => one.id === room.life_id);
  if (!life) throw new Error(`the life ${room.life_id} is not in the content of the room`);
  // A life of a room is marked as one, so that it may tease the others: on the versions that know how.
  return lifePlayer(game, gameId, versionsOf(room), game.roomStart ? game.roomStart(life.start) : life.start, seed);
}
type Player = ReturnType<typeof playerOf>;

/** The log with every card still waiting in its open round answered with the first option, as a member who did not choose answers it. */
function withCardsAnswered(player: Player, log: LoggedRound[]): { log: LoggedRound[]; played: Played } {
  let next = log;
  let played = player.play(next);
  for (let n = 0; !played.state.finished && played.state.phase === 'cards'; n++) {
    if (n >= MAX_HAND) throw new Error('a hand that does not end');
    // The engine takes the first open option for a number that is not one: so does the log, and it plays back the same.
    const was = next;
    next = withStep(next, { card: 0 });
    played = player.step(was, next, { card: 0 });
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
    ...(played.state.player.cityId ? { cityId: played.state.player.cityId } : {}),
    career: played.state.player.life?.career ? { id: played.state.player.life.career.id, level: played.state.player.life.career.level } : null,
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
  const ids = members.map((m) => m.user_id);
  const [names, avatars, loans] = await Promise.all([deps.names(ids), deps.avatars(ids), room.status === 'playing' || room.status === 'finished' ? deps.loans(room.id) : Promise.resolve([])]);
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
      avatar: avatars[m.user_id] ?? null,
      me: m.user_id === userId,
      host: m.user_id === room.host,
      ready: room.status === 'playing' && m.left_at === null && m.ready_round === room.round,
      left: m.left_at !== null,
      standing: m.standing ?? null,
      // A face put on the round that turned last; an older one is no longer news.
      shout: m.left_at === null && m.shout !== null && m.shout_at !== null && deps.now().getTime() - Date.parse(m.shout_at) < SHOUT_FRESH_MS ? { n: m.shout, at: new Date(m.shout_at).toISOString() } : null,
    })),
    // The rematch of a room that is over, while it waits in its lobby for whoever wants it.
    rematch: room.rematch === null ? null : await rematchOf(deps, room.rematch),
    rematchOf: room.rematch_of !== null,
    loans: loansFor(loans, room, userId),
  };
}

/**
 * The loans a player of a room is told of: the offers of the round in play that are theirs to
 * answer or that they made, and what came of those of the round that turned last.
 */
function loansFor(loans: readonly LoanRow[], room: RoomRow, userId: string) {
  return loans
    .filter((loan) => loan.lender === userId || loan.borrower === userId)
    .filter((loan) =>
      loan.round === room.round
        ? loan.status === 'open' || loan.status === 'accepted' || (loan.status === 'refused' && loan.proposer === userId)
        : loan.round === room.round - 1 && (loan.status === 'paid' || loan.status === 'failed' || (loan.status === 'expired' && loan.proposer === userId)),
    )
    .map((loan) => ({
      id: loan.id,
      round: loan.round,
      lend: loan.lender === userId,
      other: loan.lender === userId ? loan.borrower : loan.lender,
      mine: loan.proposer === userId,
      amount: loan.amount,
      rateBp: loan.rate_bp,
      rounds: loan.rounds,
      status: loan.status,
    }));
}

/** A rematch as a room that is over tells of it: its code while it can still be joined, and whether it can. */
async function rematchOf(deps: RoomsDeps, id: string): Promise<{ code: string; open: boolean } | null> {
  const found = await deps.loadRoom(id);
  return found === null ? null : { code: found.code, open: found.status === 'open' };
}

/** The members of a room, best first by the score the last round left them with; those who left after them. */
function placed(members: readonly MemberRow[]): MemberRow[] {
  const score = (m: MemberRow) => m.standing?.score ?? Number.NEGATIVE_INFINITY;
  return [...members].sort((a, b) => Number(a.left_at !== null) - Number(b.left_at !== null) || score(b) - score(a));
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
async function turn(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, at: RoomRow, by: string): Promise<void> {
  let room = at;
  // Once the database has said it cannot hold a turn, it is played with no orders at all rather than not at all.
  let bare = false;
  for (let attempt = 0; attempt < TURN_TRIES; attempt++) {
    const game = games[versionsOf(room)];
    if (!game?.viewOf) throw new Error(`room ${room.id} is on versions the server does not hold`);
    const everyone = await deps.members(room.id);
    const members = everyone.filter((m) => m.left_at === null);
    // Where each stood when the round before turned, as the standings showed it then: those who left last.
    const placesBefore = new Map(placed(everyone.filter((m) => m.standing !== null)).map((m, at) => [m.user_id, at + 1]));
    // Every life of the room is read at once: a turn waits for one trip to the database, not two for each member.
    const [kept, rows] = await Promise.all([
      deps.loadOrders(room.id, room.round),
      Promise.all(members.map(async (member) => (member.game_id ? await Promise.all([deps.loadGame(member.game_id), deps.loadSeed(member.game_id)]) : ([null, null] as const)))),
    ]);
    const taken: Array<{ member: MemberRow; row: RoomGameRow; player: Player; answered: LoggedRound[]; next: LoggedRound[]; played: Played; ready: boolean }> = [];
    for (const [at, member] of members.entries()) {
      const [row, seed] = rows[at];
      const log = row ? readLog(row.log, game, true) : null;
      if (row === null || seed === null || log === null) throw new Error(`room ${room.id}: the life of ${member.user_id} cannot be opened`);
      const player = playerOf(game, room, row.id, seed);
      const answered = withCardsAnswered(player, log);
      const ready = Object.hasOwn(kept, member.user_id);
      const orders = !bare && ready && Array.isArray(kept[member.user_id]) ? kept[member.user_id] : [];
      let next = withStep(answered.log, { orders });
      // A log its game could not hold would stop the room for everyone: the round is played without these orders.
      if (JSON.stringify(next).length > MAX_LOG_CHARS) next = withStep(answered.log, { orders: [] });
      let played: Played;
      try {
        played = player.step(answered.log, next, { orders: next[next.length - 1].orders ?? [] });
      } catch (error) {
        // Orders are tried when they are kept, so this does not happen; if it did, the round is played with none rather than not at all.
        console.error('room orders refused at the turn:', error instanceof Error ? error.message : error);
        next = withStep(answered.log, { orders: [] });
        played = player.step(answered.log, next, { orders: [] });
      }
      taken.push({ member, row, player, answered: answered.log, next, played, ready });
    }
    // What the players did to each other this round: each tease that was taken, at whoever it was aimed at still in the room,
    // and the loans they agreed, paid out, or lost to whoever owed them going under.
    const done = teasesOf(taken.map((life) => ({ user: life.member.user_id, orders: life.next[life.next.length - 1].orders ?? [], events: life.played.last?.events ?? [] })), new Set(members.map((m) => m.user_id)));
    const lent = loansAt(
      (await deps.loans(room.id)).filter((loan) => loan.round === room.round && loan.status === 'accepted'),
      new Map(taken.map((life) => [life.member.user_id, life.played.state])),
    );
    for (const [user, events] of lent.events) done.set(user, [...(done.get(user) ?? []), ...events]);
    const lives: TurnLife[] = [];
    const ends: Array<{ row: RoomGameRow; played: Played }> = [];
    for (const life of taken) {
      let { next, played } = life;
      const room = done.get(life.member.user_id);
      if (room) {
        const last = next[next.length - 1];
        next = [...next.slice(0, -1), { ...last, room }];
        played = life.player.step(life.answered, next, { orders: last.orders ?? [], room });
      }
      const was = life.member.standing;
      const before = was ? { score: was.score, place: placesBefore.get(life.member.user_id) ?? 0 } : null;
      lives.push({ user: life.member.user_id, game: life.row.id, as_read: life.row.updated_at, log: next, round: played.state.round, finished: played.state.finished, ready: life.ready, standing: { ...standingOf(game, played), before } });
      ends.push({ row: life.row, played });
    }
    const over = lives.length > 0 && lives.every((life) => life.finished);
    const said = await deps.turn(room.id, room.round, over ? null : new Date(deps.now().getTime() + room.seconds * 1000), lives);
    if (said === 'ok') {
      await deps.closeLoans(room.id, room.round, lent.paid);
      if (over) for (const end of ends) await deps.saveRun(runOf(end.row, game, end.played, deps.now()));
      // In a slow room nobody is looking: everyone but whoever turned it is told the next round is theirs.
      else if (room.seconds >= SLOW_SECONDS) await deps.notify(lives.map((life) => life.user).filter((user) => user !== by), { kind: 'newRound', round: room.round + 2, rounds: game.content.rounds, seconds: room.seconds });
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

/** What a life of a room holds that a loan between players needs: its cash, what it owes, what it has lent, and whether it is over. */
type LoanState = { finished: boolean; player: { cash: number; debts: Array<{ id: string }>; lent?: Array<{ id: string; peer: string }> } };

/**
 * The loans of a round as it turns, by the lives as the round left them: each one agreed is paid out
 * if both are still in the game and the lender has the cash, in the order they were offered; and
 * what is lent to someone gone from the game, or who no longer owes it because they went bankrupt,
 * is lost. Answers the room events each life takes, and the loans paid out.
 */
export function loansAt(accepted: readonly LoanRow[], lives: ReadonlyMap<string, LoanState>): { events: Map<string, RoomEvent[]>; paid: string[] } {
  const events = new Map<string, RoomEvent[]>();
  const add = (user: string, event: RoomEvent) => events.set(user, [...(events.get(user) ?? []), event]);
  const paid: string[] = [];
  for (const [user, life] of lives) {
    for (const loan of life.player.lent ?? []) {
      const owes = lives.get(loan.peer)?.player.debts.some((debt) => debt.id === loan.id) ?? false;
      if (!owes) add(user, { kind: 'defaulted', id: loan.id });
    }
  }
  // Cash already promised this turn by each lender, so two loans are not paid out of the same money.
  const promised = new Map<string, number>();
  for (const loan of accepted) {
    const lender = lives.get(loan.lender);
    const borrower = lives.get(loan.borrower);
    const spent = promised.get(loan.lender) ?? 0;
    if (!lender || !borrower || lender.finished || borrower.finished || lender.player.cash - spent < loan.amount) continue;
    promised.set(loan.lender, spent + loan.amount);
    const terms = { id: loan.id, amount: loan.amount, rateBp: loan.rate_bp, rounds: loan.rounds };
    add(loan.lender, { kind: 'lent', to: loan.borrower, ...terms });
    add(loan.borrower, { kind: 'borrowed', from: loan.lender, ...terms });
    paid.push(loan.id);
  }
  return { events, paid };
}

/** A tease among a round's orders: the use of focus aimed at another player of the room. */
const isTease = (order: unknown): order is { type: 'focus'; action: 'tease'; target: string } =>
  typeof order === 'object' && order !== null && (order as { type?: unknown }).type === 'focus' && (order as { action?: unknown }).action === 'tease';

/**
 * Who was teased in a round, and by whom: for each player's life, the room events its log takes.
 * A tease counts when its life took it (it had the focus, once a round) and its target is another
 * player still in the room; one aimed at nobody, at oneself or at someone gone gives its maker their
 * status all the same, and does nothing to anyone.
 */
export function teasesOf(lives: ReadonlyArray<{ user: string; orders: readonly unknown[]; events: readonly unknown[] }>, inRoom: ReadonlySet<string>): Map<string, RoomEvent[]> {
  const done = new Map<string, RoomEvent[]>();
  for (const life of lives) {
    const refused = life.events.some((event) => (event as { kind?: unknown }).kind === 'orderRejected' && isTease((event as { order?: unknown }).order));
    const tease = life.orders.find(isTease);
    if (!tease || refused || typeof tease.target !== 'string' || tease.target === life.user || !inRoom.has(tease.target)) continue;
    done.set(tease.target, [...(done.get(tease.target) ?? []), { kind: 'teased', by: life.user }]);
  }
  return done;
}

/**
 * Whether a room may have gone quiet long enough to be closed, by the rule `room_close` keeps: a
 * lobby never started, or a round left waiting, for a day or three rounds, whichever is longer.
 * Only a room this says yes to is handed to the database, which decides; the rest are not.
 */
export function mayBeStale(room: RoomRow, now: Date): boolean {
  const quiet = Math.max(86_400_000, 3 * room.seconds * 1000);
  if (room.status === 'open') return Date.parse(room.created_at) < now.getTime() - quiet;
  if (room.status === 'playing') return room.deadline !== null && Date.parse(room.deadline) < now.getTime() - quiet;
  return false;
}

/**
 * What every look at a room does first: a room nobody has moved for a day is closed, and a round
 * that is due is turned. Answers the room and its members as they then stand, and whether a round
 * turned in this very call.
 */
async function upkeep(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, room: RoomRow, members: MemberRow[], by: string) {
  let changed = false;
  let turned = false;
  try {
    if (mayBeStale(room, deps.now()) && (await deps.closeIfStale(room.id, deps.now()))) changed = true;
    else if (due(room, members, deps.now())) {
      await turn(games, deps, room, by);
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
      case 'rematch':
        return await rematch(games, deps, userId, raw);
      case 'history':
        return await history(deps, userId);
      case 'start':
      case 'leave':
      case 'state':
      case 'view':
      case 'card':
      case 'submit':
      case 'shout':
      case 'loan':
      case 'loanAnswer':
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
  const { room, members } = await upkeep(games, deps, found, await deps.members(found.id), userId);
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

/**
 * The rematch of a room that is over: a new room with the same pace, on the rules the server plays
 * now, for a life the asker may play, with the asker as its host. Whoever asks after it was opened
 * joins it instead, so that one press does for everyone. The others still looking at the room that
 * is over hear of it through Realtime, and by a notice.
 */
async function rematch(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string, raw: Record<string, unknown>): Promise<Reply> {
  const { roomId, lifeId, engineVersion, contentVersion } = raw;
  if (typeof roomId !== 'string' || !UUID.test(roomId)) return bad('roomId');
  if (!isText(lifeId, 40)) return bad('lifeId');
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');
  if (!(await deps.allow(userId, 'room-make'))) return tooMany;

  const old = await deps.loadRoom(roomId);
  const everyone = old === null ? [] : await deps.members(roomId);
  if (old === null || !everyone.some((m) => m.user_id === userId)) return unknownRoom;
  const key = `${engineVersion}/${contentVersion}`;
  const game = Object.hasOwn(games, key) ? games[key] : null;
  if (game === null || !game.viewOf || (game.SEED_BITS ?? 0) < 128 || key !== deps.current) return { status: 409, body: { error: 'cannot-room' } };
  const life = game.lives.find((one) => one.id === lifeId);
  if (!life) return { status: 400, body: { error: 'unknown-life' } };
  if (life.unlock !== 'default' && !(await deps.unlockedLives(userId)).includes(life.id)) return { status: 403, body: { error: 'locked-life' } };

  const made = await deps.rematch(old.id, { id: deps.newId(), host: userId, life_id: life.id, engine_version: engineVersion, content_version: contentVersion, seconds: old.seconds });
  if ('error' in made) {
    // Opened by someone else first: joined, as the button promised.
    if (made.error === 'rematch-open' && made.code) return await join(games, deps, userId, { code: made.code, engineVersion, contentVersion }, false);
    if (made.error === 'unknown-room') return unknownRoom;
    return { status: 409, body: { error: made.error, ...(made.room ? { roomId: made.room } : {}) } };
  }
  await deps.notify(
    everyone.filter((m) => m.left_at === null && m.user_id !== userId).map((m) => m.user_id),
    { kind: 'rematch' },
  );
  return await answerRoom(games, deps, made.room, userId);
}

/** The games over the player was in, the latest first: each with its life, its pace, and everyone in it in their final order. */
async function history(deps: RoomsDeps, userId: string): Promise<Reply> {
  if (!(await deps.allow(userId, 'room-step'))) return tooMany;
  const rows = await deps.history(userId, HISTORY_LIMIT);
  const names = await deps.names([...new Set(rows.flatMap((row) => row.members.map((m) => m.user_id)))]);
  return {
    status: 200,
    body: {
      games: rows.map(({ room, members }) => ({
        id: room.id,
        lifeId: room.life_id,
        seconds: room.seconds,
        playedAt: new Date(room.created_at).toISOString(),
        rematchOf: room.rematch_of !== null,
        // The player's own life in it, which their device keeps among its finished lives under this id.
        gameId: members.find((m) => m.user_id === userId)?.game_id ?? null,
        // Everyone leaves a game once it is over: only those who gave their life up before the end left it.
        players: [...members]
          .sort((a, b) => Number(a.quit) - Number(b.quit) || (b.standing?.score ?? Number.NEGATIVE_INFINITY) - (a.standing?.score ?? Number.NEGATIVE_INFINITY))
          .map((m) => ({
            name: names[m.user_id] ?? null,
            tag: m.user_id.slice(0, 4).toUpperCase(),
            me: m.user_id === userId,
            score: m.standing?.score ?? null,
            left: m.quit,
            netWorth: m.standing?.netWorth ?? null,
            cityId: m.standing?.cityId ?? null,
            career: m.standing?.career ?? null,
          })),
      })),
    },
  };
}

/** Joins a room by its code, from a page on the room's rules. */
async function join(games: Readonly<Record<string, GameModule>>, deps: RoomsDeps, userId: string, raw: Record<string, unknown>, count = true): Promise<Reply> {
  const { code, engineVersion, contentVersion } = raw;
  if (typeof code !== 'string' || !TYPED_CODE.test(code)) return bad('code');
  if (!isText(engineVersion, 20)) return bad('engineVersion');
  if (!isText(contentVersion, 20)) return bad('contentVersion');
  // A rematch that joins was counted as the rematch it was asked as.
  if (count && !(await deps.allow(userId, 'room-make'))) return tooMany;

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
  // Counted whatever it turns out to ask for, and the room looked up meanwhile: one trip to the database, not three.
  const [allowed, found, everyone] = await Promise.all([deps.allow(userId, 'room-step'), deps.loadRoom(roomId), deps.members(roomId)]);
  if (!allowed) return tooMany;
  if (found === null || !everyone.some((m) => m.user_id === userId)) return unknownRoom;
  const { room, members, turned } = await upkeep(games, deps, found, everyone, userId);
  const me = members.find((m) => m.user_id === userId) as MemberRow;
  const game = games[versionsOf(room)];

  if (raw.action === 'state') return { status: 200, body: { room: await roomBody(games, deps, room, members, userId) } };

  if (raw.action === 'shout') {
    const { shout } = raw;
    if (!(Number.isInteger(shout) && (shout as number) >= 0 && (shout as number) < SHOUTS)) return bad('shout');
    const said = await deps.shout(room.id, userId, shout as number, deps.now());
    if (said === 'closed') return closed;
    if (said === 'soon') return { status: 409, body: { error: 'soon' } };
    return await answerRoom(games, deps, room.id, userId);
  }

  if (raw.action === 'loan') {
    const { to, lend, amount, rateBp, rounds } = raw;
    const others = members.filter((m) => m.left_at === null && m.user_id !== userId).map((m) => m.user_id);
    if (typeof to !== 'string' || !others.includes(to)) return bad('to');
    if (typeof lend !== 'boolean') return bad('lend');
    if (!Number.isSafeInteger(amount) || (amount as number) < LOAN_LIMITS.minAmount || (amount as number) > LOAN_LIMITS.maxAmount) return bad('amount');
    if (!Number.isSafeInteger(rateBp) || (rateBp as number) < 0 || (rateBp as number) > LOAN_LIMITS.maxRateBp || (rateBp as number) % LOAN_LIMITS.rateStepBp !== 0) return bad('rateBp');
    if (!Number.isSafeInteger(rounds) || (rounds as number) < 1 || (rounds as number) > LOAN_LIMITS.maxRounds) return bad('rounds');
    if (room.status !== 'playing' || me.left_at !== null) return closed;
    // A game on rules from before loans could not pay one out: its lives would never hear of it.
    if (!game?.roomStart) return { status: 409, body: { error: 'cannot-loan' } };
    const loan = { id: deps.newId(), room_id: room.id, round: room.round, proposer: userId, lender: lend ? userId : to, borrower: lend ? to : userId, amount: amount as number, rate_bp: rateBp as number, rounds: rounds as number };
    const said = await deps.offerLoan(loan);
    if (said === 'closed') return closed;
    if (said === 'moved') return moved;
    const names = await deps.names([userId]);
    await deps.notify([to], { kind: 'loanOffer', who: names[userId] ?? null, lend, amount: loan.amount, rateBp: loan.rate_bp, rounds: loan.rounds });
    return await answerRoom(games, deps, room.id, userId);
  }

  if (raw.action === 'loanAnswer') {
    const { loanId, yes } = raw;
    if (typeof loanId !== 'string' || !UUID.test(loanId)) return bad('loanId');
    if (typeof yes !== 'boolean') return bad('yes');
    if ((await deps.answerLoan(loanId, userId, yes)) === 'gone') return { status: 409, body: { error: 'gone' } };
    return await answerRoom(games, deps, room.id, userId);
  }

  if (raw.action === 'leave') {
    const left = await deps.leave(room.id, userId);
    if ('error' in left) return closed;
    // Everyone still in the room may have been waiting only for the one who left.
    const now = await deps.loadRoom(room.id);
    if (now !== null) await upkeep(games, deps, now, await deps.members(room.id), userId);
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
    // Those waiting in the lobby may have put the phone down.
    await deps.notify(Object.keys(named).filter((user) => user !== userId), { kind: 'roomStarted', seconds: room.seconds });
    return await answerRoom(games, deps, room.id, userId);
  }

  // The rest is about the member's own life in the room.
  if (me.left_at !== null) return closed;
  if (room.status === 'open') return { status: 409, body: { error: 'not-started' } };
  // The game and its seed at once: they are the same game's.
  const [row, seed] = me.game_id ? await Promise.all([deps.loadGame(me.game_id), deps.loadSeed(me.game_id)]) : [null, null];
  if (row === null || row.status === 'abandoned') return closed;
  const log = game ? readLog(row.log, game, true) : null;
  // A game the server made itself can always be opened. One that cannot is broken, and that is the server's fault.
  if (!game?.viewOf || seed === null || log === null) throw new Error(`room ${room.id}: the life of ${userId} cannot be opened`);
  const viewOf = game.viewOf;
  const player = playerOf(game, room, row.id, seed);
  const { play } = player;
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
      played = player.step(log, next, picked);
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
  // A tease is aimed at another player still in the room, or it is not sent.
  const others = new Set(members.filter((m) => m.left_at === null && m.user_id !== userId).map((m) => m.user_id));
  if (picked.orders.some((order) => isTease(order) && (typeof order.target !== 'string' || !others.has(order.target)))) return bad('orders');
  if (raw.step !== steps) return { status: 409, body: { error: 'out-of-step', step: steps } };
  if (roundsIn(log) !== room.round) return moved;
  const answered = withCardsAnswered(player, log);
  try {
    player.step(answered.log, withStep(answered.log, picked), picked);
  } catch (error) {
    console.error('room orders refused:', error instanceof Error ? error.message : error);
    return { status: 422, body: { error: 'cannot-play' } };
  }
  const kept = await deps.submit(room.id, room.round, userId, picked.orders);
  if (kept.kept === 'other') return { status: 409, body: { error: 'ready' } };
  if (kept.kept === 'moved') return moved;
  if (kept.kept === 'closed') return closed;
  if (!kept.all) {
    if (kept.kept === 'new') await tellTheLastOne(deps, room, game.content.rounds);
    return await answerRoom(games, deps, room.id, userId, { result: null });
  }

  // The last to play turns the round, and is answered their round as a step is.
  const before = room.round;
  const now = await deps.loadRoom(room.id);
  if (now !== null && now.round === before) await turn(games, deps, now, userId);
  const after = await deps.loadGame(row.id);
  const played = after ? readLog(after.log, game, true) : null;
  if (after === null || played === null || roundsIn(played) <= before) return await answerRoom(games, deps, room.id, userId, { result: null });
  const mine = play(played);
  const run = mine.state.finished ? runOf(after, game, mine, deps.now()) : null;
  return await answerRoom(games, deps, room.id, userId, { result: stepAnswer(game, mine, stepsOf(played), before, run) });
}
