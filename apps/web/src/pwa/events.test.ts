import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '@ratrace/engine';
import type { GameSession, Sessions } from '@ratrace/core/session/types';
import type { RoomState } from '@ratrace/core/session/room';

const sent = vi.hoisted(() => [] as unknown[][]);
vi.mock('@vercel/analytics', () => ({ track: (...args: unknown[]) => void sent.push(args) }));

import { countingStarts, gameBegan, lifeEnded, modeOf, toVercel } from './events';
import type { Counted } from './events';

afterEach(() => {
  vi.unstubAllEnvs();
  sent.length = 0;
});

describe('what is counted', () => {
  it('names a life by whether the server plays it and whether it is the week\'s challenge', () => {
    expect(modeOf({})).toBe('solo');
    expect(modeOf({ ranked: true })).toBe('ranked');
    expect(modeOf({ ranked: true, challenge: '2026-W43' })).toBe('challenge');
    expect(modeOf({ ranked: false, challenge: '2026-W43' })).toBe('practice');
    expect(modeOf({ ranked: false, challenge: null })).toBe('solo');
  });

  it('is sent to Vercel by its name and what kind of thing it was, in production only, and never fails the game', () => {
    toVercel({ name: 'life_start', mode: 'solo' });
    expect(sent).toEqual([]);
    vi.stubEnv('NODE_ENV', 'production');
    toVercel({ name: 'life_start', mode: 'solo' });
    toVercel({ name: 'app_installed' });
    expect(sent).toEqual([['life_start', { mode: 'solo' }], ['app_installed', {}]]);
  });
});

describe('the start of a life', () => {
  const sessionsGiving = (session: Partial<GameSession>) => {
    const asked: unknown[] = [];
    const sessions: Sessions = {
      start: async (lifeId, options) => (asked.push({ lifeId, ...options }), session as GameSession),
      resume: async () => ({ session: null, lost: null }),
      abandon: async () => {},
    };
    return { sessions, asked };
  };

  it('is counted as the life it turned out to be, with an attempt at the challenge only when the server took it', async () => {
    const counted: Counted[] = [];
    const ranked = sessionsGiving({ ranked: true, challenge: '2026-W43' });
    await countingStarts(ranked.sessions, (event) => counted.push(event)).start('nurse', { ranked: true, challenge: '2026-W43' });
    // Refused by the server, the attempt became a practice.
    await countingStarts(sessionsGiving({ ranked: false, challenge: '2026-W43' }).sessions, (event) => counted.push(event)).start('nurse', { ranked: true, challenge: '2026-W43' });
    await countingStarts(sessionsGiving({}).sessions, (event) => counted.push(event)).start('nurse');
    expect(counted).toEqual([{ name: 'life_start', mode: 'challenge' }, { name: 'challenge_attempt' }, { name: 'life_start', mode: 'practice' }, { name: 'life_start', mode: 'solo' }]);
    expect(ranked.asked).toEqual([{ lifeId: 'nurse', ranked: true, challenge: '2026-W43' }]);
  });

  it('is not counted when it did not begin, nor when a life is taken up again', async () => {
    const counted: Counted[] = [];
    const failing: Sessions = { start: async () => Promise.reject(new Error('in the way')), resume: async () => ({ session: null, lost: null }), abandon: async () => {} };
    await expect(countingStarts(failing, (event) => counted.push(event)).start('nurse')).rejects.toThrow('in the way');
    await countingStarts(failing, (event) => counted.push(event)).resume();
    expect(counted).toEqual([]);
  });
});

describe('the end of a life', () => {
  const view = (finished: boolean, escapedAtRound: number | null = null) => ({ finished, player: { escapedAtRound } }) as unknown as GameView;
  const life = (over: Record<string, unknown>) => ({ gameId: 'g-1', view: view(false), ranked: false, challenge: null, resolved: null, ...over });

  it('is counted when this page played the last step of the life, with whether it escaped', () => {
    expect(lifeEnded(life({ view: view(true, 31), resolved: {} }), life({}))).toEqual({ name: 'life_end', mode: 'solo', escaped: true });
    expect(lifeEnded(life({ view: view(true), ranked: true, resolved: {} }), life({ ranked: true }))).toEqual({ name: 'life_end', mode: 'ranked', escaped: false });
  });

  it('is not counted for a finished life opened again, another life, or a step that did not end it', () => {
    // Opened again: finished, with no step's result.
    expect(lifeEnded(life({ view: view(true) }), life({ view: null }))).toBeNull();
    expect(lifeEnded(life({ view: view(true), resolved: {} }), life({ view: view(true) }))).toBeNull();
    expect(lifeEnded(life({ gameId: 'g-2', view: view(true), resolved: {} }), life({}))).toBeNull();
    expect(lifeEnded(life({ resolved: {} }), life({}))).toBeNull();
  });
});

describe('the start of a game with others', () => {
  const room = (over: Partial<RoomState>) => ({ id: 'r-1', status: 'open', public: false, ...over }) as RoomState;

  it('is counted when the page sees its room go from waiting to playing, as a game with friends or a public one', () => {
    expect(gameBegan(room({ status: 'playing' }), room({}))).toEqual({ name: 'game_start', kind: 'friends' });
    expect(gameBegan(room({ status: 'playing', public: true }), room({ public: true }))).toEqual({ name: 'game_start', kind: 'public' });
  });

  it('is not counted for a room found already playing, a round turning, or another room', () => {
    expect(gameBegan(room({ status: 'playing' }), null)).toBeNull();
    expect(gameBegan(room({ status: 'playing', round: 3 }), room({ status: 'playing', round: 2 }))).toBeNull();
    expect(gameBegan(room({ id: 'r-2', status: 'playing' }), room({}))).toBeNull();
  });
});
