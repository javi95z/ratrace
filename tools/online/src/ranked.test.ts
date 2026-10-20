import { challengeOf, challengeStart, content, CONTENT_VERSION, lives, replayLife, weekOf } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, livedStatus, realNetWorth, viewOf } from '@ratrace/engine';
import type { GameState, GameView, LoggedRound, Order, WorldState } from '@ratrace/engine';
import { describe, expect, it, vi } from 'vitest';
import { GAMES } from '../../../supabase/functions/_shared/game/index.ts';
import { dayOfServer, ranked, weekOfServer } from '../../../supabase/functions/_shared/ranked.ts';
import type { RankedDeps, RankedGameRow } from '../../../supabase/functions/_shared/ranked.ts';
import type { RunRow } from '../../../supabase/functions/_shared/finish.ts';

// Several tests here play a whole life: a second and a half alone, and past the usual five on a busy machine.
vi.setConfig({ testTimeout: 60_000 });

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VERSIONS = { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION };
const nurse = lives.find((life) => life.id === 'nurse');
const locked = lives.find((life) => life.unlock !== 'default');
if (!nurse || !locked) throw new Error('the content has no nurse, or no locked life');

/** The database a ranked life needs, kept in memory, with switches for what can go wrong. */
function fakeDb() {
  const games = new Map<string, RankedGameRow>();
  const seeds = new Map<string, string>();
  const runs: RunRow[] = [];
  // The weekly challenges: each week's seed, who has had their attempt, and what each attempt chose.
  const weekSeeds = new Map<string, string>();
  const entries = new Map<string, string>();
  const picks = new Map<string, Array<{ week: string; cardId: string; option: number }>>();
  const state = { ids: 0, clock: 0, allowed: true, unlocked: [] as string[], asked: [] as string[], beatenOnce: false, writes: 0, runsFail: false };
  const stamp = () => `2026-10-13T12:00:${String((state.clock += 1)).padStart(2, '0')}.000000+00:00`;
  const deps: RankedDeps = {
    current: `${ENGINE_VERSION}/${CONTENT_VERSION}`,
    allow: async (_user, kind) => {
      state.asked.push(kind);
      return state.allowed;
    },
    newId: () => `00000000-0000-4000-8000-${String((state.ids += 1)).padStart(12, '0')}`,
    newSeed: () => state.ids.toString(16).padStart(2, '0').repeat(32),
    now: () => new Date('2026-10-13T12:00:00.000Z'),
    unlockedLives: async () => state.unlocked,
    playingRanked: async (user) => structuredClone([...games.values()].find((game) => game.user_id === user && game.mode === 'ranked' && game.status === 'playing') ?? null),
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
      // Someone else wrote the row since it was read: once, when the test says so.
      if (state.beatenOnce) {
        state.beatenOnce = false;
        return false;
      }
      if (!game || game.updated_at !== asRead) return false;
      state.writes += 1;
      Object.assign(game, { log: structuredClone(log), round, updated_at: stamp() });
      return true;
    },
    saveRun: async (run) => {
      if (state.runsFail) throw new Error('the run could not be written');
      if (!runs.some((one) => one.id === run.id)) runs.push(run);
    },
    closeGame: async (id, round, status) => {
      const game = games.get(id);
      if (game) Object.assign(game, { status, round, updated_at: stamp() });
    },
  };
  return { deps, games, seeds, runs, state, weekSeeds, entries, picks };
}
type Db = ReturnType<typeof fakeDb>;

const ask = (db: Db, body: unknown, user = ME, games = GAMES) => ranked(games, db.deps, user, body);
/** A life played to its last round, whose run the server could not write: over in all but name. */
async function overAndUnwritten(db: Db): Promise<Standing> {
  let at = await begin(db);
  db.state.runsFail = true;
  for (;;) {
    const reply = await ask(db, at.view.phase === 'cards' ? card(at) : round(at));
    if (reply.status !== 200) {
      expect(reply).toEqual({ status: 500, body: { error: 'server' } });
      break;
    }
    at = after(at, reply.body);
  }
  db.state.runsFail = false;
  expect(db.games.get(at.gameId)?.status).toBe('playing');
  expect(db.runs).toEqual([]);
  return at;
}

