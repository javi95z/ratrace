import type { RunRow } from '../../../../supabase/functions/_shared/finish.ts';
import { CURRENT, GAMES } from '../../../../supabase/functions/_shared/game/index.ts';
import { ranked } from '../../../../supabase/functions/_shared/ranked.ts';
import type { RankedDeps, RankedGameRow } from '../../../../supabase/functions/_shared/ranked.ts';
import type { NoticeAbout } from '../../../../supabase/functions/_shared/notice.ts';
import { tellOvertaken } from '../../../../supabase/functions/_shared/overtaken.ts';
import { rankedApi } from '@ratrace/online/ranked';
import type { RankedCall } from '@ratrace/online/ranked';

/**
 * The server of ranked lives, in memory: the very logic the function runs, over a database kept
 * here, reached through the very mapping the game uses. Only the network between them is missing,
 * and a test can take that away, or lose an answer on its way back.
 */
export function rankedServer(user = '11111111-1111-4111-8111-111111111111') {
  const games = new Map<string, RankedGameRow>();
  const seeds = new Map<string, string>();
  const runs: RunRow[] = [];
  // The weekly challenges: each week's seed, who has had their attempt, and what each attempt chose.
  const weekSeeds = new Map<string, string>();
  const entries = new Map<string, string>();
  const picks = new Map<string, Array<{ week: string; cardId: string; option: number }>>();
  // Friends, a row each way, as `friendships` keeps them; the names the players chose; the day each was last told a friend passed them
  // (`overtaken_days`); and the notices sent, to whom, in order.
  const friendships: Array<{ follower: string; followed: string }> = [];
  const names = new Map<string, string>();
  const overtakenDays = new Map<string, string>();
  const notices: Array<{ user: string; about: NoticeAbout }> = [];
  const state = { ids: 0, clock: 0, down: false, loseNextAnswer: false, unlocked: [] as string[], calls: [] as string[] };
  const stamp = () => `2026-10-13T12:00:${String((state.clock += 1)).padStart(2, '0')}.000000+00:00`;
  const deps: RankedDeps = {
    current: CURRENT,
    allow: async () => true,
    newId: () => `00000000-0000-4000-8000-${String((state.ids += 1)).padStart(12, '0')}`,
    newSeed: () => state.ids.toString(16).padStart(2, '0').repeat(32),
    now: () => new Date('2026-10-13T12:00:00.000Z'),
    unlockedLives: async () => state.unlocked,
    playingRanked: async (who) => structuredClone([...games.values()].find((game) => game.user_id === who && game.mode === 'ranked' && game.status === 'playing') ?? null),
    createGame: async (row, seed) => {
      games.set(row.id, { ...row, mode: 'ranked', round: 0, status: 'playing', log: [], updated_at: stamp() });
      seeds.set(row.id, seed);
    },
    challengeSeed: async (week, fresh) => {
      if (!weekSeeds.has(week)) weekSeeds.set(week, fresh);
      return weekSeeds.get(week) as string;
    },
    challengeEntered: async (who, week, day) => entries.has(`${who}/${week}/${day}`),
    enterChallenge: async (who, week, day, gameId) => {
      if (entries.has(`${who}/${week}/${day}`)) return false;
      entries.set(`${who}/${week}/${day}`, gameId);
      return true;
    },
    savePicks: async (runId, week, chosen) => {
      if (!picks.has(runId)) picks.set(runId, chosen.map((pick) => ({ week, ...pick })));
    },
    loadGame: async (id) => structuredClone(games.get(id) ?? null),
    loadSeed: async (id) => seeds.get(id) ?? null,
    saveStep: async (id, asRead, log, round) => {
      const game = games.get(id);
      if (!game || game.updated_at !== asRead) return false;
      Object.assign(game, { log: structuredClone(log), round, updated_at: stamp() });
      return true;
    },
    saveRun: async (run) => {
      if (runs.some((one) => one.id === run.id)) return false;
      runs.push(run);
      return true;
    },
    closeGame: async (id, round, status) => {
      const game = games.get(id);
      if (game) Object.assign(game, { status, round, updated_at: stamp() });
    },
    // As the function: the friends the run passed, told by the database's `overtaken_bests` and `overtaken_claim`.
    written: async (run) => {
      await tellOvertaken(
        {
          friendsOf: async (who) => friendships.filter((one) => one.follower === who).map((one) => one.followed),
          bestsSince: async (users, since, except) => {
            const bests: Record<string, number> = {};
            for (const one of runs) {
              if (one.mode !== 'ranked' || !users.includes(one.user_id) || Date.parse(one.finished_at) < Date.parse(since) || one.id === except) continue;
              bests[one.user_id] = Math.max(bests[one.user_id] ?? Number.NEGATIVE_INFINITY, one.score);
            }
            return bests;
          },
          names: async (ids) => Object.fromEntries(ids.map((id) => [id, names.get(id) ?? null])),
          claim: async (who, day) => {
            const last = overtakenDays.get(who);
            if (last !== undefined && last >= day) return false;
            overtakenDays.set(who, day);
            return true;
          },
          notify: async (who, about) => void notices.push({ user: who, about: structuredClone(about) }),
        },
        run,
        deps.now(),
      );
    },
  };
  const call: RankedCall = async (body) => {
    if (state.down) throw new TypeError('Failed to fetch');
    state.calls.push(String(body.action));
    const reply = structuredClone(await ranked(GAMES, deps, user, body));
    // The server took the step; the answer never arrived.
    if (state.loseNextAnswer) {
      state.loseNextAnswer = false;
      throw new TypeError('Failed to fetch');
    }
    return reply;
  };
  /** Two players made friends, both ways. */
  const befriend = (a: string, b: string) => friendships.push({ follower: a, followed: b }, { follower: b, followed: a });
  return { api: rankedApi(call), call, games, seeds, runs, state, user, weekSeeds, entries, picks, friendships, names, overtakenDays, notices, befriend };
}
