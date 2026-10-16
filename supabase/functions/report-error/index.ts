// The errors a page met, kept in one place.
//
// A page sends what it caught, already cleaned; it is cleaned again here, grouped by kind, and kept
// without anything of who sent it. A kind seen for the first time, or again after a quiet day, sends
// an alert to the address in the secret ALERT_URL. The logic is in `_shared/errors.ts`, where it is
// tested; see `docs/errors.md`.
//
// Only a signed-in player may call it; a guest is one. Who is asking is used to hold them to a limit,
// and nothing else.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { reportErrors } from '../_shared/errors.ts';
import { json, readJson } from '../_shared/http.ts';
import { allowed } from '../_shared/rate.ts';
import { watched } from '../_shared/watch.ts';

export default {
  fetch: withSupabase(
    { auth: 'user' },
    watched(
      'report-error',
      async (req: Request, ctx: SupabaseContext) => {
        const userId = ctx.userClaims?.id;
        if (typeof userId !== 'string') return json(401, { error: 'no-player' });
        const read = await readJson(req);
        if ('refusal' in read) return read.refusal;
        const db = ctx.supabaseAdmin;
        const reply = await reportErrors({ ...noting(ctx), allow: (user) => allowed(db, user, 'errors') }, userId, read.value);
        return json(reply.status, reply.body);
      },
      noting,
    ),
  ),
};
