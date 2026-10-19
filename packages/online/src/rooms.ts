import { Unreachable } from '@ratrace/core/session/errors';
import type { RankedRun, RankedStep } from '@ratrace/core/session/ranked';
import { RoomRefused, SHOUT_FACES, SHOUT_PHRASES } from '@ratrace/core/session/room';
import { upToDateView } from '@ratrace/core/session/upgrade';
import type { RoomGameOver, RoomLife, RoomLoan, RoomMember, RoomsApi, RoomState } from '@ratrace/core/session/room';

/**
 * Asks the `rooms` function one thing and hands back its answer: the status and the body. It
 * throws when no answer came at all. The real one is in `connect.ts`; a test hands in the
 * function's own logic, with no network between.
 */
export type RoomsCall = (body: Record<string, unknown>) => Promise<{ status: number; body: unknown }>;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const STATUSES = new Set(['open', 'playing', 'finished', 'closed']);

/** A shout as the server tells of it, or null if it is not one the page knows. */
function shoutOf(raw: unknown): { n: number; at: number } | null {
  if (!isRecord(raw) || !Number.isInteger(raw.n) || typeof raw.at !== 'string') return null;
  const n = raw.n as number;
  const at = Date.parse(raw.at);
  return n >= 0 && n < SHOUT_FACES.length + SHOUT_PHRASES && !Number.isNaN(at) ? { n, at } : null;
}

/** A member as the server tells of them, or null if it is not one. */
function memberOf(raw: unknown): RoomMember | null {
  if (!isRecord(raw) || typeof raw.userId !== 'string') return null;
  const standing = isRecord(raw.standing) ? raw.standing : null;
  return {
    userId: raw.userId,
    name: typeof raw.name === 'string' ? raw.name : null,
    me: raw.me === true,
    host: raw.host === true,
    bot: typeof raw.bot === 'string' ? raw.bot : null,
    followed: raw.followed === true,
    ready: raw.ready === true,
    left: raw.left === true,
    standing:
      standing === null
        ? null
        : {
            score: Number(standing.score) || 0,
            netWorth: Number(standing.netWorth) || 0,
            status: Number(standing.status) || 0,
            escaped: standing.escaped === true,
            bankruptcies: Number(standing.bankruptcies) || 0,
            before:
              isRecord(standing.before) && typeof standing.before.score === 'number' && typeof standing.before.place === 'number'
                ? { score: standing.before.score, place: standing.before.place }
                : null,
            cityId: typeof standing.cityId === 'string' ? standing.cityId : null,
            career:
              isRecord(standing.career) && typeof standing.career.id === 'string' && typeof standing.career.level === 'number'
                ? { id: standing.career.id, level: standing.career.level }
                : null,
          },
    shout: shoutOf(raw.shout),
    avatar: typeof raw.avatar === 'string' && raw.avatar.startsWith('rat_') ? raw.avatar : null,
  };
}

/** A room as the server tells of it, with its clocks in milliseconds, or null if it is not one. */
export function roomOf(raw: unknown): RoomState | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.code !== 'string' || typeof raw.status !== 'string' || !STATUSES.has(raw.status)) return null;
  if (typeof raw.round !== 'number' || typeof raw.seconds !== 'number' || !Array.isArray(raw.members) || typeof raw.now !== 'string') return null;
  const members = raw.members.map(memberOf);
  if (members.some((member) => member === null)) return null;
  const now = Date.parse(raw.now);
  const deadline = typeof raw.deadline === 'string' ? Date.parse(raw.deadline) : null;
  const startsAt = typeof raw.startsAt === 'string' ? Date.parse(raw.startsAt) : null;
  if (Number.isNaN(now) || (deadline !== null && Number.isNaN(deadline)) || (startsAt !== null && Number.isNaN(startsAt))) return null;
  return {
    id: raw.id,
    code: raw.code,
    // No host once the host's account is gone.
    host: typeof raw.host === 'string' ? raw.host : '',
    lifeId: String(raw.lifeId),
    engineVersion: String(raw.engineVersion),
    contentVersion: String(raw.contentVersion),
    seconds: raw.seconds,
    status: raw.status as RoomState['status'],
    round: raw.round,
    rounds: typeof raw.rounds === 'number' ? raw.rounds : 0,
    deadline,
    now,
    members: members as RoomMember[],
    rematch: isRecord(raw.rematch) && typeof raw.rematch.code === 'string' ? { code: raw.rematch.code, open: raw.rematch.open === true } : null,
    rematchOf: raw.rematchOf === true,
    public: raw.public === true,
    startsAt,
    loans: Array.isArray(raw.loans) ? raw.loans.map(loanOf).filter((loan): loan is RoomLoan => loan !== null) : [],
  };
}

