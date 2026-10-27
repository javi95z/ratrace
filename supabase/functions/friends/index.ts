// Friends, both ways: asking, answering, ending, and the list. The logic is in `_shared/friends.ts`,
// where it is tested without a server; this is the database and the push behind it.
//
// It reads and writes with the project's secret key: a player cannot write a friendship or a request
// of their own. Who is asking comes from the token, never the body.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { deliver, subscriptionsOf } from '../_deno/push.ts';
import { friends } from '../_shared/friends.ts';
import type { Befriended, FriendRow } from '../_shared/friends.ts';
import { json, readJson } from '../_shared/http.ts';
import { allowed } from '../_shared/rate.ts';
import { watched } from '../_shared/watch.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, watched('friends', async (req: Request, ctx: SupabaseContext) => {
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
    /** Players by id, in the order given, with the name and the rat they chose. */
    const rows = async (ids: string[]): Promise<FriendRow[]> => {
      if (ids.length === 0) return [];
      const found = must(await db.from('profiles').select('user_id, nickname, portrait').in('user_id', ids)) as Array<{ user_id: string; nickname: string | null; portrait: string | null }>;
      const by = new Map(found.map((row) => [row.user_id, row]));
      return ids.map((id) => ({ userId: id, nickname: by.get(id)?.nickname ?? null, avatar: by.get(id)?.portrait ?? null }));
    };

    /**
     * Each friend with the game they are in now (a code only for one that waits for its players: a friend may join it) and how many games the
     * player has shared with them (the player's latest 500).
     */
    const withGames = async (user: string, list: FriendRow[]): Promise<FriendRow[]> => {
      if (list.length === 0) return list;
      const ids = list.map((row) => row.userId);
      const [now, mine] = await Promise.all([
        db.from('room_players').select('user_id, rooms!inner(code, status)').in('user_id', ids).is('left_at', null).in('rooms.status', ['open', 'playing']),
        db.from('room_players').select('room_id').eq('user_id', user).order('joined_at', { ascending: false }).limit(500),
      ]);
      const playing = new Map<string, { status: 'open' | 'playing'; code: string | null }>();
      for (const row of must(now) as unknown as Array<{ user_id: string; rooms: { code: string; status: 'open' | 'playing' } }>) {
        playing.set(row.user_id, { status: row.rooms.status, code: row.rooms.status === 'open' ? row.rooms.code : null });
      }
      const rooms = (must(mine) as Array<{ room_id: string }>).map((row) => row.room_id);
      const shared = rooms.length === 0 ? [] : (must(await db.from('room_players').select('user_id').in('room_id', rooms).in('user_id', ids)) as Array<{ user_id: string }>);
      const together = new Map<string, number>();
      for (const row of shared) together.set(row.user_id, (together.get(row.user_id) ?? 0) + 1);
      return list.map((row) => ({ ...row, playing: playing.get(row.userId) ?? null, together: together.get(row.userId) ?? 0 }));
    };

    const reply = await friends(
      {
        allow: (user) => allowed(db, user, 'friends'),
        requestByCode: async (user, code) => {
          const said = await call<{ answer: Befriended | 'unknown'; to?: string }>('friend_request', { p_from: user, p_code: code });
          return { answer: said.answer, to: said.to ?? null };
        },
        answer: (user, from, yes) => call('friend_answer', { p_me: user, p_from: from, p_yes: yes }),
        remove: async (user, other) => void (await call('friend_remove', { p_me: user, p_other: other })),
        list: async (user) => {
          const [mine, toMe, fromMe] = await Promise.all([
            db.from('friendships').select('followed').eq('follower', user).order('created_at', { ascending: false }),
            db.from('friend_requests').select('from_user').eq('to_user', user).order('created_at', { ascending: false }),
            db.from('friend_requests').select('to_user').eq('from_user', user).order('created_at', { ascending: false }),
          ]);
          const friendIds = (must(mine) as Array<{ followed: string }>).map((row) => row.followed);
          return {
            friends: await withGames(user, await rows(friendIds)),
            incoming: await rows((must(toMe) as Array<{ from_user: string }>).map((row) => row.from_user)),
            outgoing: await rows((must(fromMe) as Array<{ to_user: string }>).map((row) => row.to_user)),
          };
        },
        names: async (ids) => {
          const found = must(await db.from('profiles').select('user_id, nickname').in('user_id', ids)) as Array<{ user_id: string; nickname: string | null }>;
          return Object.fromEntries(found.map((row) => [row.user_id, row.nickname]));
        },
        notify: async (users, about) => {
          // Sent after the answer, so that nobody waits on push services.
          const sending = subscriptionsOf(db, users)
            .then((subs) => deliver(db, subs, () => about, 86_400))
            .catch((error: unknown) => console.error('friend notice failed:', error instanceof Error ? error.message : error));
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
