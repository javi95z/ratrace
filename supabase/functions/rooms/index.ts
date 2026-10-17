// Rooms: two to six friends live the same life in the same world, a round at a time.
//
// The logic is in `_shared/rooms.ts`, where it is tested without a server. This file is the
// database behind it: the room's own functions in the database, each of which holds the room's
// row while it works, and plain reads for the rest.
//
// It reads and writes with the project's secret key, which the platform gives it and which skips
// the rules that keep players out of the rooms they are not in. Who is asking comes from the
// token, never the body.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import type { RunRow } from '../_shared/finish.ts';
import { CURRENT, GAMES } from '../_shared/game/index.ts';
import { json, readJson } from '../_shared/http.ts';
import { noticeOf } from '../_shared/notice.ts';
import { deliver, subscriptionsOf } from '../_deno/push.ts';
import { allowed } from '../_shared/rate.ts';
import { rooms } from '../_shared/rooms.ts';
import type { LoanRow, MemberRow, RoomGameRow, RoomRow } from '../_shared/rooms.ts';
import { watched } from '../_shared/watch.ts';

const ROOM = 'id, code, host, life_id, engine_version, content_version, seconds, status, round, deadline, created_at, rematch, rematch_of';
const MEMBER = 'user_id, game_id, ready_round, left_at, standing, joined_at, shout, shout_at';
const GAME = 'id, user_id, mode, life_id, engine_version, content_version, room, round, status, log, updated_at';
const LOAN = 'id, room_id, round, proposer, lender, borrower, amount, rate_bp, rounds, status';

