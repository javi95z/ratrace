// "Your market moved", called every evening by a job of the database (see the migration of this
// notice) with the project's secret key, never by a player: to a player with a ranked life in
// progress, left alone for between 20 hours and 6 days, that holds something that moved 5% or more
// in the round they last played.
//
// What is said is worked out in `_shared/market.ts`, where it is tested: the life is played again
// from its seed and log, and only the world the player is already in is read, never the next round.
// A player is claimed their notice of the day only when there is something to say, and who has had
// theirs already is left alone. A browser or a phone that turned this notice off is not even read.
// Once Expo has failed the run, a player with a phone alone is left, with their day not taken.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { watched } from '../_shared/watch.ts';
import { json } from '../_shared/http.ts';
import { GAMES } from '../_shared/game/index.ts';
import { marketMover } from '../_shared/market.ts';
import type { MarketRow } from '../_shared/market.ts';
import { addUp, byPlayer, claimDay, clockRun, expoAnswer, tally, vapid } from '../_deno/push.ts';
import type { Subscription } from '../_deno/push.ts';

type Browser = Subscription & MarketRow;

const PAGE = 500;

export default {
  fetch: withSupabase({ auth: 'secret' }, watched('market-notice', async (_req: Request, ctx: SupabaseContext) => {
    if (!vapid()) return json(500, { error: 'no-vapid-keys' });
    const db = ctx.supabaseAdmin;
    const now = new Date();
    const totals = tally();
    let quiet = 0;
    const notices = clockRun(db);
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.rpc('notice_market', { p_now: now.toISOString() }).range(from, from + PAGE - 1);
      if (error) return json(500, { error: 'read-failed', ...totals, quiet, ...expoAnswer(notices.run) });
      const rows = (data ?? []) as Browser[];
      for (const [user, browsers] of byPlayer(rows)) {
        const life = browsers[0];
        const seedRow = await db.from('game_secrets').select('seed').eq('game_id', life.game_id).maybeSingle();
        const seed = (seedRow.data as { seed?: string } | null)?.seed;
        const mover = typeof seed === 'string' ? marketMover(GAMES, life, seed) : null;
        if (mover === null) {
          quiet += 1;
          continue;
        }
        const done = await notices.tell(browsers, () => claimDay(db, user, now), () => ({ kind: 'marketMoved', asset: mover.assetId, percent: mover.percent }), 86_400);
        addUp(totals, done);
      }
      if (rows.length < PAGE) break;
    }
    return json(200, { ...totals, quiet, ...expoAnswer(notices.run) });
  }, noting)),
};
