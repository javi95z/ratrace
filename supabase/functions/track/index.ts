// The events the game counts, kept in its own project: the eight the web counts, from the app as
// well as the web, by the day and the platform. Nothing that names a player is kept, nor sent, and
// nothing about who sent an event: what an event may carry is listed in `_shared/events.ts`, where
// it is tested, and anything else is refused.
//
// Anyone may call it, a guest who never signed in included, so it holds itself: a call must carry
// the project's publishable key (no boundary of security, only a door that drive-by scanners do not
// open, and a reason for a browser to ask first); its body is small and read strictly before the
// database is asked anything; and a day's counts of an event on a platform have a ceiling, held by
// the database (`count_event`).
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { answerTrack } from '../_shared/events.ts';
import type { KeptEvent } from '../_shared/events.ts';
import { watched } from '../_shared/watch.ts';

export default {
  fetch: withSupabase(
    // Any of the project's publishable keys, the web's and the app's.
    { auth: 'publishable:*' },
    watched(
      'track',
      async (req: Request, ctx: SupabaseContext) => {
        const db = ctx.supabaseAdmin;
        return answerTrack(req, {
          async count(event: KeptEvent) {
            const { data, error } = await db.rpc('count_event', { p_name: event.name, p_props: event.props, p_platform: event.platform });
            if (error) throw new Error(`the event could not be counted: ${error.message}`);
            return data === true;
          },
        });
      },
      noting,
    ),
  ),
};
