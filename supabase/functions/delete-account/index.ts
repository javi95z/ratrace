// Deletes the account of the player who asks, and everything of theirs with it. The logic is in
// `_shared/deletion.ts`, where it is tested without a server; this is the project behind it.
//
// It removes the player from `auth.users` with the project's secret key, and the database takes away
// the rest (every table of a player's hangs from that row). Who goes comes from the token, never the body.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { deleteAccount } from '../_shared/deletion.ts';
import { json, readJson } from '../_shared/http.ts';
import { allowed } from '../_shared/rate.ts';
import { watched } from '../_shared/watch.ts';

/** The request says only that the player means it: anything much longer is not that. */
const MOST = 1_000;

export default {
  fetch: withSupabase(
    { auth: 'user' },
    watched(
      'delete-account',
      async (req: Request, ctx: SupabaseContext) => {
        const userId = ctx.userClaims?.id;
        if (typeof userId !== 'string') return json(401, { error: 'no-player' });
        const read = await readJson(req, MOST);
        if ('refusal' in read) return read.refusal;
        const db = ctx.supabaseAdmin;
        const reply = await deleteAccount(
          {
            allow: (user) => allowed(db, user, 'delete-account'),
            remove: async (user) => {
              // Not soft: the row goes, and every row that hangs from it.
              const { error } = await db.auth.admin.deleteUser(user);
              if (error) throw new Error(`the account could not be deleted: ${error.message}`);
            },
          },
          userId,
          read.value,
        );
        return json(reply.status, reply.body);
      },
      noting,
    ),
  ),
};
