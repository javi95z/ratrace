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
          return {
            friends: await rows((must(mine) as Array<{ followed: string }>).map((row) => row.followed)),
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
