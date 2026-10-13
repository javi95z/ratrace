import { describe, expect, it } from 'vitest';
import { Unreachable } from '@/session/errors';
import { rankedApi } from './ranked';
import type { RankedCall } from './ranked';

const view = { round: 0, timeline: [{ round: 0 }], player: {} };
const record = { history: [100], bankruptcies: 0, journal: { earned: [], story: { milestones: [] } } };
const standing = { step: 3, view, record };
const runRow = {
  id: 'run-1', life_id: 'nurse', engine_version: '0.10.0', content_version: '1.9.0', score: 1234, net_worth: 5000, status: 7, escaped_at_round: 12, bankruptcies: 1,
  badges: ['first_home'], cities: ['madrid'], history: ['100', 250], finished_at: '2026-10-13T10:00:00.000Z',
};
const run = {
  id: 'run-1', lifeId: 'nurse', engineVersion: '0.10.0', contentVersion: '1.9.0', score: 1234, netWorth: 5000, status: 7, escapedAtRound: 12, bankruptcies: 1,
  badges: ['first_home'], cities: ['madrid'], history: [100, 250], finishedAt: '2026-10-13T10:00:00.000Z',
};

/** The function, answering what a test says, and remembering what it was asked. */
function server(answer: { status: number; body: unknown } | Error) {
  const asked: Array<Record<string, unknown>> = [];
  const call: RankedCall = async (body) => {
    asked.push(body);
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { api: rankedApi(call), asked };
}
/** Every thing that can be asked of the server, each as a fresh request. */
const everything = (api: ReturnType<typeof rankedApi>) => [
  () => api.start('nurse', { engine: '0.10.0', content: '1.9.0' }),
  () => api.view('g-1'),
  () => api.card('g-1', 0, 1),
  () => api.round('g-1', 3, []),
  () => api.abandon('g-1'),
];

describe('the server of ranked lives, as the game asks for it', () => {
  it('asks each thing in the function\'s own words', async () => {
    const { api, asked } = server({ status: 200, body: { ...standing, gameId: 'g-1', events: [] } });
    await api.start('nurse', { engine: '0.10.0', content: '1.9.0' });
    await api.view('g-1');
    await api.card('g-1', 4, 2);
    await api.round('g-1', 5, [{ kind: 'save', amount: 100 } as never]);
    await api.abandon('g-1');
    expect(asked).toEqual([
      { action: 'start', lifeId: 'nurse', engineVersion: '0.10.0', contentVersion: '1.9.0' },
      { action: 'view', gameId: 'g-1' },
      { action: 'card', gameId: 'g-1', step: 4, option: 2 },
      { action: 'round', gameId: 'g-1', step: 5, orders: [{ kind: 'save', amount: 100 }] },
      { action: 'abandon', gameId: 'g-1' },
    ]);
  });

  it('says the server cannot be reached, for anything asked, when no answer came or the answer decided nothing', async () => {
    for (const answer of [new Error('Failed to fetch'), { status: 429, body: { error: 'too-many' } }, { status: 500, body: { error: 'server' } }, { status: 503, body: null }, { status: 401, body: { message: 'Invalid JWT' } }]) {
      for (const ask of everything(server(answer).api)) {
        await expect(ask(), JSON.stringify(answer)).rejects.toBeInstanceOf(Unreachable);
      }
    }
  });

  it('starts a life with where it stands and the id the server gave it', async () => {
    const { api } = server({ status: 200, body: { ...standing, step: 0, gameId: 'g-9', lifeId: 'nurse' } });
    expect(await api.start('nurse', { engine: '0.10.0', content: '1.9.0' })).toMatchObject({ gameId: 'g-9', step: 0, view, record });
  });

  it('tells apart a server that cannot start a ranked life yet from one that will not', async () => {
    const versions = { engine: '0.10.0', content: '1.9.0' };
    // Versions it does not hold, or cannot rank: worth asking again later, and a life begins on the device meanwhile.
    for (const word of ['unknown-version', 'cannot-rank']) {
      await expect(server({ status: 409, body: { error: word } }).api.start('nurse', versions), word).rejects.toBeInstanceOf(Unreachable);
    }
    // A life the player has not unlocked is refused for good, and in the words the device itself uses.
    const locked = server({ status: 403, body: { error: 'locked-life' } }).api.start('heir', versions);
    await expect(locked).rejects.toThrow('locked life: heir');
    await expect(locked).rejects.not.toBeInstanceOf(Unreachable);
    const refused = server({ status: 400, body: { error: 'bad-request' } }).api.start('nurse', versions);
    await expect(refused).rejects.toThrow('the server refused to start a ranked life: bad-request');
    await expect(refused).rejects.not.toBeInstanceOf(Unreachable);
    // An answer that says yes and holds no life is not a start.
    await expect(server({ status: 200, body: { ...standing } }).api.start('nurse', versions)).rejects.toThrow('the server refused to start a ranked life: 200');
  });

  it('shows a life as it stands, with its run once it is over', async () => {
    expect(await server({ status: 200, body: { ...standing, status: 'playing' } }).api.view('g-1')).toEqual({ ...standing, status: 'playing', run: null });
    expect((await server({ status: 200, body: { ...standing, status: 'finished', run: runRow } }).api.view('g-1')) as { run: unknown }).toMatchObject({ run });
  });

  it('says a life is gone when it was given up or is nobody\'s, and that the server cannot be reached for any other answer', async () => {
    expect(await server({ status: 404, body: { error: 'unknown-game' } }).api.view('g-1')).toBe('gone');
    expect(await server({ status: 409, body: { error: 'closed' } }).api.view('g-1')).toBe('gone');
    await expect(server({ status: 400, body: { error: 'bad-request' } }).api.view('g-1')).rejects.toBeInstanceOf(Unreachable);
    // Yes, and nothing that says where a life stands.
    await expect(server({ status: 200, body: { step: 1 } }).api.view('g-1')).rejects.toBeInstanceOf(Unreachable);
  });

  it('hands back what a step changed: the new world when the round turned, and the run when the life ended', async () => {
    const step = { step: 4, view: { round: 1, player: {} }, record, events: [{ kind: 'salary' }], earned: [] };
    expect(await server({ status: 200, body: { ...step, world: null } }).api.card('g-1', 3, 0)).toMatchObject({ step: 4, world: null, run: null, events: [{ kind: 'salary' }] });
    const world = { round: 1, prices: {} };
    expect(await server({ status: 200, body: { ...step, world } }).api.round('g-1', 3, [])).toMatchObject({ step: 4, world, run: null });
    expect(await server({ status: 200, body: { ...step, world, run: runRow } }).api.round('g-1', 3, [])).toMatchObject({ run });
  });

  it('says the life has moved when the server will not take a step, whatever its reason', async () => {
    for (const [status, word] of [[409, 'out-of-step'], [409, 'closed'], [404, 'unknown-game'], [422, 'cannot-play'], [400, 'bad-request']] as const) {
      expect(await server({ status, body: { error: word } }).api.card('g-1', 3, 0), word).toBe('moved');
      expect(await server({ status, body: { error: word } }).api.round('g-1', 3, []), word).toBe('moved');
    }
  });

  it('does not take for a step an answer that is not one', async () => {
    for (const body of [null, 'ok', { step: 4 }, { step: 4, view: {}, record: {} }, { step: '4', view: {}, record: {}, events: [] }]) {
      await expect(server({ status: 200, body }).api.card('g-1', 3, 0), JSON.stringify(body)).rejects.toBeInstanceOf(Unreachable);
    }
  });
});