interface Standing {
  gameId: string;
  step: number;
  view: GameView;
}
/** What a client holds after an answer: the view it had, with what the answer says has changed. */
function after(before: Standing, body: Record<string, unknown>): Standing {
  const view = body.view as Omit<GameView, 'timeline'>;
  const world = body.world as WorldState | null;
  return { gameId: before.gameId, step: body.step as number, view: { ...view, timeline: world ? [...before.view.timeline, world] : before.view.timeline } as GameView };
}
async function begin(db: Db, lifeId = 'nurse', user = ME): Promise<Standing> {
  const reply = await ask(db, { action: 'start', lifeId, ...VERSIONS }, user);
  expect(reply.status).toBe(200);
  return { gameId: reply.body.gameId as string, step: reply.body.step as number, view: reply.body.view as GameView };
}
const card = (at: Standing, option: unknown = 0) => ({ action: 'card', gameId: at.gameId, step: at.step, option });
const round = (at: Standing, orders: unknown = []) => ({ action: 'round', gameId: at.gameId, step: at.step, orders });
/** Takes the next step of a life the plain way: the first choice of a card, or a round with no orders. */
async function step(db: Db, at: Standing): Promise<{ at: Standing; body: Record<string, unknown> }> {
  const reply = await ask(db, at.view.phase === 'cards' ? card(at) : round(at));
  expect(reply.status).toBe(200);
  return { at: after(at, reply.body), body: reply.body };
}

