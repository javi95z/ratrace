// A ranked life: one the server plays.
//
// The client names what it chooses and nothing else. The seed is made here and kept where no
// player can read it; every card and every round is played here, with the engine of the life's own
// versions; and the client is told what it may know of the game as it then stands. The logic is in
// `_shared/ranked.ts`, where it is tested without a server. This file is the database behind it.
//
// It reads and writes with the project's secret key, which the platform gives it and which skips
// the rules that keep players out of ranked games. Who is asking comes from the token, never the body.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import type { SupabaseContext } from 'npm:@supabase/server@1.9.0';
import { noting } from '../_deno/errors.ts';
import { watched } from '../_shared/watch.ts';
import type { RunRow } from '../_shared/finish.ts';
import { CURRENT, GAMES } from '../_shared/game/index.ts';
import { json, readJson } from '../_shared/http.ts';
import { ranked } from '../_shared/ranked.ts';
import type { RankedGameRow } from '../_shared/ranked.ts';
import { allowed } from '../_shared/rate.ts';

/** What a ranked life reads of its row. */
const ROW = 'id, user_id, mode, life_id, engine_version, content_version, round, status, log, updated_at, challenge';

export default {
  fetch: withSupabase({ auth: 'user' }, watched('ranked', async (req: Request, ctx: SupabaseContext) => {
    const userId = ctx.userClaims?.id;
    if (typeof userId !== 'string') return json(401, { error: 'no-player' });
    const read = await readJson(req);
    if ('refusal' in read) return read.refusal;

    const db = ctx.supabaseAdmin;
    const must = <T>(result: { data: T; error: { message: string } | null }): T => {
      if (result.error) throw new Error(result.error.message);
      return result.data;
    };
    const reply = await ranked(
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
        // One at most: the database keeps a player to a single ranked game in progress.
        playingRanked: async (user) =>
          must(await db.from('games').select(ROW).eq('user_id', user).eq('mode', 'ranked').eq('status', 'playing').limit(1).maybeSingle()) as RankedGameRow | null,
        createGame: async (row, seed) => {
          must(await db.from('games').insert({ ...row, mode: 'ranked' }));
          const kept = await db.from('game_secrets').insert({ game_id: row.id, seed });
          if (kept.error) {
            // A game with no seed can never be played: it is given up at once, so that it is not found in progress.
            await db.from('games').update({ status: 'abandoned' }).eq('id', row.id);
            throw new Error(kept.error.message);
          }
        },
        // Made once, by whoever asks first: of two that ask at once, both read the one that was kept.
        challengeSeed: async (week, fresh) => {
          must(await db.from('challenge_seeds').upsert({ week, seed: fresh }, { onConflict: 'week', ignoreDuplicates: true }));
          return (must(await db.from('challenge_seeds').select('seed').eq('week', week).single()) as { seed: string }).seed;
        },
        challengeEntered: async (user, week) => (must(await db.from('challenge_entries').select('week').eq('user_id', user).eq('week', week).maybeSingle()) as unknown) !== null,
        enterChallenge: async (user, week, gameId) => {
          const entered = await db.from('challenge_entries').insert({ user_id: user, week, game_id: gameId });
          // The key is the player and the week: a second entry is refused by the database itself.
          if (entered.error?.code === '23505') return false;
          must(entered);
          return true;
        },
        savePicks: async (runId, week, picks) => {
          if (picks.length === 0) return;
          must(await db.from('challenge_picks').upsert(picks.map((pick, seq) => ({ run_id: runId, week, seq, card_id: pick.cardId, option: pick.option })), { onConflict: 'run_id,seq', ignoreDuplicates: true }));
        },
        loadGame: async (id) => must(await db.from('games').select(ROW).eq('id', id).maybeSingle()) as RankedGameRow | null,
        loadSeed: async (id) => (must(await db.from('game_secrets').select('seed').eq('game_id', id).maybeSingle()) as { seed: string } | null)?.seed ?? null,
        // Written only if the row is as it was read: of two steps that arrive at once, one finds it changed.
        saveStep: async (id, asRead, log, round) =>
          (must(await db.from('games').update({ log, round }).eq('id', id).eq('updated_at', asRead).eq('status', 'playing').select('id')) as unknown[]).length === 1,
        saveRun: async (run: RunRow) => void must(await db.from('runs').upsert(run, { onConflict: 'id', ignoreDuplicates: true })),
        closeGame: async (id, round, status) => void must(await db.from('games').update({ status, round }).eq('id', id)),
      },
      userId,
      read.value,
    );
    return json(reply.status, reply.body);
  }, noting)),
};
