import { readFileSync } from 'node:fs';
import type { GameView } from '@ratrace/engine';
import type { GameSession, Sessions } from '@ratrace/core/session/types';
import type { RoomState } from '@ratrace/core/session/room';
import { describe, expect, it, vi } from 'vitest';

// The web's file sends to Vercel: nothing is sent from here.
vi.mock('@vercel/analytics', () => ({ track: () => undefined }));

import * as web from '../../../web/src/pwa/events';
import type { Counted as WebCounted } from '../../../web/src/pwa/events';
import * as phone from './events';
import type { Counted } from './events';

/*
 * The phone counts what the web counts (apps/web/src/pwa/events.ts), in a copy of the web's file without its sender. This holds the copy to the
 * original: the text of what is copied is the web's, word for word, and both are run over the same lives and rooms, with the web's own
 * expectations (events.test.ts), so a copy that agreed with a web that had changed would not pass for one that is right.
 */

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
function part(source: string, from: string, to?: string): string {
  const start = source.indexOf(from);
  expect(start, from).toBeGreaterThanOrEqual(0);
  const end = to === undefined ? source.length : source.indexOf(to, start);
  expect(end, to).toBeGreaterThan(start);
  return source.slice(start, end);
}

// Each kind of thing counted is the same on both sides: the one is the other.
const both: [Counted, WebCounted] = [{ name: 'share', what: 'card' }, { name: 'share', what: 'card' }];
const asWeb: WebCounted = both[0];
const asPhone: Counted = both[1];

describe('what the phone counts is the web\'s', () => {
  it('is the web\'s text, word for word, but for the sender', () => {
    const source = read('../../../web/src/pwa/events.ts');
    const copy = read('./events.ts');
    expect(copy).toContain(part(source, 'export type Counted =', '/**\n * Counts with Vercel'));
    expect(copy).toContain(part(source, '/** What kind of life a life is'));
    expect(copy).not.toContain('@vercel/analytics');
    expect(asWeb).toEqual(asPhone);
  });

  it('names a life by whether the server plays it and whether it is the week\'s challenge', () => {
    const lives = [{}, { ranked: true }, { ranked: true, challenge: '2026-W43' }, { ranked: false, challenge: '2026-W43' }, { ranked: false, challenge: null }];
    expect(lives.map(phone.modeOf)).toEqual(['solo', 'ranked', 'challenge', 'practice', 'solo']);
    expect(lives.map(phone.modeOf)).toEqual(lives.map(web.modeOf));
  });

  const sessionsGiving = (session: Partial<GameSession>) => {
    const asked: unknown[] = [];
    const sessions: Sessions = {
      start: async (lifeId, options) => (asked.push({ lifeId, ...options }), session as GameSession),
      resume: async () => ({ session: null, lost: null }),
      abandon: async () => {},
    };
    return { sessions, asked };
  };
  /** What each side counts of the same starts. */
  async function starts(counting: typeof phone.countingStarts) {
    const counted: Counted[] = [];
    const ranked = sessionsGiving({ ranked: true, challenge: '2026-W43' });
    await counting(ranked.sessions, (event) => counted.push(event)).start('nurse', { ranked: true, challenge: '2026-W43' });
    await counting(sessionsGiving({ ranked: false, challenge: '2026-W43' }).sessions, (event) => counted.push(event)).start('nurse', { ranked: true, challenge: '2026-W43' });
    await counting(sessionsGiving({}).sessions, (event) => counted.push(event)).start('nurse');
    const failing: Sessions = { start: async () => Promise.reject(new Error('in the way')), resume: async () => ({ session: null, lost: null }), abandon: async () => {} };
    await expect(counting(failing, (event) => counted.push(event)).start('nurse')).rejects.toThrow('in the way');
    await counting(failing, (event) => counted.push(event)).resume();
    return { counted, asked: ranked.asked };
  }

  it('counts a life as the life it turned out to be, with an attempt at the challenge only when the server took it', async () => {
    const mine = await starts(phone.countingStarts);
    expect(mine.counted).toEqual([{ name: 'life_start', mode: 'challenge' }, { name: 'challenge_attempt' }, { name: 'life_start', mode: 'practice' }, { name: 'life_start', mode: 'solo' }]);
    expect(mine.asked).toEqual([{ lifeId: 'nurse', ranked: true, challenge: '2026-W43' }]);
    expect(mine).toEqual(await starts(web.countingStarts as typeof phone.countingStarts));
  });

  it('counts the end of a life played out here, and nothing for a life opened again, another life or a step that did not end it', () => {
    const view = (finished: boolean, escapedAtRound: number | null = null) => ({ finished, player: { escapedAtRound } }) as unknown as GameView;
    const life = (over: Record<string, unknown>) => ({ gameId: 'g-1', view: view(false), ranked: false, challenge: null, resolved: null, ...over });
    const cases: Array<[ReturnType<typeof life>, ReturnType<typeof life>]> = [
      [life({ view: view(true, 31), resolved: {} }), life({})],
      [life({ view: view(true), ranked: true, resolved: {} }), life({ ranked: true })],
      [life({ view: view(true) }), life({ view: null })],
      [life({ view: view(true), resolved: {} }), life({ view: view(true) })],
      [life({ gameId: 'g-2', view: view(true), resolved: {} }), life({})],
      [life({ resolved: {} }), life({})],
    ];
    const mine = cases.map(([now, before]) => phone.lifeEnded(now, before));
    expect(mine).toEqual([{ name: 'life_end', mode: 'solo', escaped: true }, { name: 'life_end', mode: 'ranked', escaped: false }, null, null, null, null]);
    expect(mine).toEqual(cases.map(([now, before]) => web.lifeEnded(now, before)));
  });

  it('counts a game with others begun as the page saw its room go from waiting to playing, and nothing else', () => {
    const room = (over: Partial<RoomState>) => ({ id: 'r-1', status: 'open', public: false, ...over }) as RoomState;
    const cases: Array<[RoomState | null, RoomState | null]> = [
      [room({ status: 'playing' }), room({})],
      [room({ status: 'playing', public: true }), room({ public: true })],
      [room({ status: 'playing' }), null],
      [room({ status: 'playing', round: 3 }), room({ status: 'playing', round: 2 })],
      [room({ id: 'r-2', status: 'playing' }), room({})],
    ];
    const mine = cases.map(([now, before]) => phone.gameBegan(now, before));
    expect(mine).toEqual([{ name: 'game_start', kind: 'friends' }, { name: 'game_start', kind: 'public' }, null, null, null]);
    expect(mine).toEqual(cases.map(([now, before]) => web.gameBegan(now, before)));
  });

  it('counts nothing where there is nothing to count to', () => {
    expect(phone.ignore({ name: 'app_installed' })).toBeUndefined();
  });
});