describe('starting a ranked life', () => {
  it('makes a game whose seed only the server holds, and answers the view a client may have of it', async () => {
    const db = fakeDb();
    const reply = await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS });
    expect(reply.status).toBe(200);
    const { gameId, step: at, view, record } = reply.body as { gameId: string; step: number; view: GameView; record: { history: number[]; bankruptcies: number } };
    expect(at).toBe(0);
    expect(db.games.get(gameId)).toMatchObject({ user_id: ME, mode: 'ranked', life_id: 'nurse', status: 'playing', round: 0, log: [], engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION });
    // Thirty-two bytes, made by the server. Not in the answer, in any form.
    const seed = db.seeds.get(gameId) as string;
    expect(seed).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(reply.body)).not.toContain(seed);
    expect(view).toEqual(viewOf(createGame({ content, start: nurse.start }, seed)));
    expect(view.timeline).toHaveLength(1);
    expect(Object.keys(view)).not.toContain('seed');
    expect(Object.keys(view)).not.toContain('rng');
    expect(record).toMatchObject({ history: [realNetWorth(createGame({ content, start: nurse.start }, seed))], bankruptcies: 0 });
  });

  it('ends the ranked life in progress only when told which: a player has one, and is asked before it is given up', async () => {
    const db = fakeDb();
    let first = await begin(db);
    for (let i = 0; i < 5; i++) first = (await step(db, first)).at;
    const playing = db.games.get(first.gameId) as RankedGameRow;
    // Asked for a new life, the server says which one is in the way, and touches nothing.
    const question = { status: 409, body: { error: 'in-progress', gameId: first.gameId, lifeId: 'nurse', round: playing.round, ...VERSIONS } };
    expect(await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS })).toEqual(question);
    // Naming another life is not an answer to the question.
    expect(await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS, replace: '99999999-9999-4999-8999-999999999999' })).toEqual(question);
    expect(await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS, replace: 'that one' })).toEqual({ status: 400, body: { error: 'bad-request', field: 'replace' } });
    expect(db.games.size).toBe(1);
    expect(db.games.get(first.gameId)?.status).toBe('playing');
    // Told which, it gives that one up and makes the new one.
    const reply = await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS, replace: first.gameId });
    expect(reply.status).toBe(200);
    expect(db.games.get(first.gameId)?.status).toBe('abandoned');
    expect(db.games.get(reply.body.gameId as string)?.status).toBe('playing');
    // Another player's is not touched, and is not in anyone else's way.
    const theirs = await begin(db, 'nurse', OTHER);
    expect(db.games.get(reply.body.gameId as string)?.status).toBe('playing');
    expect(db.games.get(theirs.gameId)?.user_id).toBe(OTHER);
    // With nothing in progress, a life named to be replaced is no obstacle.
    await ask(db, { action: 'abandon', gameId: theirs.gameId }, OTHER);
    expect((await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS, replace: theirs.gameId }, OTHER)).status).toBe(200);
  });

  it('settles a life that is over, in place of asking about it or giving it up, when its run was never written', async () => {
    const db = fakeDb();
    const over = await overAndUnwritten(db);
    // The new life begins with no question: nothing was in progress, whatever the row said.
    const reply = await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS });
    expect(reply.status).toBe(200);
    expect(db.games.get(over.gameId)?.status).toBe('finished');
    expect(db.runs.map((run) => run.id)).toEqual([over.gameId]);
    expect(db.runs[0]).toMatchObject({ mode: 'ranked', verified: true });
  });

  it('starts a ranked life only under the rules the server plays now, whatever older ones it still holds', async () => {
    const db = fakeDb();
    // A later pair of versions is the current one. The pair of this test is still held, and can still be played to its end.
    const games = { ...GAMES, '99.0.0/99.0.0': GAMES[`${ENGINE_VERSION}/${CONTENT_VERSION}`] };
    const held = await begin(db);
    db.deps.current = '99.0.0/99.0.0';
    expect((await ask(db, card(held), ME, games)).status).toBe(200);
    expect(await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS, replace: held.gameId }, ME, games)).toEqual({ status: 409, body: { error: 'cannot-rank' } });
    expect(db.games.get(held.gameId)?.status).toBe('playing');
    expect((await ask(db, { action: 'start', lifeId: 'nurse', engineVersion: '99.0.0', contentVersion: '99.0.0', replace: held.gameId }, ME, games)).status).toBe(200);
  });

  it('refuses versions it does not hold, and versions whose seed could be found by trying', async () => {
    const db = fakeDb();
    expect(await ask(db, { action: 'start', lifeId: 'nurse', engineVersion: '9.9.9', contentVersion: CONTENT_VERSION })).toMatchObject({ status: 409, body: { error: 'unknown-version' } });
    // Rules whose seed could be found by trying (before 0.10) are no longer held at all: retired, they are as unknown as any.
    expect(Object.keys(GAMES)).not.toContain('0.9.0/1.9.0');
    expect(await ask(db, { action: 'start', lifeId: 'nurse', engineVersion: '0.9.0', contentVersion: '1.9.0' })).toMatchObject({ status: 409, body: { error: 'unknown-version' } });
    expect(db.games.size).toBe(0);
  });

  it('refuses a life that does not exist, and one the player has not unlocked', async () => {
    const db = fakeDb();
    expect(await ask(db, { action: 'start', lifeId: 'pirate', ...VERSIONS })).toEqual({ status: 400, body: { error: 'unknown-life' } });
    expect(await ask(db, { action: 'start', lifeId: locked.id, ...VERSIONS })).toEqual({ status: 403, body: { error: 'locked-life' } });
    expect(db.games.size).toBe(0);
    db.state.unlocked = [locked.id];
    expect((await ask(db, { action: 'start', lifeId: locked.id, ...VERSIONS })).status).toBe(200);
  });

  it('counts new lives, and makes none beyond what a player is allowed', async () => {
    const db = fakeDb();
    db.state.allowed = false;
    expect(await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(db.state.asked).toEqual(['ranked-start']);
    expect(db.games.size).toBe(0);
    // It is counted before anything is looked up: a life that does not exist, or is locked, costs a call too.
    expect(await ask(db, { action: 'start', lifeId: 'pirate', ...VERSIONS })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(await ask(db, { action: 'start', lifeId: locked.id, ...VERSIONS })).toEqual({ status: 429, body: { error: 'too-many' } });
  });

  it('refuses what is not a request, each fault by name', async () => {
    const db = fakeDb();
    expect(await ask(db, null)).toEqual({ status: 400, body: { error: 'bad-request', field: 'body' } });
    expect(await ask(db, { action: 'dance' })).toEqual({ status: 400, body: { error: 'bad-request', field: 'action' } });
    expect(await ask(db, { action: 'start', lifeId: 7, ...VERSIONS })).toEqual({ status: 400, body: { error: 'bad-request', field: 'lifeId' } });
    expect(await ask(db, { action: 'start', lifeId: 'nurse', engineVersion: ENGINE_VERSION })).toEqual({ status: 400, body: { error: 'bad-request', field: 'contentVersion' } });
    expect(await ask(db, { action: 'card', gameId: 'not-an-id', step: 0, option: 0 })).toEqual({ status: 400, body: { error: 'bad-request', field: 'gameId' } });
  });
});

