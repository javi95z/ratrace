import type { RunRow } from '../../../../supabase/functions/_shared/finish.ts';
import { CURRENT, GAMES } from '../../../../supabase/functions/_shared/game/index.ts';
import type { LoggedRound } from '@ratrace/engine';
import { canonical } from '../../../../supabase/functions/_shared/ranked.ts';
import { rooms } from '../../../../supabase/functions/_shared/rooms.ts';
import type { MemberRow, RoomGameRow, RoomNotice, RoomRow, RoomsDeps, TurnLife } from '../../../../supabase/functions/_shared/rooms.ts';
import type { Reply } from '../../../../supabase/functions/_shared/replay.ts';
import { roomsApi } from '@/online/rooms';
import type { RoomsLink } from '@/session/room';

/** A member as the database keeps them, with the room they are in. */
type Member = MemberRow & { room_id: string };

/**
 * The database of rooms, in memory, with every rule its functions keep in the real one: who may
 * open, join, start, play a card, play a round and turn it, each refused for the same reasons and
 * answering the same words. A test reaches the server's own logic through `ask`, as one player or
 * another, and moves the clock itself.
 */
export function roomServer(start = Date.parse('2026-10-16T10:00:00.000Z')) {
  const roomsById = new Map<string, RoomRow>();
  const members: Member[] = [];
  const games = new Map<string, RoomGameRow>();
  const seeds = new Map<string, string>();
  const orders = new Map<string, unknown[]>();
  const runs: RunRow[] = [];
  /** The notices the server sent, to whom, in order. */
  const notices: Array<{ user: string; about: RoomNotice }> = [];
  const names = new Map<string, string | null>();
  const unlocked = new Map<string, string[]>();
  const state = { ids: 0, codes: 0, stamps: 0, now: start, allowed: true, asked: [] as string[] };
  /** Called with each turn before it is written: a test may change the database there, as another call would have. */
  const hooks: { beforeTurn: ((room: string, round: number) => void) | null; invalidTurns: number; brokenTurns: number } = { beforeTurn: null, invalidTurns: 0, brokenTurns: 0 };
  const stamp = () => `2026-10-16T10:00:00.${String((state.stamps += 1)).padStart(6, '0')}+00:00`;
  const nowIso = () => new Date(state.now).toISOString();
  const active = (room: string) => members.filter((m) => m.room_id === room && m.left_at === null);
  const activeRoomOf = (user: string) =>
    members
      .filter((m) => m.user_id === user && m.left_at === null && ['open', 'playing'].includes(roomsById.get(m.room_id)?.status ?? ''))
      .sort((a, b) => b.joined_at.localeCompare(a.joined_at))[0]?.room_id ?? null;
  const memberOf = (room: string, user: string) => members.find((m) => m.room_id === room && m.user_id === user) ?? null;
  const orderKey = (room: string, user: string, round: number) => `${room}/${user}/${round}`;
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  const deps: RoomsDeps = {
    current: CURRENT,
    allow: async (user, kind) => {
      state.asked.push(`${user}:${kind}`);
      return state.allowed;
    },
    newId: () => `00000000-0000-4000-8000-${String((state.ids += 1)).padStart(12, '0')}`,
    newSeed: () => (state.ids += 1).toString(16).padStart(2, '0').repeat(32),
    now: () => new Date(state.now),
    unlockedLives: async (user) => unlocked.get(user) ?? [],
    myRoom: async (user) =>
      members
        .filter((m) => m.user_id === user && m.left_at === null && ['open', 'playing', 'finished'].includes(roomsById.get(m.room_id)?.status ?? ''))
        .sort((a, b) => b.joined_at.localeCompare(a.joined_at))[0]?.room_id ?? null,
    loadRoom: async (id) => structuredClone(roomsById.get(id) ?? null),
    members: async (room) =>
      structuredClone(members.filter((m) => m.room_id === room).sort((a, b) => a.joined_at.localeCompare(b.joined_at))).map((m): MemberRow => ({
        user_id: m.user_id, game_id: m.game_id, ready_round: m.ready_round, left_at: m.left_at, standing: m.standing, joined_at: m.joined_at,
      })),
    names: async (ids) => Object.fromEntries(ids.map((id) => [id, names.get(id) ?? null])),
    open: async (row) => {
      const other = activeRoomOf(row.host);
      if (other) return { error: 'in-a-room', room: other };
      let code = '';
      for (let n = (state.codes += 1); code.length < 6; n = Math.floor(n / 31)) code += ALPHABET[n % 31];
      roomsById.set(row.id, { ...row, code, status: 'open', round: 0, deadline: null, created_at: nowIso() });
      members.push({ room_id: row.id, user_id: row.host, game_id: null, ready_round: null, left_at: null, standing: null, joined_at: `${nowIso()}#${state.stamps++}` });
      return { room: row.id, code };
    },
    join: async (code, user, engine, content) => {
      const typed = code.replace(/\s/g, '').toUpperCase();
      const room = [...roomsById.values()].find((r) => r.code === typed && (r.status === 'open' || r.status === 'playing'));
      if (!room) return { error: 'unknown-room' };
      const was = memberOf(room.id, user);
      if (was && was.left_at === null) return { room: room.id };
      if (room.status !== 'open') return { error: 'started' };
      if (room.engine_version !== engine || room.content_version !== content) return { error: 'other-version', engineVersion: room.engine_version, contentVersion: room.content_version };
      const other = activeRoomOf(user);
      if (other) return { error: 'in-a-room', room: other };
      if (active(room.id).length >= 6) return { error: 'full' };
      if (was) Object.assign(was, { left_at: null, joined_at: `${nowIso()}#${state.stamps++}` });
      else members.push({ room_id: room.id, user_id: user, game_id: null, ready_round: null, left_at: null, standing: null, joined_at: `${nowIso()}#${state.stamps++}` });
      return { room: room.id };
    },
    start: async (roomId, host, seed, named, deadline) => {
      const room = roomsById.get(roomId);
      if (!room || room.status !== 'open') return { error: 'started' };
      if (room.host !== host) return { error: 'not-host' };
      const here = active(roomId);
      if (here.length < 2) return { error: 'alone' };
      if (Object.keys(named).length !== here.length || here.some((m) => !Object.hasOwn(named, m.user_id))) return { error: 'moved' };
      for (const m of here) {
        const id = named[m.user_id];
        games.set(id, { id, user_id: m.user_id, mode: 'room', life_id: room.life_id, engine_version: room.engine_version, content_version: room.content_version, room: roomId, status: 'playing', round: 0, log: [], updated_at: stamp() });
        seeds.set(id, seed);
        Object.assign(m, { game_id: id, ready_round: null });
      }
      Object.assign(room, { status: 'playing', round: 0, deadline: deadline.toISOString() });
      return { ok: true };
    },
    leave: async (roomId, user) => {
      const room = roomsById.get(roomId);
      const m = memberOf(roomId, user);
      if (!room || !m || m.left_at !== null) return { error: 'not-in-room' };
      m.left_at = nowIso();
      if (room.status === 'open' && room.host === user) {
        room.status = 'closed';
        for (const other of active(roomId)) other.left_at = nowIso();
        return { status: 'closed' };
      }
      if (room.status === 'playing') {
        const game = m.game_id ? games.get(m.game_id) : undefined;
        if (game && game.status === 'playing') Object.assign(game, { status: 'abandoned', updated_at: stamp() });
        if (active(roomId).length === 0) {
          Object.assign(room, { status: 'closed', deadline: null });
          return { status: 'closed' };
        }
      }
      return { status: room.status };
    },
    closeIfStale: async (roomId, now) => {
      const room = roomsById.get(roomId);
      const day = 86_400_000;
      if (!room) return false;
      const stale = (room.status === 'open' && Date.parse(room.created_at) < now.getTime() - day) || (room.status === 'playing' && room.deadline !== null && Date.parse(room.deadline) < now.getTime() - day);
      if (!stale) return false;
      Object.assign(room, { status: 'closed', deadline: null });
      for (const game of games.values()) if (game.room === roomId && game.status === 'playing') Object.assign(game, { status: 'abandoned', updated_at: stamp() });
      return true;
    },
    loadGame: async (id) => structuredClone(games.get(id) ?? null),
    loadSeed: async (id) => seeds.get(id) ?? null,
    loadOrders: async (room, round) => {
      const found: Record<string, unknown[]> = {};
      for (const m of members) if (m.room_id === room && orders.has(orderKey(room, m.user_id, round))) found[m.user_id] = structuredClone(orders.get(orderKey(room, m.user_id, round)) as unknown[]);
      return found;
    },
    step: async (roomId, round, user, gameId, asRead, log, gameRound) => {
      const room = roomsById.get(roomId);
      if (!room || room.status !== 'playing') return 'closed';
      if (room.round !== round) return 'moved';
      const m = memberOf(roomId, user);
      if (!m || m.left_at !== null || m.game_id !== gameId) return 'closed';
      if (m.ready_round === round) return 'ready';
      const game = games.get(gameId);
      if (!game || game.user_id !== user || game.updated_at !== asRead || game.status !== 'playing') return 'moved';
      Object.assign(game, { log: structuredClone(log), round: gameRound, updated_at: stamp() });
      return 'ok';
    },
    submit: async (roomId, round, user, chosen) => {
      const room = roomsById.get(roomId);
      if (!room || room.status !== 'playing') return { kept: 'closed', all: false };
      if (room.round !== round) return { kept: 'moved', all: false };
      const m = memberOf(roomId, user);
      if (!m || m.left_at !== null) return { kept: 'closed', all: false };
      const key = orderKey(roomId, user, round);
      let kept: 'new' | 'same' = 'new';
      if (orders.has(key)) {
        if (canonical(orders.get(key)) !== canonical(chosen)) return { kept: 'other', all: false };
        kept = 'same';
      } else orders.set(key, structuredClone(chosen));
      m.ready_round = round;
      return { kept, all: active(roomId).every((one) => one.ready_round === round) };
    },
    turn: async (roomId, round, deadline, lives: TurnLife[]) => {
      hooks.beforeTurn?.(roomId, round);
      if (hooks.brokenTurns > 0) {
        hooks.brokenTurns -= 1;
        throw new Error('the database is not answering');
      }
      if (hooks.invalidTurns > 0) {
        hooks.invalidTurns -= 1;
        return 'invalid';
      }
      const room = roomsById.get(roomId);
      if (!room || room.status !== 'playing') return 'closed';
      const here = active(roomId);
      if (room.round !== round || here.length !== lives.length) return 'moved';
      // All of it or none of it: every life is checked before anything is written.
      for (const life of lives) {
        const game = games.get(life.game);
        const m = memberOf(roomId, life.user);
        if (!game || game.user_id !== life.user || game.updated_at !== life.as_read || game.status !== 'playing' || game.room !== roomId) return 'moved';
        if (!m || m.left_at !== null || m.game_id !== life.game) return 'moved';
        // Worked out with the member's orders, or with none: they must still be ready, or still not.
        if ((m.ready_round === round) !== (life.ready === true)) return 'moved';
        // A log its game cannot hold, as the table's own check refuses it.
        if (JSON.stringify(life.log).length > 131_072) return 'invalid';
      }
      for (const life of lives) {
        Object.assign(games.get(life.game) as RoomGameRow, { log: structuredClone(life.log), round: life.round, status: life.finished ? 'finished' : 'playing', updated_at: stamp() });
        (memberOf(roomId, life.user) as Member).standing = structuredClone(life.standing);
      }
      if (deadline === null) Object.assign(room, { status: 'finished', round: round + 1, deadline: null });
      else Object.assign(room, { round: round + 1, deadline: deadline.toISOString() });
      return 'ok';
    },
    saveRun: async (run) => {
      if (!runs.some((one) => one.id === run.id)) runs.push(structuredClone(run));
    },
    notify: async (users, about) => {
      for (const user of users) notices.push({ user, about: structuredClone(about) });
    },
  };

  /** The pages listening to each room, and the network between page and server, which a test may cut. */
  const listeners = new Map<string, Set<() => void>>();
  const network = { down: false };
  /** What a page could hear about: the rooms and who is in them. */
  const snapshot = () => JSON.stringify([[...roomsById.values()], members]);
  /** Asks the server as `user`. What it changed is told, once the answer is back, to every page listening, as Realtime tells it. */
  const ask = async (user: string, body: Record<string, unknown>): Promise<Reply> => {
    const before = snapshot();
    const reply = await rooms(GAMES, deps, user, body);
    if (snapshot() !== before) {
      queueMicrotask(() => {
        for (const set of listeners.values()) for (const listener of [...set]) listener();
      });
    }
    return reply;
  };

  return {
    deps,
    state,
    hooks,
    network,
    db: { rooms: roomsById, members, games, seeds, orders, runs, names, unlocked },
    notices,
    /** Asks the server as `user`, with nothing between. */
    ask,
    /**
     * The rooms as a page signed in as `user` reaches them: the game's own mapping of the server's
     * answers, a trip through JSON as over the network, and the changes of a room told to whoever
     * listens to it, as Realtime tells them, once the answer is back.
     */
    link: (user: string): RoomsLink => ({
      api: roomsApi(async (body) => {
        if (network.down) throw new TypeError('Failed to fetch');
        const reply = await ask(user, JSON.parse(JSON.stringify(body)) as Record<string, unknown>);
        return JSON.parse(JSON.stringify(reply)) as Reply;
      }),
      watch: (roomId, onChange) => {
        const set = listeners.get(roomId) ?? new Set<() => void>();
        set.add(onChange);
        listeners.set(roomId, set);
        return () => void set.delete(onChange);
      },
    }),
    /** Moves the server's clock on. */
    wait: (ms: number) => {
      state.now += ms;
    },
    /** A member's log as the database holds it, as the engine reads a log. */
    logOf: (user: string, room: string): LoggedRound[] => {
      const id = memberOf(room, user)?.game_id;
      return id ? (structuredClone(games.get(id)?.log) as LoggedRound[]) : [];
    },
  };
}