const LOAN_STATUSES = new Set<string>(['open', 'accepted', 'refused', 'paid', 'failed', 'expired']);
/** A loan as the server tells of it, or null if it is not one. */
function loanOf(raw: unknown): RoomLoan | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.other !== 'string' || typeof raw.status !== 'string' || !LOAN_STATUSES.has(raw.status)) return null;
  const whole = (x: unknown) => (typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? x : null);
  const [round, amount, rateBp, rounds] = [whole(raw.round), whole(raw.amount), whole(raw.rateBp), whole(raw.rounds)];
  if (round === null || amount === null || rateBp === null || rounds === null) return null;
  return { id: raw.id, round, lend: raw.lend === true, other: raw.other, mine: raw.mine === true, amount, rateBp, rounds, status: raw.status as RoomLoan['status'] };
}

/** A game over as the server tells of it, or null if it is not one. */
function gameOverOf(raw: unknown): RoomGameOver | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.lifeId !== 'string' || !Array.isArray(raw.players)) return null;
  const playedAt = typeof raw.playedAt === 'string' ? Date.parse(raw.playedAt) : Number.NaN;
  if (Number.isNaN(playedAt)) return null;
  return {
    id: raw.id,
    lifeId: raw.lifeId,
    seconds: Number(raw.seconds) || 0,
    playedAt,
    rematchOf: raw.rematchOf === true,
    public: raw.public === true,
    gameId: typeof raw.gameId === 'string' ? raw.gameId : null,
    players: raw.players.filter(isRecord).map((p) => ({
      name: typeof p.name === 'string' ? p.name : null,
      tag: typeof p.tag === 'string' ? p.tag : '',
      bot: typeof p.bot === 'string' ? p.bot : null,
      me: p.me === true,
      score: typeof p.score === 'number' ? p.score : null,
      left: p.left === true,
      netWorth: typeof p.netWorth === 'number' ? p.netWorth : null,
      cityId: typeof p.cityId === 'string' ? p.cityId : null,
      career: isRecord(p.career) && typeof p.career.id === 'string' && typeof p.career.level === 'number' ? { id: p.career.id, level: p.career.level } : null,
    })),
  };
}

interface RunRow {
  id: string;
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
  finished_at: string;
}
const runOf = (raw: unknown): RankedRun | null => {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const row = raw as unknown as RunRow;
  return {
    id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, score: row.score, netWorth: row.net_worth, status: row.status,
    escapedAtRound: row.escaped_at_round, bankruptcies: row.bankruptcies, badges: row.badges ?? [], cities: row.cities ?? [], history: (row.history ?? []).map(Number), finishedAt: row.finished_at,
    challenge: null,
  };
};

/** A step's answer, or null if it is not one. */
function stepOf(raw: unknown): RankedStep | null {
  if (!isRecord(raw) || typeof raw.step !== 'number' || !isRecord(raw.view) || !isRecord(raw.record) || !Array.isArray(raw.events)) return null;
  return { ...(raw as unknown as RankedStep), view: upToDateView(raw.view) as unknown as RankedStep['view'], world: isRecord(raw.world) ? (raw.world as unknown as RankedStep['world']) : null, run: runOf(raw.run) };
}

/**
 * The server of rooms, as the page asks for it. What the function answers in numbers and words
 * becomes one of a few things here: the answer; "the room or the life is not where you think";
 * `RoomRefused`, for a no of the server's own; or `Unreachable`, for everything worth asking again
 * later: no network, a server that is busy or away, a limit reached.
 */