describe('playing a ranked life', { timeout: 120_000 }, () => {
  it('plays a whole life a step at a time, to the very end the engine gives those choices, and writes the run itself', async () => {
    const db = fakeDb();
    let at = await begin(db);
    const seed = db.seeds.get(at.gameId) as string;
    // The same choices, played here with the seed the server kept.
    let mine: GameState = createGame({ content, start: nurse.start }, seed);
    const log: LoggedRound[] = [];
    let picks: number[] = [];
    let last: Record<string, unknown> = {};
    while (!at.view.finished) {
      if (mine.phase === 'cards') {
        mine = applyCard(content, mine, 0).state;
        picks.push(0);
      } else {
        mine = applyRound(content, mine, { orders: [] }).state;
        log.push({ picks, orders: [] });
        picks = [];
      }
      const taken = await step(db, at);
      at = taken.at;
      last = taken.body;
      // What the client holds after every step is exactly what it may hold of the game as it stands.
      expect(at.view).toEqual(viewOf(mine));
      expect(JSON.stringify(taken.body)).not.toContain(seed);
    }
    expect(mine.finished).toBe(true);
    const whole = replayLife(content, nurse.start, seed, log);
    expect(db.runs).toEqual([
      {
        id: at.gameId, user_id: ME, game_id: at.gameId, mode: 'ranked', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION,
        score: finalScore(content, mine), net_worth: realNetWorth(mine), status: livedStatus(mine), escaped_at_round: mine.player.escapedAtRound,
        bankruptcies: whole.bankruptcies, badges: whole.journal.earned, cities: whole.journal.cities, history: whole.history, verified: true, finished_at: '2026-10-13T12:00:00.000Z', challenge: null,
      },
    ]);
    expect(last.run).toEqual(db.runs[0]);
    expect(last.record).toEqual({ history: whole.history, bankruptcies: whole.bankruptcies, journal: whole.journal });
    expect(db.games.get(at.gameId)).toMatchObject({ status: 'finished', round: content.rounds, log });
    // A life that is over takes no more steps.
    expect(await ask(db, round(at))).toEqual({ status: 409, body: { error: 'closed' } });
    expect(db.runs).toHaveLength(1);
  });

  it('answers a card with what changed, and a round with the one new world: never a world to come', async () => {
    const db = fakeDb();
    let at = await begin(db);
    expect(at.view.phase).toBe('cards');
    const answered = await step(db, at);
    // A card turns no round: the timeline the client holds is not sent again, and nothing is added to it.
    expect(answered.body.world).toBeNull();
    expect(Object.keys(answered.body.view as object)).not.toContain('timeline');
    expect((answered.body.events as unknown[]).length).toBeGreaterThan(0);
    expect(answered.body.step).toBe(1);
    at = answered.at;
    while (at.view.phase === 'cards') at = (await step(db, at)).at;
    const played = await step(db, at);
    expect((played.body.world as WorldState).round).toBe(1);
    expect(played.at.view.timeline).toHaveLength(2);
    expect(played.at.view.round).toBe(1);
    expect((played.body.record as { history: number[] }).history).toHaveLength(2);
  });

  it('plays the orders of a round as the engine does, and tells the client what they did', async () => {
    const db = fakeDb();
    let at = await begin(db);
    while (at.view.phase === 'cards') at = (await step(db, at)).at;
    const cash = at.view.player.cash;
    const orders: Order[] = [{ type: 'depositIn', amount: Math.floor(cash / 2) }];
    const reply = await ask(db, round(at, orders));
    expect(reply.status).toBe(200);
    const seed = db.seeds.get(at.gameId) as string;
    const mine = replayLife(content, nurse.start, seed, db.games.get(at.gameId)?.log as LoggedRound[]);
    expect(after(at, reply.body).view).toEqual(viewOf(mine.state));
    expect((db.games.get(at.gameId)?.log as LoggedRound[])[0].orders).toEqual(orders);
  });

  it('answers again, and plays nothing twice, when the same step is asked for again with the same choice', async () => {
    // The answer was lost on its way back. The client does not know whether the step was taken.
    const db = fakeDb();
    const at = await begin(db);
    const first = await ask(db, card(at));
    const writes = db.state.writes;
    const again = await ask(db, card(at));
    expect(again).toEqual(first);
    expect(db.state.writes).toBe(writes);
    expect((db.games.get(at.gameId)?.log as LoggedRound[])[0].picks).toEqual([0]);
    // The same for a round, and for the round that ends the life, whose game is closed by then.
    let now = after(at, first.body);
    while (now.view.phase === 'cards') now = (await step(db, now)).at;
    const played = await ask(db, round(now));
    expect(await ask(db, round(now))).toEqual(played);
  });

  it('says where the life stands when a step is asked for that is not the next, or was taken with another choice', async () => {
    const db = fakeDb();
    const at = await begin(db);
    const taken = await ask(db, card(at, 0));
    const log = structuredClone(db.games.get(at.gameId)?.log);
    // The same step again, with another answer: the first one stands.
    expect(await ask(db, card(at, 1))).toEqual({ status: 409, body: { error: 'out-of-step', step: 1 } });
    // The same for a round: other orders are another choice, not the same step asked for again.
    {
      const other = fakeDb();
      let now = await begin(other);
      while (now.view.phase === 'cards') now = (await step(other, now)).at;
      expect((await ask(other, round(now, []))).status).toBe(200);
      expect(await ask(other, round(now, [{ type: 'depositIn', amount: 1 }]))).toEqual({ status: 409, body: { error: 'out-of-step', step: now.step + 1 } });
    }
    // A step from the future, and one from further back than the last.
    expect(await ask(db, card({ ...at, step: 5 }))).toEqual({ status: 409, body: { error: 'out-of-step', step: 1 } });
    const next = after(at, taken.body);
    const further = await ask(db, next.view.phase === 'cards' ? card(next) : round(next));
    expect(further.status).toBe(200);
    expect(await ask(db, card(at, 0))).toEqual({ status: 409, body: { error: 'out-of-step', step: 2 } });
    expect((db.games.get(at.gameId)?.log as LoggedRound[])[0].picks.slice(0, 1)).toEqual((log as LoggedRound[])[0].picks);
  });

  it('takes one of two steps that arrive at once, and tells the other to look again', async () => {
    const db = fakeDb();
    const at = await begin(db);
    // Two answers to the same card, sent together: both are read from the same row, and one is written.
    const both = await Promise.all([ask(db, card(at, 0)), ask(db, card(at, 1))]);
    expect(both.map((reply) => reply.status).sort()).toEqual([200, 409]);
    expect(both.find((reply) => reply.status === 409)?.body).toMatchObject({ error: 'out-of-step' });
    expect(db.state.writes).toBe(1);
    expect((db.games.get(at.gameId)?.log as LoggedRound[])[0].picks).toHaveLength(1);
    // And when someone else writes the row between the reading and the writing, nothing is played over it.
    const next = await ask(db, { action: 'view', gameId: at.gameId });
    db.state.beatenOnce = true;
    expect(await ask(db, card({ ...at, step: next.body.step as number }))).toEqual({ status: 409, body: { error: 'out-of-step', step: 1 } });
    expect((db.games.get(at.gameId)?.log as LoggedRound[])[0].picks).toHaveLength(1);
  });

  it('plays a choice that is not open as the first, as the engine always has, and refuses orders that are not orders', async () => {
    const db = fakeDb();
    const at = await begin(db);
    const reply = await ask(db, card(at, 99));
    expect(reply.status).toBe(200);
    const seed = db.seeds.get(at.gameId) as string;
    expect(after(at, reply.body).view).toEqual(viewOf(applyCard(content, createGame({ content, start: nurse.start }, seed), 99).state));
    for (const option of [-1, 1.5, 'first', null]) {
      const fresh = fakeDb();
      const start = await begin(fresh);
      await ask(fresh, card(start, option));
      expect((fresh.games.get(start.gameId)?.log as LoggedRound[])[0].picks, String(option)).toEqual([0]);
    }
    let now = after(at, reply.body);
    while (now.view.phase === 'cards') now = (await step(db, now)).at;
    expect(await ask(db, round(now, 'everything'))).toEqual({ status: 400, body: { error: 'bad-request', field: 'orders' } });
    expect(await ask(db, round(now, Array.from({ length: content.maxOrdersPerRound + 1 }, () => ({ type: 'depositIn', amount: 1 }))))).toEqual({ status: 400, body: { error: 'bad-request', field: 'orders' } });
    expect(await ask(db, { action: 'round', gameId: now.gameId, step: 'next', orders: [] })).toEqual({ status: 400, body: { error: 'bad-request', field: 'step' } });
  });

  it('refuses a card when none is waiting, without writing anything', async () => {
    const db = fakeDb();
    let at = await begin(db);
    while (at.view.phase === 'cards') at = (await step(db, at)).at;
    const log = structuredClone(db.games.get(at.gameId)?.log);
    expect(await ask(db, card(at))).toEqual({ status: 422, body: { error: 'cannot-play' } });
    expect(db.games.get(at.gameId)?.log).toEqual(log);
  });

  it('knows nothing of a life that is someone else\'s, is casual, or does not exist', async () => {
    const db = fakeDb();
    const at = await begin(db);
    const unknown = { status: 404, body: { error: 'unknown-game' } };
    expect(await ask(db, card(at), OTHER)).toEqual(unknown);
    expect(await ask(db, { action: 'view', gameId: at.gameId }, OTHER)).toEqual(unknown);
    expect(await ask(db, { action: 'abandon', gameId: at.gameId }, OTHER)).toEqual(unknown);
    expect(await ask(db, card({ ...at, gameId: '99999999-9999-4999-8999-999999999999' }))).toEqual(unknown);
    (db.games.get(at.gameId) as RankedGameRow).mode = 'casual';
    expect(await ask(db, card(at))).toEqual(unknown);
    expect(db.games.get(at.gameId)?.log).toEqual([]);
  });

  it('counts steps, and plays none beyond what a player is allowed', async () => {
    const db = fakeDb();
    const at = await begin(db);
    db.state.allowed = false;
    db.state.asked.length = 0;
    expect(await ask(db, card(at))).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(await ask(db, { action: 'view', gameId: at.gameId })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(db.state.asked).toEqual(['ranked-step', 'ranked-step']);
    expect(db.games.get(at.gameId)?.log).toEqual([]);
    // Every call is counted before anything is looked up: giving a life up, and asking about one that does not exist.
    expect(await ask(db, { action: 'abandon', gameId: at.gameId })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(await ask(db, { action: 'view', gameId: '99999999-9999-4999-8999-999999999999' })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(db.games.get(at.gameId)?.status).toBe('playing');
  });
});

describe('looking at a ranked life, and giving it up', { timeout: 120_000 }, () => {
  it('answers the whole view, the record and how far the life has been played', async () => {
    const db = fakeDb();
    let at = await begin(db);
    for (let i = 0; i < 6; i++) at = (await step(db, at)).at;
    const reply = await ask(db, { action: 'view', gameId: at.gameId });
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ gameId: at.gameId, lifeId: 'nurse', ...VERSIONS, status: 'playing', step: 6 });
    expect(reply.body.view).toEqual(at.view);
    const seed = db.seeds.get(at.gameId) as string;
    expect(JSON.stringify(reply.body)).not.toContain(seed);
    const whole = replayLife(content, nurse.start, seed, db.games.get(at.gameId)?.log as LoggedRound[]);
    expect(reply.body.record).toEqual({ history: whole.history, bankruptcies: whole.bankruptcies, journal: whole.journal });
  });

  it('finishes a life whose last round was played and whose run was never written', async () => {
    // The server stopped between the two writes. Whoever looks at the life next finds it over, and the run is written then.
    const db = fakeDb();
    let at = await begin(db);
    while (!at.view.finished) at = (await step(db, at)).at;
    const run = db.runs.pop();
    (db.games.get(at.gameId) as RankedGameRow).status = 'playing';
    const reply = await ask(db, { action: 'view', gameId: at.gameId });
    expect(reply.body).toMatchObject({ status: 'finished', run });
    expect(db.runs).toEqual([run]);
    expect(db.games.get(at.gameId)?.status).toBe('finished');
  });

  it('gives a life up when asked, once and for all', async () => {
    const db = fakeDb();
    const at = await begin(db);
    expect(await ask(db, { action: 'abandon', gameId: at.gameId })).toEqual({ status: 200, body: {} });
    expect(db.games.get(at.gameId)?.status).toBe('abandoned');
    expect(await ask(db, card(at))).toEqual({ status: 409, body: { error: 'closed' } });
    expect(await ask(db, { action: 'view', gameId: at.gameId })).toEqual({ status: 409, body: { error: 'closed' } });
    // Asked again, it is still given up, and that is not an error.
    expect(await ask(db, { action: 'abandon', gameId: at.gameId })).toEqual({ status: 200, body: {} });
  });

  it('does not give up a life that is over: its result stands', async () => {
    const db = fakeDb();
    let at = await begin(db);
    while (!at.view.finished) at = (await step(db, at)).at;
    expect(await ask(db, { action: 'abandon', gameId: at.gameId })).toEqual({ status: 200, body: {} });
    expect(db.games.get(at.gameId)?.status).toBe('finished');
  });

  it('does not give up a life that is over in all but name: asked to, it writes the run that was never written', async () => {
    const db = fakeDb();
    const over = await overAndUnwritten(db);
    expect(await ask(db, { action: 'abandon', gameId: over.gameId })).toEqual({ status: 200, body: {} });
    expect(db.games.get(over.gameId)?.status).toBe('finished');
    expect(db.runs.map((run) => run.id)).toEqual([over.gameId]);
    // And the device that asks how it stands is told it is over, with its run.
    expect((await ask(db, { action: 'view', gameId: over.gameId })).body).toMatchObject({ status: 'finished', run: { id: over.gameId } });
  });

  it('answers a failure of the database as its own, not as the player\'s mistake', async () => {
    const db = fakeDb();
    const at = await begin(db);
    db.deps.loadGame = async () => {
      throw new Error('the database is away');
    };
    expect(await ask(db, card(at))).toEqual({ status: 500, body: { error: 'server' } });
  });
});

describe('the weekly challenge, as the server plays it', () => {
  // The fake server's clock is Tuesday 13 October 2026: the week of 12 October.
  const WEEK = '2026-W42';
  const TODAY = '2026-10-13';
  const week = challengeOf(WEEK, lives);
  if (!week) throw new Error('no challenge for the week');
  const begin = (db: Db, over: Record<string, unknown> = {}, user = ME) => ask(db, { action: 'start', lifeId: week.lifeId, ...VERSIONS, challenge: WEEK, ...over }, user);

  it('counts its weeks as the game does', () => {
    for (let day = 0; day < 1_000; day += 5) {
      const at = new Date(Date.UTC(2025, 11, 20) + day * 86_400_000 + 3_600_000 * (day % 24));
      expect(weekOfServer(at), at.toISOString()).toBe(weekOf(at.getTime()));
    }
  });

  it('starts the week’s life under the week’s rule on the week’s seed, the same for everyone, whether the life is unlocked or not', async () => {
    const db = fakeDb();
    const mine = await begin(db);
    const theirs = await begin(db, {}, OTHER);
    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);
    const [a, b] = [mine.body.gameId as string, theirs.body.gameId as string];
    expect(db.games.get(a)).toMatchObject({ challenge: WEEK, life_id: week.lifeId, mode: 'ranked' });
    expect(db.seeds.get(a)).toBe(db.weekSeeds.get(WEEK));
    expect(db.seeds.get(b)).toBe(db.seeds.get(a));
    // The same world and the same first cards for both.
    expect(theirs.body.view).toEqual(mine.body.view);
    const life = lives.find((one) => one.id === week.lifeId)!;
    expect((mine.body.view as GameView).limits).toEqual(challengeStart(week, life).limits ?? {});
    expect([...db.entries.keys()].sort()).toEqual([`${ME}/${WEEK}/${TODAY}`, `${OTHER}/${WEEK}/${TODAY}`]);
  });

  it('refuses a week that is not this one, something that is not a week, and another life than the week’s', async () => {
    const db = fakeDb();
    expect(await begin(db, { challenge: '2026-W41' })).toEqual({ status: 409, body: { error: 'challenge-closed' } });
    expect(await begin(db, { challenge: 'this week' })).toEqual({ status: 400, body: { error: 'bad-request', field: 'challenge' } });
    const other = lives.find((one) => one.id !== week.lifeId)!;
    expect(await begin(db, { lifeId: other.id })).toEqual({ status: 400, body: { error: 'unknown-life' } });
    expect(db.games.size).toBe(0);
    expect(db.entries.size).toBe(0);
  });

  it('gives each player one attempt a day, and a second the same day ends nothing in progress', async () => {
    const db = fakeDb();
    const first = await begin(db);
    expect(first.status).toBe(200);
    await ask(db, { action: 'abandon', gameId: first.body.gameId });
    const living = await ask(db, { action: 'start', lifeId: 'nurse', ...VERSIONS });
    expect(living.status).toBe(200);
    expect(await begin(db, { replace: living.body.gameId })).toEqual({ status: 409, body: { error: 'challenge-played' } });
    expect(db.games.get(living.body.gameId as string)?.status).toBe('playing');
  });

  it('gives another attempt the next day, on the same seed of the week', async () => {
    const db = fakeDb();
    const first = await begin(db);
    await ask(db, { action: 'abandon', gameId: first.body.gameId });
    // The next day by the server's clock, a minute past midnight: still the same week.
    db.deps.now = () => new Date('2026-10-14T00:01:00.000Z');
    const second = await begin(db);
    expect(second.status).toBe(200);
    expect(db.seeds.get(second.body.gameId as string)).toBe(db.seeds.get(first.body.gameId as string));
    expect([...db.entries.keys()].sort()).toEqual([`${ME}/${WEEK}/${TODAY}`, `${ME}/${WEEK}/2026-10-14`]);
    expect(await begin(db)).toEqual({ status: 409, body: { error: 'challenge-played' } });
  });

  it('counts its days by UTC, as the database does', () => {
    expect(dayOfServer(new Date('2026-10-13T23:59:59.999Z'))).toBe('2026-10-13');
    expect(dayOfServer(new Date('2026-10-14T00:00:00.000Z'))).toBe('2026-10-14');
  });

  it('gives up at once an attempt that loses the race to one already entered', async () => {
    const db = fakeDb();
    // Another device entered the week between the question and the entry.
    db.deps.challengeEntered = async () => false;
    db.entries.set(`${ME}/${WEEK}/${TODAY}`, 'elsewhere');
    expect(await begin(db)).toEqual({ status: 409, body: { error: 'challenge-played' } });
    expect([...db.games.values()].map((game) => game.status)).toEqual(['abandoned']);
  });

  it('is not started by a version from before the challenges', async () => {
    const db = fakeDb();
    const older = { ...GAMES[`${ENGINE_VERSION}/${CONTENT_VERSION}`] };
    delete older.challengeOf;
    delete older.challengeStart;
    expect(await ask(db, { action: 'start', lifeId: week.lifeId, ...VERSIONS, challenge: WEEK }, ME, { ...GAMES, [`${ENGINE_VERSION}/${CONTENT_VERSION}`]: older })).toEqual({
      status: 409,
      body: { error: 'challenge-closed' },
    });
  });

  it('plays to the end under its rule, and writes the run of the week with every card chosen, in order', async () => {
    const db = fakeDb();
    const started = await begin(db);
    let at: Standing = { gameId: started.body.gameId as string, step: 0, view: started.body.view as GameView };
    const chosen: Array<{ cardId: string; option: number }> = [];
    while (!at.view.finished) {
      const next = await step(db, at);
      for (const event of (next.body.events as Array<{ kind: string; cardId?: string; option?: number }>)) if (event.kind === 'card') chosen.push({ cardId: event.cardId as string, option: event.option as number });
      at = next.at;
    }
    expect(db.runs).toHaveLength(1);
    expect(db.runs[0]).toMatchObject({ mode: 'ranked', challenge: WEEK, life_id: week.lifeId });
    expect(db.picks.get(at.gameId)).toEqual(chosen.map((pick) => ({ week: WEEK, ...pick })));
    expect(chosen.length).toBeGreaterThan(0);
  });
});
