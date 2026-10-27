import { content, CONTENT_VERSION, lives } from '@ratrace/content';
import { applyCard, applyRound, createGame, ENGINE_VERSION, finalScore, livedStatus, realNetWorth, stateHash } from '@ratrace/engine';
import type { GameState, LoggedRound } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { CURRENT, GAMES } from '../../../supabase/functions/_shared/game/index.ts';
import { readLog, replayRequest } from '../../../supabase/functions/_shared/replay.ts';

const start = lives.find((life) => life.id === 'nurse')?.start;
if (!start) throw new Error('no nurse');

/** `rounds` rounds of a nurse's life, first choice on every card, with the log of it. */
function play(seed: string, rounds: number): { state: GameState; log: LoggedRound[] } {
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
  return { state, log };
}
const ask = (over: Record<string, unknown> = {}, log: unknown = play('server', 2).log) =>
  replayRequest(GAMES, { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 'server', log, ...over });

describe('asking the server to play a game again', () => {
  it('plays it and says where it stands, with the same hash the device has', () => {
    const { state, log } = play('server', 2);
    const reply = ask({}, log);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse',
      round: 2, finished: false, hash: stateHash(state), score: null, netWorth: realNetWorth(state), status: livedStatus(state),
    });
  });

  it('gives the score of a life lived to the end, and only then', { timeout: 60_000 }, () => {
    const { state, log } = play('whole', content.rounds);
    const reply = replayRequest(GAMES, { engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION, lifeId: 'nurse', seed: 'whole', log });
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ finished: true, round: content.rounds, hash: stateHash(state), score: finalScore(content, state) });
  });

  it('refuses versions it does not hold, and says which it does', () => {
    const reply = ask({ engineVersion: '9.9.9' });
    expect(reply.status).toBe(409);
    // Every pair the server still holds: the one of this checkout, and the older ones lives were started on.
    const held = (reply.body as { versions: string[] }).versions;
    expect(reply.body).toEqual({ error: 'unknown-version', versions: held });
    expect(held).toContain(`${ENGINE_VERSION}/${CONTENT_VERSION}`);
    expect(held).toContain('0.36.0/1.37.0');
    // Retired rules are not held by the server (`retired.json`), though the site and the app still finish a life under them.
    expect(held).not.toContain('0.35.0/1.36.0');
    expect(held).not.toContain('9.9.9/' + CONTENT_VERSION);
    // A name that is on every object is not a version.
    expect(ask({ engineVersion: 'constructor', contentVersion: 'prototype' }).status).toBe(409);
  });

  it('refuses a life that does not exist', () => {
    expect(ask({ lifeId: 'pirate' })).toEqual({ status: 400, body: { error: 'unknown-life' } });
  });

  it('refuses what is not a request, each fault by name', () => {
    expect(replayRequest(GAMES, null)).toEqual({ status: 400, body: { error: 'bad-request', field: 'body' } });
    expect(replayRequest(GAMES, [1, 2])).toEqual({ status: 400, body: { error: 'bad-request', field: 'body' } });
    expect(ask({ seed: '' }).body).toEqual({ error: 'bad-request', field: 'seed' });
    expect(ask({ seed: 'x'.repeat(81) }).body).toEqual({ error: 'bad-request', field: 'seed' });
    expect(ask({ seed: 7 }).body).toEqual({ error: 'bad-request', field: 'seed' });
    expect(ask({ lifeId: '' }).body).toEqual({ error: 'bad-request', field: 'lifeId' });
    expect(ask({ engineVersion: undefined }).body).toEqual({ error: 'bad-request', field: 'engineVersion' });
    expect(ask({ contentVersion: 'v'.repeat(21) }).body).toEqual({ error: 'bad-request', field: 'contentVersion' });
    expect(ask({}, 'not a log').body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: [0], orders: [] }, 'nope']).body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: [0.5], orders: [] }]).body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: [-1], orders: [] }]).body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: 'all', orders: [] }]).body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: [], orders: {} }]).body).toEqual({ error: 'bad-request', field: 'log' });
  });

  it('refuses a log too long to be a life, before playing any of it', () => {
    const round = { picks: [], orders: [] };
    expect(ask({}, Array.from({ length: content.rounds + 1 }, () => round)).body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: Array.from({ length: 21 }, () => 0), orders: [] }]).body).toEqual({ error: 'bad-request', field: 'log' });
    expect(ask({}, [{ picks: [], orders: Array.from({ length: content.maxOrdersPerRound + 1 }, () => ({ type: 'focus', action: 'overtime' })) }]).body).toEqual({ error: 'bad-request', field: 'log' });
  });

  it('says so when the log could not have been played, instead of failing', () => {
    const { log } = play('server', 1);
    const impossible = ask({}, [{ picks: [...log[0].picks, 0, 0, 0, 0, 0, 0, 0], orders: [] }]);
    expect(impossible.status).toBe(422);
    expect(impossible.body).toEqual({ error: 'cannot-replay' });
    const garbled = ask({}, [{ picks: log[0].picks, orders: [{ type: 'buy' }, 'nonsense', null] }]);
    expect([200, 422]).toContain(garbled.status);
    // A choice that is not open is the first choice: that is the engine's own rule for what a client sends, here as in the browser.
    const stray = ask({}, [{ picks: [99, ...log[0].picks.slice(1)], orders: [] }]);
    expect(stray.status).toBe(200);
    expect(stray.body.hash).toBe(ask({}, [{ picks: [0, ...log[0].picks.slice(1)], orders: [] }]).body.hash);
  });

  it('is a different game under another seed', () => {
    const { state, log } = play('server', 2);
    const other = ask({ seed: 'another' }, log);
    if (other.status === 200) expect(other.body.hash).not.toBe(stateHash(state));
    else expect(other.status).toBe(422);
  });
});

describe('room events in a log', () => {
  const game = GAMES[CURRENT];
  const entry = { picks: [0], orders: [], room: [{ kind: 'teased', by: 'someone' }] };

  it('are left out of any log but one the rooms function reads', () => {
    expect(readLog([entry], game)).toEqual([{ picks: [0], orders: [] }]);
    expect(readLog([entry], game, true)).toEqual([entry]);
  });

  it('make a room log no log when they are not ones', () => {
    for (const room of [{}, [{ kind: 'gift', by: 'x' }], [{ kind: 'teased', by: '' }], Array.from({ length: 17 }, () => ({ kind: 'teased', by: 'x' }))]) {
      expect(readLog([{ ...entry, room }], game, true)).toBeNull();
    }
  });
});
