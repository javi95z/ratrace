import { Unreachable } from '@/session/errors';
import type { RankedApi, RankedRun, RankedStanding, RankedStep } from '@/session/ranked';

/**
 * Asks the `ranked` function one thing and hands back its answer: the status and the body. It
 * throws when no answer came at all. The real one is in `connect.ts`; a test hands in the
 * function's own logic, with no network between.
 */
export type RankedCall = (body: Record<string, unknown>) => Promise<{ status: number; body: unknown }>;

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

interface RunRow {
  id: string;
  life_id: string;
  engine_version: string;
  content_version: string;
  score: number;
  net_worth: number;
  status: number;
  escaped_at_round: number | null;
  bankruptcies: number;
  badges: string[];
  cities: string[];
  history: number[];
  finished_at: string;
}
const runOf = (raw: unknown): RankedRun | null => {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  const row = raw as unknown as RunRow;
  return {
    id: row.id, lifeId: row.life_id, engineVersion: row.engine_version, contentVersion: row.content_version, score: row.score, netWorth: row.net_worth, status: row.status,
    escapedAtRound: row.escaped_at_round, bankruptcies: row.bankruptcies, badges: row.badges ?? [], cities: row.cities ?? [], history: (row.history ?? []).map(Number), finishedAt: row.finished_at,
  };
};

/** An answer that says where a life stands, or null if it is not one. */
const standingOf = (body: unknown): RankedStanding | null =>
  isRecord(body) && typeof body.step === 'number' && isRecord(body.view) && Array.isArray(body.view.timeline) && isRecord(body.record) ? (body as unknown as RankedStanding) : null;

/**
 * The server of ranked lives, as the game's sessions ask for it. What the function answers in
 * numbers and words becomes one of three things here: the answer; "the life is not where you
 * think it is"; or `Unreachable`, for everything that is worth asking again later: no network,
 * a server that is busy or away, a limit reached, versions it does not hold yet.
 */
export function rankedApi(call: RankedCall): RankedApi {
  const ask = async (body: Record<string, unknown>): Promise<{ status: number; body: unknown }> => {
    let reply;
    try {
      reply = await call(body);
    } catch (error) {
      throw new Unreachable(error instanceof Error ? error.message : undefined);
    }
    // Too many calls, or a failure of the server's own: nothing was decided, and it may be asked again.
    if (reply.status === 429 || reply.status >= 500 || reply.status === 401) throw new Unreachable(`the server answered ${reply.status}`);
    return reply;
  };
  const wordOf = (body: unknown): string | null => (isRecord(body) && typeof body.error === 'string' ? body.error : null);

  const step = async (body: Record<string, unknown>): Promise<RankedStep | 'moved'> => {
    const reply = await ask(body);
    if (reply.status !== 200) return 'moved';
    const answer = reply.body;
    if (!isRecord(answer) || typeof answer.step !== 'number' || !isRecord(answer.view) || !isRecord(answer.record) || !Array.isArray(answer.events)) throw new Unreachable('the server answered something that is not a step');
    return { ...(answer as unknown as RankedStep), world: isRecord(answer.world) ? (answer.world as unknown as RankedStep['world']) : null, run: runOf(answer.run) };
  };

  return {
    async start(lifeId, versions) {
      const reply = await ask({ action: 'start', lifeId, engineVersion: versions.engine, contentVersion: versions.content });
      const standing = standingOf(reply.body);
      if (reply.status === 200 && standing !== null && isRecord(reply.body) && typeof reply.body.gameId === 'string') return { ...standing, gameId: reply.body.gameId };
      // A build newer than the server, for the moment between the two being put out: ranked is not to be had yet.
      if (reply.status === 409) throw new Unreachable(`the server cannot start a ranked life: ${wordOf(reply.body) ?? reply.status}`);
      if (wordOf(reply.body) === 'locked-life') throw new Error(`locked life: ${lifeId}`);
      throw new Error(`the server refused to start a ranked life: ${wordOf(reply.body) ?? reply.status}`);
    },
    async view(gameId) {
      const reply = await ask({ action: 'view', gameId });
      const standing = standingOf(reply.body);
      if (reply.status === 200 && standing !== null) return { ...standing, run: runOf((reply.body as Record<string, unknown>).run) };
      // Given up, or nobody's: either way there is no such life to take up.
      if (reply.status === 404 || reply.status === 409) return 'gone';
      throw new Unreachable(`the server answered ${reply.status}`);
    },
    card: (gameId, at, option) => step({ action: 'card', gameId, step: at, option }),
    round: (gameId, at, orders) => step({ action: 'round', gameId, step: at, orders }),
    async abandon(gameId) {
      await ask({ action: 'abandon', gameId });
    },
  };
}
