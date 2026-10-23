// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { CONTENT_VERSION } from '@ratrace/content';
import { SAVE_FORMAT } from '@ratrace/core/session/types';
import type { FinishedRun } from '@ratrace/core/session/types';
import { ENGINE_VERSION } from '@ratrace/engine';
import { afterEach, expect, it, vi } from 'vitest';
import { KvStore } from '../kvStore';
import { forgetThePhone } from '../online';
import { servers } from '../testing/cloudServers';
import { forgetTheGame, GameProvider, useAccount, useGame } from './context';

/*
 * The first start after signing in, with lives finished on the phone that the account lacks: the game as the app starts it (`phoneServices`), over
 * the network's stand-in. The account signs in and is read at once, but its lives in progress are handed to the mirror only once the game's first
 * screen is on the phone's screen (`online/held.ts`): nothing is played back or sent before; then every life goes up, one after another, in the
 * order the mirror sends them.
 */

// The game's first screen, on the phone's screen only when the test says so: what `whenShown` was asked to tell, held here.
const shown = vi.hoisted(() => ({ waiting: [] as Array<() => void> }));
vi.mock('../ui/drawnFirst', async (original) => {
  const real = await original<typeof import('../ui/drawnFirst')>();
  return {
    ...real,
    whenShown: (then: () => void) => {
      shown.waiting.push(then);
      return () => undefined;
    },
  };
});

afterEach(() => {
  cleanup();
  forgetTheGame();
  forgetThePhone();
  shown.waiting = [];
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const life = (n: number): FinishedRun => ({
  format: SAVE_FORMAT,
  runId: `life-${n}`,
  engineVersion: ENGINE_VERSION,
  contentVersion: CONTENT_VERSION,
  lifeId: 'nurse',
  seed: `seed-${n}`,
  log: [],
  finishedAt: 1_700_000_000_000 + n,
  score: 100 + n,
  netWorth: 1000,
  status: 10,
  escapedAtRound: null,
  bankruptcies: 0,
  history: [1000],
  badges: [],
  cities: ['madrid'],
  verified: false,
});

it('reads the account at once, but sends nothing before the first screen is drawn; then every finished life, in order', async () => {
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://abcdefghijklmnop.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_x');
  const device = new KvStore();
  for (const n of [1, 2, 3]) await device.addRun(life(n));

  const cloud = servers();
  const finished: string[] = [];
  const pushed: string[] = [];
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
    if (url.pathname === '/functions/v1/finish-run') finished.push(String(body?.gameId));
    if (url.pathname === '/rest/v1/games' && init?.method === 'POST') pushed.push(String((Array.isArray(body) ? body[0] : body)?.id));
    return cloud.fetch(input, init);
  });
  const saves = () => cloud.asked.filter((one) => /\/rest\/v1\/(runs|games|player_progress)|\/functions\/v1\/finish-run/.test(one));

  const seen: { account?: ReturnType<typeof useAccount>; status?: string } = {};
  function Probe() {
    seen.account = useAccount();
    seen.status = useGame((s) => s.status);
    return null;
  }
  render(
    <GameProvider>
      <Probe />
    </GameProvider>,
  );
  // Signed in, the game opened, its first screen asked to be told when it is on the phone's screen. The account is read already (its lives and
  // its lives in progress asked at once), but nothing is played back or sent until the screen is up: no life pushed, none finished.
  await waitFor(() => expect(seen.account?.state.kind).toBe('guest'));
  await waitFor(() => expect(shown.waiting.length).toBeGreaterThan(0));
  expect(seen.status).not.toBe('booting');
  await waitFor(() => expect(cloud.asked).toEqual(expect.arrayContaining(['GET /rest/v1/runs', 'GET /rest/v1/games'])));
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(pushed).toEqual([]);
  expect(finished).toEqual([]);

  // On the screen: every life goes up and is finished, the latest first, as the mirror sends them.
  act(() => shown.waiting.forEach((tell) => tell()));
  await waitFor(() => expect(finished).toEqual(['life-3', 'life-2', 'life-1']));
  expect(pushed).toEqual(['life-3', 'life-2', 'life-1']);
  expect(saves()[0]).toBe('GET /rest/v1/runs');
});
