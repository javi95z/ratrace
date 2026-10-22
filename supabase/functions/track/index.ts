// The events the game counts, kept in its own project: the eight the web counts, from the app as
// well as the web, by the day and the platform. Nothing that names a player is kept, nor sent: what
// an event may carry is listed in `_shared/events.ts`, where it is tested, and anything else is
// refused.
//
// Anyone may call it, a guest who never signed in included, so it holds itself: a small body, read
// strictly before the database is asked anything, and two hundred calls a day for each caller, who
// is known only by a hash of their address, the day and the secret EVENTS_SALT.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { callerOf, MAX_EVENT_BODY, trackEvent } from '../_shared/events.ts';
import type { KeptEvent } from '../_shared/events.ts';
import { json, readJson } from '../_shared/http.ts';
import { allowedHashed } from '../_shared/rate.ts';
import { watched } from '../_shared/watch.ts';

/** The secret the caller's hash is made with: its own where it is set, else a secret the project always has. */
const secret = () => Deno.env.get('EVENTS_SALT') || Deno.env.get('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

export default {
  fetch: withSupabase(
    { auth: 'none' },
    watched(
      'track',
      async (req: Request, ctx: SupabaseContext) => {
        const read = await readJson(req, MAX_EVENT_BODY);
        if ('refusal' in read) return read.refusal;
        const db = ctx.supabaseAdmin;
        const who = await callerOf(req.headers, secret(), new Date());
        const reply = await trackEvent(
          {
            allow: (caller) => allowedHashed(db, caller, 'events'),
            async count(event: KeptEvent) {
              const { error } = await db.rpc('count_event', { p_name: event.name, p_props: event.props, p_platform: event.platform });
              if (error) throw new Error(`the event could not be counted: ${error.message}`);
            },
          },
          who,
          read.value,
        );
        return reply.status === 204 ? new Response(null, { status: 204 }) : json(reply.status, reply.body);
      },
      noting,
    ),
  ),
};
