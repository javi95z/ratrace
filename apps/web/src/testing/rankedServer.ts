import type { RunRow } from '../../../../supabase/functions/_shared/finish.ts';
import { CURRENT, GAMES } from '../../../../supabase/functions/_shared/game/index.ts';
import { ranked } from '../../../../supabase/functions/_shared/ranked.ts';
import type { RankedDeps, RankedGameRow } from '../../../../supabase/functions/_shared/ranked.ts';
import { rankedApi } from '@/online/ranked';
import type { RankedCall } from '@/online/ranked';

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
    challengeEntered: async (who, week) => entries.has(`${who}/${week}`),
    enterChallenge: async (who, week, gameId) => {
      if (entries.has(`${who}/${week}`)) return false;
      entries.set(`${who}/${week}`, gameId);
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
      if (!runs.some((one) => one.id === run.id)) runs.push(run);
    },
    closeGame: async (id, round, status) => {
      const game = games.get(id);
      if (game) Object.assign(game, { status, round, updated_at: stamp() });
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
  return { api: rankedApi(call), call, games, seeds, runs, state, user, weekSeeds, entries, picks };
}