export function roomsApi(call: RoomsCall): RoomsApi {
  const ask = async (body: Record<string, unknown>): Promise<{ status: number; body: unknown }> => {
    let reply;
    try {
      reply = await call(body);
    } catch (error) {
      throw new Unreachable(error instanceof Error ? error.message : undefined);
    }
    if (reply.status === 429 || reply.status >= 500 || reply.status === 401) throw new Unreachable(`the server answered ${reply.status}`);
    return reply;
  };
  const wordOf = (body: unknown): string => (isRecord(body) && typeof body.error === 'string' ? body.error : 'refused');
  /** The room an answer brings, or the refusal it is. */
  const room = (reply: { status: number; body: unknown }): RoomState => {
    if (reply.status === 200) {
      const found = isRecord(reply.body) ? roomOf(reply.body.room) : null;
      if (found === null) throw new Unreachable('the server answered something that is not a room');
      return found;
    }
    const roomId = isRecord(reply.body) && typeof reply.body.roomId === 'string' ? reply.body.roomId : null;
    throw new RoomRefused(wordOf(reply.body), roomId);
  };

  return {
    async mine() {
      const reply = await ask({ action: 'mine' });
      if (reply.status !== 200 || !isRecord(reply.body)) throw new Unreachable(`the server answered ${reply.status}`);
      return reply.body.room === null ? null : room(reply);
    },
    open: async (lifeId, seconds, versions) => room(await ask({ action: 'open', lifeId, seconds, engineVersion: versions.engine, contentVersion: versions.content })),
    quick: async (versions, pace = 'live') => room(await ask({ action: 'quick', pace, engineVersion: versions.engine, contentVersion: versions.content })),
    async lobbies(versions) {
      const reply = await ask({ action: 'lobbies', engineVersion: versions.engine, contentVersion: versions.content });
      const body = isRecord(reply.body) ? reply.body : {};
      const count = (x: unknown) => (typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 ? x : null);
      const [live, slow] = [count(body.open), count(body.slow)];
      if (reply.status !== 200 || live === null) throw new Unreachable(`the server answered ${reply.status}`);
      return { live, slow: slow ?? 0, dropped: body.dropped === true };
    },
    async report(roomId, userId) {
      const reply = await ask({ action: 'report', roomId, userId });
      if (reply.status === 404 || reply.status === 409 || reply.status === 400) return 'gone';
      const said = isRecord(reply.body) ? reply.body.report : null;
      return { room: room(reply), report: said === 'cleared' || said === 'nameless' ? said : 'ok' };
    },
    async follow(roomId, userId) {
      const reply = await ask({ action: 'follow', roomId, userId });
      if (reply.status === 409 && isRecord(reply.body) && reply.body.error === 'full') return 'full';
      if (reply.status === 404 || reply.status === 409 || reply.status === 400) return 'gone';
      return room(reply);
    },
    join: async (code, versions) => room(await ask({ action: 'join', code, engineVersion: versions.engine, contentVersion: versions.content })),
    start: async (roomId) => room(await ask({ action: 'start', roomId })),
    async leave(roomId) {
      const reply = await ask({ action: 'leave', roomId });
      // No longer in it: there is nothing to leave.
      if (reply.status === 404 || reply.status === 409) return null;
      return room(reply);
    },
    async state(roomId) {
      const reply = await ask({ action: 'state', roomId });
      if (reply.status === 404) return 'gone';
      return room(reply);
    },
    async view(roomId) {
      const reply = await ask({ action: 'view', roomId });
      if (reply.status === 404 || reply.status === 409) return 'gone';
      const body = reply.body;
      if (reply.status !== 200 || !isRecord(body) || typeof body.step !== 'number' || !isRecord(body.view) || !Array.isArray(body.view.timeline) || !isRecord(body.record) || typeof body.gameId !== 'string') {
        throw new Unreachable(`the server answered ${reply.status}`);
      }
      const life: RoomLife = {
        gameId: body.gameId,
        lifeId: String(body.lifeId),
        ...(typeof body.engineVersion === 'string' ? { engineVersion: body.engineVersion } : {}),
        step: body.step,
        view: upToDateView(body.view) as unknown as RoomLife['view'],
        record: body.record as unknown as RoomLife['record'],
        events: Array.isArray(body.events) ? (body.events as RoomLife['events']) : [],
        run: runOf(body.run),
      };
      return life;
    },
    async card(roomId, at, option) {
      const reply = await ask({ action: 'card', roomId, step: at, option });
      if (reply.status !== 200) return 'moved';
      const step = stepOf(reply.body);
      if (step === null) throw new Unreachable('the server answered something that is not a step');
      return step;
    },
    rematch: async (roomId, lifeId, versions) => room(await ask({ action: 'rematch', roomId, lifeId, engineVersion: versions.engine, contentVersion: versions.content })),
    async shout(roomId, shout) {
      const reply = await ask({ action: 'shout', roomId, shout });
      if (reply.status === 409 && isRecord(reply.body) && reply.body.error === 'soon') return 'soon';
      if (reply.status === 404 || reply.status === 409) return 'gone';
      return room(reply);
    },
    async offerLoan(roomId, loan) {
      const reply = await ask({ action: 'loan', roomId, ...loan });
      if (reply.status === 404 || reply.status === 409) return 'gone';
      return room(reply);
    },
    async answerLoan(roomId, loanId, yes) {
      const reply = await ask({ action: 'loanAnswer', roomId, loanId, yes });
      if (reply.status === 404 || reply.status === 409) return 'gone';
      return room(reply);
    },
    async history() {
      const reply = await ask({ action: 'history' });
      if (reply.status !== 200 || !isRecord(reply.body) || !Array.isArray(reply.body.games)) throw new Unreachable(`the server answered ${reply.status}`);
      return reply.body.games.map(gameOverOf).filter((game): game is RoomGameOver => game !== null);
    },
    async submit(roomId, at, orders) {
      const reply = await ask({ action: 'submit', roomId, step: at, orders });
      if (reply.status !== 200) return 'moved';
      const found = isRecord(reply.body) ? roomOf(reply.body.room) : null;
      if (found === null || !isRecord(reply.body)) throw new Unreachable('the server answered something that is not a room');
      const result = reply.body.result === null || reply.body.result === undefined ? null : stepOf(reply.body.result);
      return { room: found, result };
    },
  };
}

export { upToDateView };
