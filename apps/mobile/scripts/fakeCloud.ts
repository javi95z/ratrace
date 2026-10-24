import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { friends as friendsFunction } from '../../../supabase/functions/_shared/friends.ts';
import type { FriendRow, FriendsDeps } from '../../../supabase/functions/_shared/friends.ts';
import { rankedServer } from '../../web/src/testing/rankedServer.ts';
import { roomServer } from '../../web/src/testing/roomServer.ts';

/**
 * The game's project as the phone reaches it over the network, on this machine, for the device checks and the timing of the online screens on the
 * simulator: never the live project. A build or Metro started with `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:<port>` (and any publishable key)
 * signs in here, through the real client (`@ratrace/online/connect`) and nothing made for it: the app is the one that ships.
 *
 *   pnpm --filter @ratrace/mobile exec tsx scripts/fakeCloud.ts [--port=54399] [--friends=200,50,50]
 *
 * What it answers, in memory, for as long as it runs:
 * - **Auth**: guests (`/auth/v1/signup`), sessions renewed (`/token?grant_type=refresh_token`), signing out; and Google through a page of its own
 *   (`/auth/v1/authorize`, `/auth/v1/user/identities/authorize`): the page offers what Google could say (kept, the account already a player's,
 *   refused), and sends the browser back to the app's address with a code, exchanged against the trip's PKCE verifier (`grant_type=pkce`).
 * - **The tables** the client reads and writes (profiles, games, player_progress, runs, challenge_entries, push_subscriptions), and the RPCs
 *   (ranking, challenge_ranking, challenge_choices, claim_push_token), each row the caller's own where the database keeps it so.
 * - **The functions**: `rooms` and `ranked`, the web's in-memory servers (the edge functions' own code), `friends` the function's own code over
 *   friends kept here, and `track`, `report-error`, `finish-run` taken and kept.
 * - **Realtime**: a WebSocket that speaks Phoenix (vsn 2.0.0) as Supabase's does, telling a room's channel when its room or its players change.
 * - **The checker's own door** (`/control/*`): another player asks the rooms server as themselves (`/control/rooms`), the state is read
 *   (`/control/state`), the friends of the next guest are set (`/control/friends`), and the finished lives the account was sent are forgotten
 *   (`/control/unsent`).
 */

import { FAKE_CLOUD_PORT, FAKE_KEY } from './fakeProject';

// Named apart (`fakeProject.ts`), for what names the fake project without loading it.
export { FAKE_CLOUD_PORT, FAKE_KEY };

interface User {
  id: string;
  is_anonymous: boolean;
  email?: string;
}

/** A trip to Google, from its address to the code the browser comes back with. */
interface Trip {
  kind: 'link' | 'signin';
  /** Who asked, for a link. */
  user: string | null;
  redirectTo: string;
  challenge: string;
}

type Row = Record<string, unknown>;

const b64url = (data: Buffer | string) => Buffer.from(data).toString('base64url');

