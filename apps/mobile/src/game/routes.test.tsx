// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_VERSION } from '@ratrace/content';
import { ENGINE_VERSION } from '@ratrace/engine';
import type { Account, Community } from '@ratrace/online/types';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import CollectionRoute from '../app/[locale]/collection';
import PlayerRoute from '../app/[locale]/player';
import RankingsRoute from '../app/[locale]/rankings';
import RecordsRoute from '../app/[locale]/records';
import RoomRoute from '../app/[locale]/room';
import AuthRoute from '../app/auth';
import IndexRoute from '../app/index';
import NotFoundRoute from '../app/+not-found';
import { routerNow } from '../testing/fakes';
import { GameProvider } from './context';
import { memoryServices, params, renderGame, router } from '../testing/render';
import { roomServer } from '../../../web/src/testing/roomServer';

// Beside app/, not in it: every file there is a route.
afterEach(cleanup);
// Every page of the game is under its language, as the router hands it: English, unless a test says otherwise.
beforeEach(() => {
  params.locale = 'en';
});

test('the routes are the web\'s pages under each language, and the phone\'s own for development', () => {
  const app = join(dirname(fileURLToPath(import.meta.url)), '../app');
  const routes = readdirSync(app, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.tsx') && !file.split('/').pop()?.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''))
    .sort();
  // The web's pages (apps/web/src/i18n/metadata.ts), the front door (`index`) among them, under the language of the address (`/es/play`), as the
  // Next web's `[locale]`; the bare address, which leads to the front door of a language; the phone's own links mapped to them (`+native-intent`).
  // And the kit, the parts and the scenes, for development only; and the timing probe's, which puts a long life on the phone in a build made with
  // EXPO_PUBLIC_PERF=1 and goes home in any other. And the address Google sends the player back to (`auth`), should Android hand it to the router.
  // And the document of every page of the web export (`+html`, drawn on the build's machine only), and the page of nothing (`+not-found`): an address
  // the game has no page at, the router's own page on the phone, the game's on the web (`screens/NotFound.web.tsx`, the site's `404.html`).
  expect(routes).toEqual([
    '+html',
    '+native-intent',
    '+not-found',
    '[locale]/challenge',
    '[locale]/collection',
    '[locale]/index',
    '[locale]/legal',
    '[locale]/new',
    '[locale]/play',
    '[locale]/player',
    '[locale]/rankings',
    '[locale]/records',
    '[locale]/room',
    'auth',
    'dev',
    'index',
    'kit',
    'perf',
    'scene',
  ]);
});

test('a page of the game is drawn in one of its languages only: any other first part of the address is the router\'s page of nothing, as the Next web\'s `notFound()`', () => {
  params.locale = 'de';
  const { container } = renderGame(<RecordsRoute />, memoryServices());
  expect(container.querySelector('[data-unmatched]')).not.toBeNull();
  expect(screen.queryByRole('heading', { name: 'History' })).toBeNull();
});

test('on the phone, an address the game has no page at is the router\'s own page of nothing, as it was before the game had one', () => {
  const { container } = renderGame(<NotFoundRoute />, memoryServices());
  expect(container.querySelector('[data-unmatched]')).not.toBeNull();
});

test('the bare address leads to the front door of the phone\'s language, the query and hash it carries with it', () => {
  // Outside the pages of a language: the address has none.
  delete params.locale;
  const { container } = renderGame(<IndexRoute />, memoryServices(), 'es');
  expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/es');
  cleanup();
  params.code = 'c0de';
  const again = renderGame(<IndexRoute />, memoryServices(), 'ru');
  expect(again.container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/ru?code=c0de');
  cleanup();
  // And the hash, which the router hands as `#`.
  params['#'] = 'x';
  const hashed = renderGame(<IndexRoute />, memoryServices(), 'ru');
  expect(hashed.container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/ru?code=c0de#x');
});

test('the timing probe\'s route goes home in a build without the flag, and puts nothing on the phone', async () => {
  const { default: PerfRoute } = await import('../app/perf');
  const { container } = renderGame(<PerfRoute />, memoryServices());
  expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/');
});

test('the records and the collection are their own screens', async () => {
  renderGame(<RecordsRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'History' })).toBeTruthy();
  cleanup();
  renderGame(<CollectionRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Collection' })).toBeTruthy();
});

test('the player\'s own profile is its own screen', () => {
  renderGame(<PlayerRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Your profile' })).toBeTruthy();
});

test('the games with others are their own screen, which says they need an account where there is none, and is opened on the invitation a link carries: `theratrace://room?code=`', async () => {
  renderGame(<RoomRoute />, memoryServices());
  expect(await screen.findByText('Multiplayer needs an account and a connection.')).toBeTruthy();
  cleanup();
  const rooms = roomServer();
  const opened = await rooms.ask('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', { action: 'open', lifeId: 'nurse', seconds: 180, engineVersion: ENGINE_VERSION, contentVersion: CONTENT_VERSION });
  const code = (opened.body.room as { code: string }).code;
  params.code = code.toLowerCase();
  renderGame(<RoomRoute />, { ...memoryServices(), rooms: () => rooms.link('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), schedule: () => () => {} });
  const invitation = await screen.findByRole('region', { name: 'You are invited to the game' });
  expect(invitation.textContent).toContain(code);
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
  cleanup();
  // And the web's own link to the friends, `/{l}/rankings#friends` (the front door's, and a phone's `theratrace://rankings#friends`): the hash, as
  // the router hands it (`#`).
  delete params.tab;
  params['#'] = 'friends';
  renderGame(<RankingsRoute />, { ...memoryServices(), community: () => community });
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true'));
});