export default {
  fetch: withSupabase({ auth: 'user' }, watched('rooms', async (req: Request, ctx: SupabaseContext) => {
    const userId = ctx.userClaims?.id;
    if (typeof userId !== 'string') return json(401, { error: 'no-player' });
    const read = await readJson(req);
    if ('refusal' in read) return read.refusal;

    const db = ctx.supabaseAdmin;
    const must = <T>(result: { data: T; error: { message: string } | null }): T => {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    };
    const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => must(await db.rpc(name, args)) as T;

    const reply = await rooms(
      GAMES,
      {
        current: CURRENT,
        allow: (user, kind) => allowed(db, user, kind),
        newId: () => crypto.randomUUID(),
        newSeed: () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join(''),
        now: () => new Date(),
        unlockedLives: async (user) => {
          const row = must(await db.from('player_progress').select('progress').eq('user_id', user).maybeSingle()) as { progress?: { unlocked?: unknown } } | null;
          const unlocked = row?.progress?.unlocked;
          return typeof unlocked === 'object' && unlocked !== null ? Object.keys(unlocked) : [];
        },
        myRoom: async (user) => {
          const row = must(
            await db
              .from('room_players')
              .select('room_id, joined_at, rooms!inner(status)')
              .eq('user_id', user)
              .is('left_at', null)
              .in('rooms.status', ['open', 'playing', 'finished'])
              .order('joined_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ) as { room_id: string } | null;
          return row?.room_id ?? null;
        },
        loadRoom: async (id) => must(await db.from('rooms').select(ROOM).eq('id', id).maybeSingle()) as RoomRow | null,
        members: async (room) => must(await db.from('room_players').select(MEMBER).eq('room_id', room).order('joined_at', { ascending: true })) as MemberRow[],
        names: async (ids) => {
          if (ids.length === 0) return {};
          const rows = must(await db.from('profiles').select('user_id, nickname').in('user_id', ids)) as Array<{ user_id: string; nickname: string | null }>;
          return Object.fromEntries(rows.map((row) => [row.user_id, row.nickname]));
        },
        avatars: async (ids) => {
          if (ids.length === 0) return {};
          const rows = must(await db.from('profiles').select('user_id, portrait').in('user_id', ids)) as Array<{ user_id: string; portrait: string | null }>;
          // Only a rat is an avatar: a portrait of a life, from before rats, is not one.
          return Object.fromEntries(rows.map((row) => [row.user_id, row.portrait?.startsWith('rat_') ? row.portrait : null]));
        },
        open: (room) => call('room_open', { p_room: room.id, p_host: room.host, p_life: room.life_id, p_engine: room.engine_version, p_content: room.content_version, p_seconds: room.seconds }),
        join: (code, user, engine, content) => call('room_join', { p_code: code, p_member: user, p_engine: engine, p_content: content }),
        start: (room, host, seed, games, deadline) => call('room_start', { p_room: room, p_host: host, p_seed: seed, p_games: games, p_deadline: deadline.toISOString() }),
        leave: (room, user) => call('room_leave', { p_room: room, p_member: user }),
        closeIfStale: (room, now) => call('room_close', { p_room: room, p_now: now.toISOString() }),
        loadGame: async (id) => must(await db.from('games').select(GAME).eq('id', id).maybeSingle()) as RoomGameRow | null,
        loadSeed: async (id) => (must(await db.from('game_secrets').select('seed').eq('game_id', id).maybeSingle()) as { seed: string } | null)?.seed ?? null,
        loadOrders: async (room, round) => {
          const rows = must(await db.from('room_orders').select('user_id, orders').eq('room_id', room).eq('round', round)) as Array<{ user_id: string; orders: unknown[] }>;
          return Object.fromEntries(rows.map((row) => [row.user_id, row.orders]));
        },
        step: (room, round, user, game, asRead, log, gameRound) =>
          call('room_step', { p_room: room, p_round: round, p_member: user, p_game: game, p_as_read: asRead, p_log: log, p_game_round: gameRound }),
        submit: (room, round, user, orders) => call('room_submit', { p_room: room, p_round: round, p_member: user, p_orders: orders }),
        turn: (room, round, deadline, lives) => call('room_turn', { p_room: room, p_round: round, p_deadline: deadline === null ? null : deadline.toISOString(), p_lives: lives }),
        saveRun: async (run: RunRow) => void must(await db.from('runs').upsert(run, { onConflict: 'id', ignoreDuplicates: true })),
        rematch: (old, room) =>
          call('room_rematch', { p_old: old, p_room: room.id, p_host: room.host, p_life: room.life_id, p_engine: room.engine_version, p_content: room.content_version, p_seconds: room.seconds }),
        shout: (room, user, shout, now) => call('room_shout', { p_room: room, p_member: user, p_shout: shout, p_now: now.toISOString() }),
        loans: async (room) => must(await db.from('room_loans').select(LOAN).eq('room_id', room).order('created_at', { ascending: true })) as LoanRow[],
        offerLoan: (loan) =>
          call('room_loan_offer', { p_id: loan.id, p_room: loan.room_id, p_round: loan.round, p_proposer: loan.proposer, p_lender: loan.lender, p_borrower: loan.borrower, p_amount: loan.amount, p_rate: loan.rate_bp, p_rounds: loan.rounds }),
        answerLoan: (id, user, yes) => call('room_loan_answer', { p_id: id, p_member: user, p_yes: yes }),
        closeLoans: async (room, round, paid) => void (await call('room_loans_close', { p_room: room, p_round: round, p_paid: paid })),
        history: async (user, limit) => {
          const mine = must(
            await db
              .from('room_players')
              .select(`room_id, rooms!inner(${ROOM})`)
              .eq('user_id', user)
              .eq('rooms.status', 'finished')
              .order('joined_at', { ascending: false })
              .limit(limit),
          ) as unknown as Array<{ room_id: string; rooms: RoomRow }>;
          if (mine.length === 0) return [];
          const all = must(await db.from('room_players').select(`room_id, ${MEMBER}`).in('room_id', mine.map((row) => row.room_id)).order('joined_at', { ascending: true })) as Array<MemberRow & { room_id: string }>;
          // Who gave their life up before the end: their game was abandoned, not finished.
          const ids = all.map((m) => m.game_id).filter((id): id is string => id !== null);
          const lives = ids.length === 0 ? [] : (must(await db.from('games').select('id, status').in('id', ids)) as Array<{ id: string; status: string }>);
          const quit = new Set(lives.filter((life) => life.status === 'abandoned').map((life) => life.id));
          return mine.map((row) => ({ room: row.rooms, members: all.filter((m) => m.room_id === row.room_id).map((m) => ({ ...m, quit: m.game_id !== null && quit.has(m.game_id) })) }));
        },
        notify: async (users, about) => {
          // Sent after the answer, so that a player's move does not wait on push services.
          const sending = subscriptionsOf(db, users)
            .then((rows) => deliver(db, rows, (row) => noticeOf(row.locale, about), about.kind === 'yourTurn' ? Math.max(1, about.secondsLeft) : about.kind === 'newRound' ? about.seconds : 3_600, 'high'))
            .catch((error: unknown) => console.error('room notice failed:', error instanceof Error ? error.message : error));
          const runtime = (globalThis as { EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void } }).EdgeRuntime;
          if (runtime) runtime.waitUntil(sending);
          else await sending;
        },
      },
      userId,
      read.value,
    );
    return json(reply.status, reply.body);
  }, noting)),
};
