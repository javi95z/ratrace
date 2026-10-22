// The notices the clock sends, called by jobs of the database (see the migrations of notices) with
// the project's secret key, never by a player:
// - `weekly`, on Monday morning: a new challenge has begun, with the place each player came in the
//   week before if they played it.
// - `idle`, every evening: a life left untouched for a week, once, to a player who has not played
//   any other since.
// Neither is sent to a player who has had their notice of the day already, on any of their
// browsers and phones: each is told on all of them, or on none. Once Expo has failed the run, a
// player with a phone alone is left for another day, with their day not taken (`unreached`).
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { watched } from '../_shared/watch.ts';
import { json, readJson } from '../_shared/http.ts';
import { isoWeek } from '../_shared/notice.ts';
import { addUp, byPlayer, claimDay, clockRun, expoAnswer, tally, vapid } from '../_deno/push.ts';
import type { Subscription } from '../_deno/push.ts';

/** A browser or a phone, with its player's place in last week's challenge (null in the idle notice's rows). */
type Placed = Subscription & {
  place: number | null;
  entrants: number | null;
};

const PAGE = 500;
const WEEK_MS = 7 * 86_400_000;

export default {
  fetch: withSupabase({ auth: 'secret' }, watched('weekly-notice', async (req: Request, ctx: SupabaseContext) => {
    if (!vapid()) return json(500, { error: 'no-vapid-keys' });
    const read = await readJson(req);
    const kind = 'value' in read && (read.value as { kind?: unknown } | null)?.kind === 'idle' ? 'idle' : 'weekly';
    const db = ctx.supabaseAdmin;
    const now = new Date();
    const totals = tally();
    const notices = clockRun(db);
    // Whose notice of the day this very call took: their other browsers and phones, on the next page, are sent it too.
    const taken = new Set<string>();
    for (let from = 0; ; from += PAGE) {
      const { data, error } =
        kind === 'weekly'
          ? await db.rpc('notice_week', { week_id: isoWeek(now.getTime() - WEEK_MS) }).range(from, from + PAGE - 1)
          : await db.rpc('notice_idle', { p_now: now.toISOString() }).range(from, from + PAGE - 1);
      if (error) return json(500, { error: 'read-failed', ...totals, ...expoAnswer(notices.run) });
      const rows = (data ?? []) as Placed[];
      for (const [user, devices] of byPlayer(rows)) {
        const before = taken.has(user);
        const done = await notices.tell(
          devices,
          async () => {
            if (before) return true;
            if (!(await claimDay(db, user, now))) return false;
            taken.add(user);
            return true;
          },
          (row) => (kind === 'weekly' ? { kind: 'weekly', place: row.place, entrants: row.entrants } : { kind: 'idle' }),
          // A day to be delivered: a Monday notice is no use on Wednesday.
          86_400,
        );
        addUp(totals, done, before);
      }
      if (rows.length < PAGE) break;
    }
    return json(200, { kind, ...totals, ...expoAnswer(notices.run) });
  }, noting)),
};
