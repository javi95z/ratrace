// Finishes a life.
//
// A player cannot write a finished life: they would be writing their own score. The device saves
// the game it played, as it always has, and asks this function to finish it. The function reads
// that game, plays it again with the engine of its versions, and writes the run itself.
//
// It reads and writes with the project's secret key, which the platform gives it and which skips
// the rules that keep players out of `runs`. Who is asking comes from the token, never the body.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { watched } from '../_shared/watch.ts';
import { finishRun } from '../_shared/finish.ts';
import type { GameRow, RunRow } from '../_shared/finish.ts';
import { GAMES } from '../_shared/game/index.ts';
import { json, readJson } from '../_shared/http.ts';
import { allowed } from '../_shared/rate.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, watched('finish-run', async (req: Request, ctx: SupabaseContext) => {
    const userId = ctx.userClaims?.id;
    if (typeof userId !== 'string') return json(401, { error: 'no-player' });
    const read = await readJson(req);
    if ('refusal' in read) return read.refusal;

    const db = ctx.supabaseAdmin;
    // Every call plays a life again: a player may ask so often and no more. The game sends the rest later.
    if (!(await allowed(db, userId, 'finish'))) return json(429, { error: 'too-many' });
    const must = <T>(result: { data: T; error: { message: string } | null }): T => {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    };
    const reply = await finishRun(
      GAMES,
      {
        loadGame: async (id) => must(await db.from('games').select('id, user_id, mode, life_id, engine_version, content_version, seed, round, status, log, challenge').eq('id', id).maybeSingle()) as GameRow | null,
        loadRun: async (id) => must(await db.from('runs').select('*').eq('id', id).maybeSingle()) as RunRow | null,
        saveRun: async (run) => void must(await db.from('runs').upsert(run, { onConflict: 'id', ignoreDuplicates: true })),
        closeGame: async (id, round) => void must(await db.from('games').update({ status: 'finished', round }).eq('id', id)),
        now: () => new Date(),
      },
      userId,
      read.value,
    );
    return json(reply.status, reply.body);
  }, noting)),
};