/** A token as the project signs one, for the client to read who and until when. Never checked here: this is not a server anyone else reaches. */
export function tokenOf(user: User, ttl = 3600): string {
  const part = (value: object) => b64url(JSON.stringify(value));
  const now = Math.floor(Date.now() / 1000);
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: user.id, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + ttl, is_anonymous: user.is_anonymous, email: user.email ?? '' })}.fake`;
}

/** Who a request's token names, or null. */
function callerOf(request: IncomingMessage): string | null {
  const auth = request.headers.authorization ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: unknown; role?: unknown };
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

const FRIEND_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const uuid = (prefix: string, n: number) => `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Reads a request's body as text. */
function bodyOf(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

/** A PostgREST filter, `col=op.value`, as a test on a row. */
function filterOf(column: string, raw: string): (row: Row) => boolean {
  const dot = raw.indexOf('.');
  const op = raw.slice(0, dot);
  const value = raw.slice(dot + 1);
  const as = (cell: unknown) => (typeof cell === 'number' ? Number(value) : value);
  switch (op) {
    case 'eq':
      return (row) => String(row[column]) === value;
    case 'neq':
      return (row) => String(row[column]) !== value;
    case 'gte':
      return (row) => (row[column] as number | string) >= as(row[column]);
    case 'gt':
      return (row) => (row[column] as number | string) > as(row[column]);
    case 'lte':
      return (row) => (row[column] as number | string) <= as(row[column]);
    case 'lt':
      return (row) => (row[column] as number | string) < as(row[column]);
    case 'is':
      return (row) => (value === 'null' ? row[column] === null || row[column] === undefined : String(row[column]) === value);
    case 'in': {
      const list = value.replace(/^\(|\)$/g, '').split(',');
      return (row) => list.includes(String(row[column]));
    }
    default:
      // A filter the fake does not know would match every row, and a check pass on rows the database would have left out: refused by name instead.
      throw new Error(`the fake project does not know the filter "${op}" (${column}=${raw})`);
  }
}

/** The tables, and which column names the row's owner (a player reads and writes their own and nobody else's). */
const OWNED: Record<string, string | null> = {
  profiles: 'user_id',
  games: 'user_id',
  player_progress: 'user_id',
  runs: null,
  challenge_entries: 'user_id',
  push_subscriptions: 'user_id',
};
const KEYS: Record<string, string> = { profiles: 'user_id', games: 'id', player_progress: 'user_id', runs: 'id', challenge_entries: 'id', push_subscriptions: 'endpoint' };

/** One WebSocket connection, text frames only, as Realtime uses them. */
interface Socket {
  send(text: string): void;
  close(): void;
}

/** Accepts a WebSocket on `socket` and hands its text messages to `heard`; `accepted` keeps every socket upgraded, for `close` to end them all. */
function acceptSocket(request: IncomingMessage, socket: Duplex, heard: (text: string, me: Socket) => void, gone: (me: Socket) => void, accepted: Set<Duplex>): void {
  const key = request.headers['sec-websocket-key'];
  if (typeof key !== 'string') return void socket.destroy();
  accepted.add(socket);
  socket.on('close', () => accepted.delete(socket));
  const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const frame = (opcode: number, payload: Buffer) => {
    const length = payload.length;
    const head = length < 126 ? Buffer.from([0x80 | opcode, length]) : length < 65536 ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 255]) : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(length)); return b; })()]);
    if (!socket.destroyed) socket.write(Buffer.concat([head, payload]));
  };
  let open = true;
  const me: Socket = {
    send: (text) => frame(1, Buffer.from(text)),
    close: () => {
      if (!open) return;
      open = false;
      frame(8, Buffer.alloc(0));
      socket.end();
    },
  };
  let buffer = Buffer.alloc(0);
  let pieces: Buffer[] = [];
  socket.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f;
      let at = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        at = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        at = 10;
      }
      const mask = masked ? buffer.subarray(at, at + 4) : null;
      if (masked) at += 4;
      if (buffer.length < at + length) return;
      const payload = Buffer.from(buffer.subarray(at, at + length));
      buffer = buffer.subarray(at + length);
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      if (opcode === 8) {
        me.close();
        return;
      }
      if (opcode === 9) {
        frame(10, payload);
        continue;
      }
      if (opcode === 1 || opcode === 0) {
        pieces.push(payload);
        if (fin) {
          const text = Buffer.concat(pieces).toString();
          pieces = [];
          heard(text, me);
        }
      }
    }
  });
  const end = () => {
    open = false;
    gone(me);
  };
  socket.on('close', end);
  socket.on('error', end);
}

export interface FakeCloudOptions {
  /** The friends each new guest is given: friends, requests to them, requests they sent. */
  friends?: { friends: number; incoming: number; outgoing: number };
  /** Told each line of what it was asked, for the log. */
  log?: (line: string) => void;
}

