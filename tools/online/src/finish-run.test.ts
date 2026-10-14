import { challengeOf, challengeStart, content, CONTENT_VERSION, lives, replayLife, weekOf } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, livedStatus, realNetWorth } from '@ratrace/engine';
import type { LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { finishRun } from '../../../supabase/functions/_shared/finish.ts';
import type { FinishDeps, GameRow, RunRow } from '../../../supabase/functions/_shared/finish.ts';
import { GAMES } from '../../../supabase/functions/_shared/game/index.ts';

const start = lives.find((life) => life.id === 'nurse')?.start;
if (!start) throw new Error('no nurse');

/** A nurse's life of `rounds` rounds, first choice on every card, and its log. */
function lived(seed: string, rounds: number): LoggedRound[] {
  let state = createGame({ content, start: start as NonNullable<typeof start> }, seed);
  const log: LoggedRound[] = [];
  for (let i = 0; i < rounds; i++) {
    const picks: number[] = [];
    while (state.phase === 'cards') {
      state = applyCard(content, state, 0).state;
      picks.push(0);
    }
    state = applyRound(content, state, { orders: [] }).state;
    log.push({ picks, orders: [] });
  }
  return log;
}
const WHOLE = lived('finished-life', content.rounds);
const GAME = '11111111-1111-4111-8111-111111111111';
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const game = (over: Partial<GameRow> = {}): GameRow => ({
  id: GAME, user_id: ME, mode: 'casual', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION, seed: 'finished-life', round: content.rounds, status: 'playing', log: WHOLE, challenge: null, ...over,
});

/** A database of one game and whatever runs get written, remembering what was asked of it. */
function fakeDb(row: GameRow | null, runs: RunRow[] = []) {
  const closed: Array<{ id: string; round: number }> = [];
  const deps: FinishDeps = {
    loadGame: async (id) => (row && row.id === id ? row : null),
    loadRun: async (id) => runs.find((run) => run.id === id) ?? null,
    saveRun: async (run) => {
      if (!runs.some((one) => one.id === run.id)) runs.push(run);
    },
    closeGame: async (id, round) => {
      closed.push({ id, round });
    },
    now: () => new Date('2026-10-13T12:00:00.000Z'),
  };
  return { deps, runs, closed };
}

describe('finishing a life on the server', { timeout: 60_000 }, () => {
  it('plays the log again and writes the run itself, every figure the engine\'s own', async () => {
    const db = fakeDb(game());
    const reply = await finishRun(GAMES, db.deps, ME, { gameId: GAME });
    expect(reply.status).toBe(200);
    const mine = replayLife(content, start, 'finished-life', WHOLE);
    expect(db.runs).toEqual([
      {
        id: GAME, user_id: ME, game_id: GAME, mode: 'casual', life_id: 'nurse', engine_version: ENGINE_VERSION, content_version: CONTENT_VERSION,
        score: finalScore(content, mine.state), net_worth: realNetWorth(mine.state), status: livedStatus(mine.state), escaped_at_round: mine.state.player.escapedAtRound,
        bankruptcies: mine.bankruptcies, badges: mine.journal.earned, cities: mine.journal.cities, history: mine.history, verified: true, finished_at: '2026-10-13T12:00:00.000Z', challenge: null,
      },
    ]);
    expect(reply.body).toEqual({ run: db.runs[0] });
    // The game is closed: it cannot be saved over once its run exists.
    expect(db.closed).toEqual([{ id: GAME, round: content.rounds }]);
    expect(db.runs[0].history).toHaveLength(content.rounds + 1);
  });

  it('writes once however often it is asked, and answers the same', async () => {
    const db = fakeDb(game());
    const first = await finishRun(GAMES, db.deps, ME, { gameId: GAME });
    const again = await finishRun(GAMES, db.deps, ME, { gameId: GAME });
    expect(db.runs).toHaveLength(1);
    expect(again).toEqual(first);
  });

  it('takes nothing from the client but the name of the game: a score sent along is ignored', async () => {
    const db = fakeDb(game());
    await finishRun(GAMES, db.deps, ME, { gameId: GAME, score: 999_999, run: { score: 999_999 } });
    expect(db.runs[0].score).toBe(finalScore(content, replayLife(content, start, 'finished-life', WHOLE).state));
  });

  it('knows nothing of a game that is someone else\'s, and says the same as for one that does not exist', async () => {
    const theirs = await finishRun(GAMES, fakeDb(game({ user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })).deps, ME, { gameId: GAME });
    const none = await finishRun(GAMES, fakeDb(null).deps, ME, { gameId: GAME });
    expect(theirs).toEqual({ status: 404, body: { error: 'unknown-game' } });
    expect(none).toEqual(theirs);
  });

  it('closes a game that was left open when its run was written: asked again, it finishes the job', async () => {
    // The run was written and the database failed before the game was marked. Left so, the life would stand
    // in the account for ever as one being played, and be offered to the player's other devices.
    const first = fakeDb(game());
    await finishRun(GAMES, first.deps, ME, { gameId: GAME });
    const again = fakeDb(game({ status: 'playing' }), first.runs);
    const reply = await finishRun(GAMES, again.deps, ME, { gameId: GAME });
    expect(reply).toEqual({ status: 200, body: { run: first.runs[0] } });
    expect(again.closed.map((one) => one.id)).toEqual([GAME]);
    expect(again.runs).toHaveLength(1);
    // One that is closed already is left alone.
    const done = fakeDb(game({ status: 'finished' }), first.runs);
    await finishRun(GAMES, done.deps, ME, { gameId: GAME });
    expect(done.closed).toEqual([]);
  });

  it('does not answer with someone else\'s run, whatever id is asked for', async () => {
    const theirs = fakeDb(game({ user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
    await finishRun(GAMES, theirs.deps, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', { gameId: GAME });
    expect(theirs.runs).toHaveLength(1);
    // The run exists, and so does the game; neither is the caller's.
    const reply = await finishRun(GAMES, theirs.deps, ME, { gameId: GAME });
    expect(reply).toEqual({ status: 404, body: { error: 'unknown-game' } });
    expect(theirs.runs).toHaveLength(1);
    expect(theirs.closed).toHaveLength(1);
  });

  it('does not finish a life that is not over', async () => {
    const db = fakeDb(game({ log: lived('finished-life', 3) }));
    expect(await finishRun(GAMES, db.deps, ME, { gameId: GAME })).toEqual({ status: 409, body: { error: 'not-finished' } });
    expect(db.runs).toEqual([]);
    expect(db.closed).toEqual([]);
  });

  it('refuses a ranked game, versions it does not hold, a life that does not exist and a log that could not be played', async () => {
    const ask = async (over: Partial<GameRow>) => {
      const db = fakeDb(game(over));
      const reply = await finishRun(GAMES, db.deps, ME, { gameId: GAME });
      expect(db.runs).toEqual([]);
      return reply;
    };
    expect(await ask({ mode: 'ranked', seed: null })).toEqual({ status: 409, body: { error: 'not-casual' } });
    expect((await ask({ engine_version: '9.9.9' })).body).toMatchObject({ error: 'unknown-version' });
    expect(await ask({ life_id: 'pirate' })).toEqual({ status: 422, body: { error: 'cannot-replay' } });
    expect(await ask({ log: 'not a log' })).toEqual({ status: 422, body: { error: 'cannot-replay' } });
    expect(await ask({ log: [{ picks: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], orders: [] }] })).toEqual({ status: 422, body: { error: 'cannot-replay' } });
    expect(await ask({ seed: null })).toEqual({ status: 422, body: { error: 'cannot-replay' } });
  });

  it('refuses what is not a request', async () => {
    const db = fakeDb(game());
    for (const raw of [null, 'x', {}, { gameId: 7 }, { gameId: 'not-an-id' }, { gameId: `${GAME}0` }]) {
      expect(await finishRun(GAMES, db.deps, ME, raw)).toEqual({ status: 400, body: { error: 'bad-request', field: 'gameId' } });
    }
    expect(db.runs).toEqual([]);
  });

  it('answers a failure of the database as its own, not as the player\'s mistake', async () => {
    const db = fakeDb(game());
    const broken: FinishDeps = { ...db.deps, saveRun: async () => { throw new Error('connection lost'); } };
    expect(await finishRun(GAMES, broken, ME, { gameId: GAME })).toEqual({ status: 500, body: { error: 'server' } });
    expect(db.closed).toEqual([]);
  });

  it('plays a practice of a week\u2019s challenge under the week\u2019s rule, and keeps its week on the run', async () => {
    // A week whose challenge is the nurse's life, under a rule that changes how it begins.
    const week = Array.from({ length: 400 }, (_, i) => weekOf(Date.UTC(2026, 0, 5) + i * 7 * 86_400_000))
      .map((each) => challengeOf(each, lives)!)
      .find((each) => each.lifeId === 'nurse' && each.rule === 'startInDebt');
    if (!week) throw new Error('no week of the nurse in debt');
    const under = challengeStart(week, lives.find((life) => life.id === 'nurse')!);
    let state = createGame({ content, start: under }, 'practice');
    const log: LoggedRound[] = [];
    while (!state.finished) {
      const picks: number[] = [];
      while (state.phase === 'cards') {
        state = applyCard(content, state, 0).state;
        picks.push(0);
      }
      state = applyRound(content, state, { orders: [] }).state;
      log.push({ picks, orders: [] });
    }
    const db = fakeDb(game({ seed: 'practice', log, challenge: week.week }));
    const reply = await finishRun(GAMES, db.deps, ME, { gameId: GAME });
    expect(reply.status).toBe(200);
    expect(db.runs[0]).toMatchObject({ mode: 'casual', challenge: week.week, score: finalScore(content, state) });
    // The same log, said to be another week's, is not a life that could have been played.
    const wrong = Array.from({ length: 400 }, (_, i) => weekOf(Date.UTC(2026, 0, 5) + i * 7 * 86_400_000)).find((each) => challengeOf(each, lives)!.lifeId !== 'nurse')!;
    expect(await finishRun(GAMES, fakeDb(game({ seed: 'practice', log, challenge: wrong })).deps, ME, { gameId: GAME })).toEqual({ status: 422, body: { error: 'cannot-replay' } });
  });
});
