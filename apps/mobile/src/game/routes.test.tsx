// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Account, Community } from '@ratrace/online/types';
import { cleanup, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, expect, test } from 'vitest';
import AuthRoute from '../app/auth';
import CollectionRoute from '../app/collection';
import PlayerRoute from '../app/player';
import RankingsRoute from '../app/rankings';
import RecordsRoute from '../app/records';
import RoomRoute from '../app/room';
import { routerNow } from '../testing/fakes';
import { GameProvider } from './context';
import { memoryServices, params, renderGame, router } from '../testing/render';

// Beside app/, not in it: every file there is a route.
afterEach(cleanup);

test('the routes are the web\'s pages after the front door, and the phone\'s own for development', () => {
  const routes = readdirSync(join(dirname(fileURLToPath(import.meta.url)), '../app'))
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''))
    .sort();
  // The web's pages (apps/web/src/i18n/metadata.ts), the front door (`index`), and the kit, the parts and the scenes, for development only; and the
  // timing probe's, which puts a long life on the phone in a build made with EXPO_PUBLIC_PERF=1 and goes home in any other. And the address Google
  // sends the player back to (`auth`), should Android hand it to the router.
  expect(routes).toEqual(['auth', 'challenge', 'collection', 'dev', 'index', 'kit', 'legal', 'new', 'perf', 'play', 'player', 'rankings', 'records', 'room', 'scene']);
});

test('the timing probe\'s route goes home in a build without the flag, and puts nothing on the phone', async () => {
  const { default: PerfRoute } = await import('../app/perf');
  const { container } = renderGame(<PerfRoute />, memoryServices());
  expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/');
});

test('the records and the collection are their own screens', async () => {
  renderGame(<RecordsRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Records' })).toBeTruthy();
  cleanup();
  renderGame(<CollectionRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Collection' })).toBeTruthy();
});

test('the player\'s own profile is its own screen', () => {
  renderGame(<PlayerRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Your profile' })).toBeTruthy();
});

test('the pages of the game with others go home: no solo screen leads to them, and the phone plays offline', () => {
  for (const route of [<RoomRoute key="room" />] as ReactElement[]) {
    const { container } = renderGame(route, memoryServices());
    expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/');
    cleanup();
  }
});

test('Google\'s way back to the app, should Android hand it to the router, goes back to where the player was, or home: nothing of it is read or exchanged', () => {
  // Whatever the address carries, a code with it: only the trip that opened the browser exchanges one, against its own flow.
  Object.assign(params, { code: 'c0de', state: 'x' });
  const asked: string[] = [];
  const account: Account = {
    state: () => ({ kind: 'guest', userId: 'u', notice: null }),
    subscribe: () => () => {},
    start: async () => void asked.push('start'),
    keepWithGoogle: async () => (asked.push('keep'), true),
    useExistingAccount: async () => (asked.push('use'), true),
    dismissNotice: () => void asked.push('dismiss'),
    signOut: async () => (asked.push('sign out'), true),
  };
  const { container } = renderGame(<AuthRoute />, { ...memoryServices(), account });
  expect(container.textContent).toBe('');
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
  cleanup();
  router.canGoBack.mockReturnValueOnce(false);
  renderGame(<AuthRoute />, { ...memoryServices(), account });
  expect(router.replace).toHaveBeenCalledWith('/');
  expect(asked.filter((what) => what !== 'start')).toEqual([]);
  // The route reads nothing of the address and names nothing of the account: only the router.
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../app/auth.tsx'), 'utf8');
  expect([...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['expo-router', 'react']);
});

test('Google\'s way back goes back once, even drawn again as it leaves with a router of a new identity: never a second time, from the screen under it', () => {
  const services = memoryServices();
  const { rerender } = renderGame(<AuthRoute />, services);
  expect(router.back).toHaveBeenCalledTimes(1);
  // The router drawn anew (as expo-router hands a new one while the stack changes): the same moves, another object.
  routerNow.is = { ...router };
  rerender(<GameProvider services={services}><AuthRoute /></GameProvider>);
  routerNow.is = { ...router };
  rerender(<GameProvider services={services}><AuthRoute /></GameProvider>);
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(router.replace).not.toHaveBeenCalled();
});

test('the rankings are their own screen, opened on the ranking the link names: a friend request\'s notice is `theratrace://rankings?tab=friends`', async () => {
  const asked: string[] = [];
  const community = {
    me: async () => null,
    friends: async () => ({ friends: [], incoming: [], outgoing: [] }),
    ranking: async (query: { period: string; friends: boolean }) => (asked.push(`${query.period} ${query.friends ? 'friends' : 'everyone'}`), []),
    challengeRanking: async () => ({ rows: [], entrants: 0 }),
  } as unknown as Community;
  renderGame(<RankingsRoute />, { ...memoryServices(), community: () => community });
  expect(screen.getByRole('heading', { name: 'Rankings' })).toBeTruthy();
  await waitFor(() => expect(asked).toEqual(['all everyone']));
  cleanup();
  asked.length = 0;
  params.tab = 'friends';
  renderGame(<RankingsRoute />, { ...memoryServices(), community: () => community });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true'));
  await waitFor(() => expect(asked).toEqual(['all friends']));
  cleanup();
  params.tab = 'challenge';
  renderGame(<RankingsRoute />, { ...memoryServices(), community: () => community });
  expect(await screen.findByText("Nobody has finished this week's challenge yet.")).toBeTruthy();
  cleanup();
  // A tab the page does not have opens it as it is: all time.
  params.tab = 'nowhere';
  renderGame(<RankingsRoute />, { ...memoryServices(), community: () => community });
  expect(screen.getByRole('tab', { name: 'All time' }).getAttribute('aria-selected')).toBe('true');
});