/** The project, in memory: `listen` it on this machine. */
export function fakeCloud(options: FakeCloudOptions = {}) {
  const log = options.log ?? (() => undefined);
  const users = new Map<string, User>();
  const refresh = new Map<string, string>();
  const trips = new Map<string, Trip>();
  const codes = new Map<string, { trip: Trip; member: string }>();
  const tables: Record<string, Row[]> = { profiles: [], games: [], player_progress: [], runs: [], challenge_entries: [], push_subscriptions: [] };
  const rooms = roomServer(Date.now());
  const rankedByUser = new Map<string, ReturnType<typeof rankedServer>>();
  const rankedOf = (user: string) => {
    let one = rankedByUser.get(user);
    if (!one) rankedByUser.set(user, (one = rankedServer(user)));
    return one;
  };
  const friendships: Array<{ follower: string; followed: string; at: number }> = [];
  const requests: Array<{ from: string; to: string; at: number }> = [];
  const asked: string[] = [];
  let made = 0;
  let friendsOfNext = options.friends ?? null;
  const counts = { guests: 0, tracked: 0, reported: 0 };
  /** What the checker has the database refuse, as the real one may (a save of the rat that fails: `portrait`). */
  const failing = { portrait: false, delayMs: 0 };

  /** Google's account, a player already: a member with a name, the account `taken` is said of. */
  const MEMBER: User = { id: uuid('a0000000', 1), is_anonymous: false, email: 'ana.garcia@example.com' };
  users.set(MEMBER.id, MEMBER);

  const newCode = () => Array.from(randomBytes(8), (byte) => FRIEND_ALPHABET[byte % FRIEND_ALPHABET.length]).join('');
  const profileOf = (user: string) => tables.profiles.find((row) => row.user_id === user) ?? null;
  const makeProfile = (user: string, nickname: string | null = null, language: string | null = null) => {
    if (profileOf(user)) return;
    tables.profiles.push({ user_id: user, nickname, friend_code: newCode(), portrait: null, language, market_moved: false });
    rooms.db.names.set(user, nickname);
  };
  makeProfile(MEMBER.id, 'Ana_G', 'en');

  /** Other players, for the rankings and the friends: named, with no portrait (their rat is drawn from their id). */
  const OTHERS = Array.from({ length: 400 }, (_, i) => uuid('b1000000', i + 1));
  OTHERS.forEach((id, i) => {
    users.set(id, { id, is_anonymous: false });
    makeProfile(id, `Rat_${String(i + 1).padStart(3, '0')}`, 'en');
  });
  /** A second player to play beside the phone in a room: asked for through `/control/rooms`. */
  const MIA: User = { id: uuid('c2000000', 1), is_anonymous: false, email: 'mia@example.com' };
  users.set(MIA.id, MIA);
  makeProfile(MIA.id, 'Mia', 'en');

  const giveFriends = (user: string, counts: { friends: number; incoming: number; outgoing: number }) => {
    let next = 0;
    const take = () => OTHERS[next++ % OTHERS.length];
    for (let i = 0; i < counts.friends; i++) {
      const other = take();
      friendships.push({ follower: user, followed: other, at: i }, { follower: other, followed: user, at: i });
    }
    for (let i = 0; i < counts.incoming; i++) requests.push({ from: take(), to: user, at: i });
    for (let i = 0; i < counts.outgoing; i++) requests.push({ from: user, to: take(), at: i });
  };

  const session = (user: User) => {
    const token = `r-${randomBytes(12).toString('hex')}`;
    refresh.set(token, user.id);
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: tokenOf(user),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: token,
      user: userBody(user),
    };
  };
  const userBody = (user: User) => ({
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email ?? '',
    is_anonymous: user.is_anonymous,
    app_metadata: { provider: user.is_anonymous ? 'anonymous' : 'google', providers: user.is_anonymous ? [] : ['google'] },
    user_metadata: {},
    identities: user.is_anonymous ? [] : [{ id: user.id, user_id: user.id, provider: 'google', identity_data: { email: user.email } }],
    created_at: '2026-10-23T00:00:00Z',
    updated_at: '2026-10-23T00:00:00Z',
  });

  /** What the friends function reads and writes, over the friends kept here. */
  const friendsDeps: FriendsDeps = {
    allow: async () => true,
    requestByCode: async (user, code) => {
      const to = tables.profiles.find((row) => row.friend_code === code.replace(/[\s-]/g, '').toUpperCase())?.user_id as string | undefined;
      if (to === undefined) return { answer: 'unknown', to: null };
      if (to === user) return { answer: 'self', to };
      if (friendships.some((one) => one.follower === user && one.followed === to)) return { answer: 'friends', to };
      if (requests.some((one) => one.from === to && one.to === user)) {
        friendships.push({ follower: user, followed: to, at: Date.now() }, { follower: to, followed: user, at: Date.now() });
        for (let i = requests.length - 1; i >= 0; i--) if ([user, to].includes(requests[i].from) && [user, to].includes(requests[i].to)) requests.splice(i, 1);
        return { answer: 'accepted', to };
      }
      if (requests.some((one) => one.from === user && one.to === to)) return { answer: 'pending', to };
      requests.push({ from: user, to, at: Date.now() });
      return { answer: 'sent', to };
    },
    answer: async (user, from, yes) => {
      const at = requests.findIndex((one) => one.from === from && one.to === user);
      if (at < 0) return 'gone';
      requests.splice(at, 1);
      if (!yes) return 'declined';
      friendships.push({ follower: user, followed: from, at: Date.now() }, { follower: from, followed: user, at: Date.now() });
      return 'accepted';
    },
    remove: async (user, other) => {
      for (let i = friendships.length - 1; i >= 0; i--) if ([user, other].includes(friendships[i].follower) && [user, other].includes(friendships[i].followed)) friendships.splice(i, 1);
      for (let i = requests.length - 1; i >= 0; i--) if ([user, other].includes(requests[i].from) && [user, other].includes(requests[i].to)) requests.splice(i, 1);
    },
    list: async (user) => {
      const row = (id: string): FriendRow => ({ userId: id, nickname: (profileOf(id)?.nickname as string | null) ?? null, avatar: (profileOf(id)?.portrait as string | null) ?? null });
      const latest = <T extends { at: number }>(list: T[]) => [...list].sort((a, b) => b.at - a.at);
      return {
        friends: latest(friendships.filter((one) => one.follower === user)).map((one) => row(one.followed)),
        incoming: latest(requests.filter((one) => one.to === user)).map((one) => row(one.from)),
        outgoing: latest(requests.filter((one) => one.from === user)).map((one) => row(one.to)),
      };
    },
    names: async (ids) => Object.fromEntries(ids.map((id) => [id, (profileOf(id)?.nickname as string | null) ?? null])),
    notify: async () => undefined,
  };

  // --- Realtime: the channels listening to a room, told when its room or its players change.
  interface Joined {
    socket: Socket;
    topic: string;
    joinRef: string | null;
    bindings: Array<{ id: number; table: string; filter?: string }>;
  }
  const joined: Joined[] = [];
  let bindingIds = 0;
  const roomSnapshot = (id: string) => JSON.stringify([rooms.db.rooms.get(id) ?? null, rooms.db.members.filter((m) => m.room_id === id), rooms.db.loans.filter((loan) => (loan as { room_id?: string }).room_id === id)]);
  /** Tells every channel of a room that it changed, as Realtime tells the rows' changes. */
  const told = { realtime: 0 };
  const tellRoom = (id: string) => {
    for (const one of joined) {
      const ids = one.bindings.filter((b) => (b.table === 'rooms' && b.filter === `id=eq.${id}`) || (b.table === 'room_players' && b.filter === `room_id=eq.${id}`)).map((b) => b.id);
      for (const binding of one.bindings.filter((b) => ids.includes(b.id))) {
        told.realtime += 1;
        one.socket.send(JSON.stringify([one.joinRef, null, one.topic, 'postgres_changes', { ids: [binding.id], data: { type: 'UPDATE', schema: 'public', table: binding.table, commit_timestamp: new Date().toISOString(), columns: [], record: {}, old_record: {}, errors: null } }]));
      }
    }
  };
  /** Asks the rooms server as a player, at the time it is now, and tells the rooms it changed. */
  const askRooms = async (user: string, body: Record<string, unknown>) => {
    rooms.state.now = Date.now();
    const before = new Map([...rooms.db.rooms.keys()].map((id) => [id, roomSnapshot(id)]));
    const reply = await rooms.ask(user, body);
    for (const id of rooms.db.rooms.keys()) if (before.get(id) !== roomSnapshot(id)) tellRoom(id);
    return reply;
  };
  /** Rooms whose time comes with no one asking (a public game's start, a round's end): the server's clock looks at them every second. */
  const ticker = setInterval(() => {
    for (const room of rooms.db.rooms.values()) {
      const due = (room.status === 'open' && room.public && room.starts_at !== null && Date.parse(room.starts_at) <= Date.now()) || (room.status === 'playing' && room.deadline !== null && Date.parse(room.deadline) <= Date.now());
      const someone = rooms.db.members.find((m) => m.room_id === room.id && m.left_at === null && !m.user_id.startsWith('b0700000'));
      if (due && someone) void askRooms(someone.user_id, { action: 'state', room: room.id }).catch(() => undefined);
    }
  }, 1000);
  // A fake made and never listened to or closed (a test's) does not hold the process open for its clock.
  ticker.unref();

  const heardRealtime = (text: string, socket: Socket) => {
    let message: unknown;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (!Array.isArray(message)) return;
    const [joinRef, ref, topic, event, payload] = message as [string | null, string | null, string, string, Record<string, unknown>];
    const reply = (response: object, status = 'ok') => socket.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status, response }]));
    if (event === 'heartbeat') return reply({});
    if (event === 'phx_join') {
      const config = (payload.config ?? {}) as { postgres_changes?: Array<{ event: string; schema: string; table: string; filter?: string }> };
      const changes = (config.postgres_changes ?? []).map((one) => ({ ...one, id: (bindingIds += 1) }));
      joined.push({ socket, topic, joinRef, bindings: changes.map((one) => ({ id: one.id, table: one.table, filter: one.filter })) });
      log(`realtime join ${topic} (${changes.length} bindings)`);
      reply({ postgres_changes: changes });
      socket.send(JSON.stringify([joinRef, null, topic, 'system', { extension: 'postgres_changes', status: 'ok', message: 'Subscribed to PostgreSQL', channel: topic.replace(/^realtime:/, '') }]));
      return;
    }
    if (event === 'phx_leave') {
      for (let i = joined.length - 1; i >= 0; i--) if (joined[i].socket === socket && joined[i].topic === topic) joined.splice(i, 1);
      log(`realtime leave ${topic}`);
      return reply({});
    }
    if (event === 'access_token') return;
    reply({});
  };
  const goneRealtime = (socket: Socket) => {
    for (let i = joined.length - 1; i >= 0; i--) if (joined[i].socket === socket) joined.splice(i, 1);
  };

  // --- Google, through a page of this machine.
  const googlePage = (flow: string, trip: Trip) => {
    const choice = (as: string, label: string) => `<p><a class="b" href="/fake-google/choose?flow=${flow}&as=${as}">${label}</a></p>`;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fake Google</title>
<style>body{font-family:-apple-system,sans-serif;padding:24px;background:#fff;color:#202124}h1{font-size:22px}.b{display:block;padding:14px;border:1px solid #dadce0;border-radius:8px;text-decoration:none;color:#1a73e8;font-size:18px}</style></head>
<body><h1>Fake Google (127.0.0.1, not Google)</h1><p>${trip.kind === 'link' ? 'Keep the guest with a Google account' : 'Sign in with Google'}</p>
${choice('linked', 'Continue as a new Google account')}${choice('taken', 'Continue as ana.garcia@example.com (already a player)')}${choice('denied', 'Deny access')}</body></html>`;
  };
  const back = (trip: Trip, query: Record<string, string>) => {
    const url = new URL(trip.redirectTo);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
    return url.toString();
  };

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const method = (request.method ?? 'GET').toUpperCase();
    const caller = callerOf(request);
    asked.push(`${method} ${url.pathname}`);
    log(`${method} ${url.pathname}${url.search.length > 120 ? `${url.search.slice(0, 120)}…` : url.search}${caller ? ` as ${caller.slice(0, 8)}` : ''}`);
    const send = (status: number, body?: unknown, headers: Record<string, string> = {}) => {
      response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
      response.end(body === undefined ? '' : JSON.stringify(body));
    };
    if (method === 'OPTIONS') return send(204, undefined, { 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
    const text = method === 'GET' || method === 'HEAD' ? '' : await bodyOf(request);
    const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;

    // Auth.
    if (url.pathname === '/auth/v1/signup' && method === 'POST') {
      const user: User = { id: uuid('d0000000', ++made), is_anonymous: true };
      users.set(user.id, user);
      counts.guests += 1;
      if (friendsOfNext) giveFriends(user.id, friendsOfNext);
      return send(200, session(user));
    }
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'refresh_token') {
        const id = refresh.get(String(body.refresh_token));
        const user = id ? users.get(id) : undefined;
        if (!user) return send(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
        return send(200, session(user));
      }
      if (grant === 'pkce') {
        const held = codes.get(String(body.auth_code));
        if (!held) return send(400, { code: 400, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' });
        codes.delete(String(body.auth_code));
        const challenge = createHash('sha256').update(String(body.code_verifier)).digest('base64url');
        if (challenge !== held.trip.challenge) return send(400, { code: 400, error_code: 'bad_code_verifier', msg: 'code challenge does not match previously saved code verifier' });
        const user = users.get(held.member) as User;
        return send(200, { ...session(user), redirect_type: null });
      }
      return send(400, { msg: 'unsupported grant' });
    }
    if (url.pathname === '/auth/v1/logout') return send(204);
    if (url.pathname === '/auth/v1/user' && method === 'GET') {
      const user = caller ? users.get(caller) : undefined;
      return user ? send(200, userBody(user)) : send(401, { msg: 'invalid JWT' });
    }
    if (url.pathname === '/auth/v1/authorize' || url.pathname === '/auth/v1/user/identities/authorize') {
      const link = url.pathname.endsWith('/identities/authorize');
      const flow = randomBytes(8).toString('hex');
      const trip: Trip = { kind: link ? 'link' : 'signin', user: link ? caller : null, redirectTo: url.searchParams.get('redirect_to') ?? 'theratrace://auth', challenge: url.searchParams.get('code_challenge') ?? '' };
      trips.set(flow, trip);
      if (link) return send(200, { url: `http://${request.headers.host ?? '127.0.0.1'}/fake-google?flow=${flow}` });
      response.writeHead(200, { 'content-type': 'text/html' });
      return void response.end(googlePage(flow, trip));
    }
    if (url.pathname === '/fake-google') {
      const flow = url.searchParams.get('flow') ?? '';
      const trip = trips.get(flow);
      if (!trip) return send(404, { error: 'no such trip' });
      response.writeHead(200, { 'content-type': 'text/html' });
      return void response.end(googlePage(flow, trip));
    }
    if (url.pathname === '/fake-google/choose') {
      const trip = trips.get(url.searchParams.get('flow') ?? '');
      if (!trip) return send(404, { error: 'no such trip' });
      trips.delete(url.searchParams.get('flow') ?? '');
      const as = url.searchParams.get('as');
      let to: string;
      if (as === 'denied') to = back(trip, { error: 'access_denied', error_description: 'The user denied access' });
      else if (as === 'taken' && trip.kind === 'link') to = back(trip, { error: 'server_error', error_code: 'identity_already_exists', error_description: 'Identity is already linked to another user' });
      else {
        // Kept: the guest is a member now; signing in: the player Google's account is (Ana for `taken`, a new member otherwise).
        let member: string;
        if (trip.kind === 'link' && trip.user !== null) {
          // A guest the phone kept from a run of this server before it was started again is still a guest here.
          const user = users.get(trip.user) ?? { id: trip.user, is_anonymous: true };
          users.set(user.id, user);
          Object.assign(user, { is_anonymous: false, email: 'new.member@example.com' });
          member = user.id;
        } else if (as === 'taken') member = MEMBER.id;
        else {
          const user: User = { id: uuid('e0000000', ++made), is_anonymous: false, email: 'new.member@example.com' };
          users.set(user.id, user);
          member = user.id;
        }
        const code = randomBytes(16).toString('hex');
        codes.set(code, { trip, member });
        to = back(trip, { code });
      }
      log(`google → ${to}`);
      response.writeHead(302, { location: to });
      return void response.end();
    }

    // The functions.
    if (url.pathname.startsWith('/functions/v1/')) {
      const name = url.pathname.slice('/functions/v1/'.length);
      if (name === 'track') {
        counts.tracked += 1;
        return send(200, { ok: true });
      }
      if (name === 'report-error') {
        counts.reported += 1;
        log(`report-error ${text.slice(0, 400)}`);
        return send(200, { ok: true });
      }
      if (!caller) return send(401, { error: 'no-session' });
      if (name === 'rooms') {
        const reply = await askRooms(caller, body);
        return send(reply.status, reply.body);
      }
      if (name === 'ranked') {
        const reply = await rankedOf(caller).call(body);
        return send(reply.status, reply.body);
      }
      if (name === 'friends') {
        const reply = await friendsFunction(friendsDeps, caller, body);
        return send(reply.status, reply.body);
      }
      if (name === 'finish-run') {
        // The server finishes the life it was sent and keeps its run, as the real one does: a device never sends it again. (The score is not
        // worked out here: no screen of the checks reads it.)
        const game = tables.games.find((row) => row.id === body.gameId && row.user_id === caller);
        if (!game) return send(404, { error: 'no-game' });
        game.status = 'finished';
        if (!tables.runs.some((row) => row.id === game.id))
          tables.runs.push({ id: game.id, user_id: caller, mode: 'casual', life_id: game.life_id, engine_version: game.engine_version, content_version: game.content_version, score: 0, net_worth: 0, status: 0, escaped_at_round: null, bankruptcies: 0, badges: [], cities: [], history: [], finished_at: new Date().toISOString(), challenge: null });
        return send(200, { ok: true });
      }
      return send(404, { error: 'no-such-function' });
    }

    // The database.
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name = url.pathname.slice('/rest/v1/rpc/'.length);
      if (name === 'ranking') {
        const pool = body.friends === true && caller ? friendships.filter((one) => one.follower === caller).map((one) => one.followed) : OTHERS.slice(0, 120);
        const rows = pool.slice(0, Number(body.top ?? 50)).map((id, i) => ({ place: i + 1, user_id: id, nickname: profileOf(id)?.nickname ?? null, score: 9000 - i * 37, life_id: (body.life as string | null) ?? 'engineer', finished_at: '2026-10-22T10:00:00Z' }));
        return send(200, rows);
      }
      if (name === 'challenge_ranking') {
        const rows = OTHERS.slice(0, 30).map((id, i) => ({ place: i + 1, user_id: id, nickname: profileOf(id)?.nickname ?? null, score: 7000 - i * 51, finished_at: '2026-10-22T10:00:00Z', entrants: 30 }));
        return send(200, rows);
      }
      if (name === 'challenge_choices') return send(200, []);
      if (name === 'claim_push_token') return send(200, null);
      return send(404, { code: 'PGRST202', message: `no function ${name}` });
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const table = url.pathname.slice('/rest/v1/'.length);
      if (!(table in tables)) return send(404, { code: '42P01', message: `relation "${table}" does not exist` });
      if (!caller) return send(401, { message: 'no session' });
      const owner = OWNED[table];
      const filters: Array<(row: Row) => boolean> = [];
      let order: { column: string; desc: boolean } | null = null;
      let limit = Infinity;
      for (const [key, value] of url.searchParams) {
        if (key === 'select' || key === 'on_conflict' || key === 'columns') continue;
        if (key === 'order') {
          const [column, way] = value.split('.');
          order = { column, desc: way === 'desc' };
        } else if (key === 'limit') limit = Number(value);
        else filters.push(filterOf(key, value));
      }
      const visible = (): Row[] => {
        // The ranked lives in progress are the ranked server's.
        const ranked = table === 'games' ? [...rankedOf(caller).games.values()].map((game): Row => ({ ...game })) : [];
        return [...tables[table], ...ranked].filter((row) => owner === null || row[owner] === caller || table === 'profiles').filter((row) => filters.every((test) => test(row)));
      };
      const prefer = String(request.headers.prefer ?? '');
      if (method === 'GET' || method === 'HEAD') {
        let rows = visible();
        if (order) {
          const { column, desc } = order;
          rows = [...rows].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : String(a[column]) > String(b[column]) ? 1 : 0) * (desc ? -1 : 1));
        }
        const count = rows.length;
        rows = rows.slice(0, limit);
        const select = url.searchParams.get('select');
        const picked = select && select !== '*' ? rows.map((row) => Object.fromEntries(select.split(',').map((column) => [column, row[column] ?? null]))) : rows;
        const headers: Record<string, string> = prefer.includes('count=exact') ? { 'content-range': `${count === 0 ? '*' : `0-${count - 1}`}/${count}` } : {};
        if (method === 'HEAD') return send(200, undefined, headers);
        if (String(request.headers.accept ?? '').includes('vnd.pgrst.object')) {
          if (picked.length !== 1) return send(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
          return send(200, picked[0], headers);
        }
        return send(200, picked, headers);
      }
      if (method === 'POST') {
        const key = url.searchParams.get('on_conflict') ?? KEYS[table];
        const incoming = (Array.isArray(body) ? body : [body]) as Row[];
        for (const one of incoming) {
          const row: Row = { ...one };
          if (owner !== null && row[owner] === undefined) row[owner] = caller;
          if (owner !== null && row[owner] !== caller) return send(403, { code: '42501', message: 'new row violates row-level security policy' });
          if (table === 'games') row.updated_at = new Date().toISOString();
          const at = tables[table].findIndex((existing) => existing[key] === row[key]);
          if (at >= 0) {
            if (prefer.includes('ignore-duplicates')) continue;
            if (!prefer.includes('merge-duplicates')) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
            Object.assign(tables[table][at], row);
          } else {
            if (table === 'profiles') {
              makeProfile(String(row.user_id), (row.nickname as string | null) ?? null, (row.language as string | null) ?? null);
              continue;
            }
            tables[table].push(row);
          }
        }
        return send(201, prefer.includes('return=representation') ? incoming : undefined);
      }
      if (method === 'PATCH') {
        const rows = visible().filter((row) => owner === null || row[owner] === caller);
        if (table === 'profiles' && 'portrait' in body && failing.portrait) {
          await new Promise((resolve) => setTimeout(resolve, failing.delayMs));
          return send(503, { code: 'PGRST000', message: 'the database is not answering' });
        }
        if (table === 'profiles' && typeof body.nickname === 'string') {
          const taken = tables.profiles.some((row) => row.user_id !== caller && String(row.nickname).toLowerCase() === String(body.nickname).toLowerCase());
          if (taken) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint "profiles_nickname_key"' });
        }
        for (const row of rows) Object.assign(row, body);
        if (table === 'profiles') for (const row of rows) rooms.db.names.set(String(row.user_id), (row.nickname as string | null) ?? null);
        return send(204);
      }
      if (method === 'DELETE') {
        const rows = new Set(visible().filter((row) => owner === null || row[owner] === caller));
        tables[table] = tables[table].filter((row) => !rows.has(row));
        return send(204);
      }
    }

    // The checker's own door.
    if (url.pathname === '/control/rooms' && method === 'POST') {
      const who = String(body.as ?? MIA.id);
      const reply = await askRooms(who === 'mia' ? MIA.id : who, body.body as Record<string, unknown>);
      return send(200, reply);
    }
    if (url.pathname === '/control/friends' && method === 'POST') {
      friendsOfNext = { friends: Number(body.friends ?? 0), incoming: Number(body.incoming ?? 0), outgoing: Number(body.outgoing ?? 0) };
      if (typeof body.user === 'string') giveFriends(body.user, friendsOfNext);
      return send(200, friendsOfNext);
    }
    if (url.pathname === '/control/fail' && method === 'POST') {
      failing.portrait = body.portrait === true;
      failing.delayMs = Number(body.delayMs ?? 0);
      return send(200, failing);
    }
    if (url.pathname === '/control/unsent' && method === 'POST') {
      // The account forgets the finished lives it was sent, so the phone's next start sends them again: the first starts after signing in with lives
      // the account lacks. With `playing`, their games stay in the account as lives being played (sent, never finished: a finish that failed).
      const forgotten = new Set(tables.runs.filter((row) => row.mode === 'casual').map((row) => row.id));
      tables.runs = tables.runs.filter((row) => !forgotten.has(row.id));
      if (body.playing === true) for (const game of tables.games) if (forgotten.has(game.id)) game.status = 'playing';
      if (body.playing !== true) tables.games = tables.games.filter((game) => !forgotten.has(game.id));
      return send(200, { forgotten: forgotten.size });
    }
    if (url.pathname === '/control/state') {
      return send(200, {
        users: [...users.values()].filter((user) => !OTHERS.includes(user.id)),
        counts,
        realtime: { channels: joined.map((one) => one.topic), told: told.realtime },
        rooms: [...rooms.db.rooms.values()].map((room) => ({ id: room.id, code: room.code, status: room.status, round: room.round, deadline: room.deadline, members: rooms.db.members.filter((m) => m.room_id === room.id && m.left_at === null).map((m) => m.user_id) })),
        games: tables.games.map((game) => ({ id: game.id, user_id: game.user_id, round: game.round, status: game.status })),
        profiles: tables.profiles.filter((row) => !OTHERS.includes(String(row.user_id))),
        asked: asked.slice(-60),
      });
    }
    return send(404, { error: `nothing at ${method} ${url.pathname}` });
  }

  const server: Server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      log(`failed: ${String(error)}`);
      if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: String(error) }));
    });
  });
  /** Every socket upgraded, joined to a channel or not: `close` ends them all, or `server.close` would wait on one left open. */
  const sockets = new Set<Duplex>();
  server.on('upgrade', (request, socket) => {
    if ((request.url ?? '').startsWith('/realtime/v1/websocket')) acceptSocket(request, socket, heardRealtime, goneRealtime, sockets);
    else socket.destroy();
  });

  return {
    server,
    rooms,
    users,
    tables,
    friendships,
    requests,
    joined,
    counts,
    told,
    failing,
    mia: MIA,
    member: MEMBER,
    askRooms,
    giveFriends,
    listen: (port = FAKE_CLOUD_PORT) => new Promise<number>((resolve) => server.listen(port, '127.0.0.1', () => resolve((server.address() as { port: number }).port))),
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(ticker);
        for (const one of joined) one.socket.close();
        for (const socket of sockets) socket.destroy();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const port = Number(args.find((a) => a.startsWith('--port='))?.slice('--port='.length) ?? FAKE_CLOUD_PORT);
  const friendsArg = args.find((a) => a.startsWith('--friends='))?.slice('--friends='.length);
  const [f, i, o] = (friendsArg ?? '').split(',').map(Number);
  const cloud = fakeCloud({ friends: friendsArg ? { friends: f || 0, incoming: i || 0, outgoing: o || 0 } : undefined, log: (line) => console.log(`${new Date().toISOString().slice(11, 23)} ${line}`) });
  const at = await cloud.listen(port);
  console.log(`fake cloud on http://127.0.0.1:${at} (not the live project)`);
  console.log(`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:${at} EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${FAKE_KEY}`);
  const stop = () => void cloud.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
