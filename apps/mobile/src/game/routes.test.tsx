// @vitest-environment jsdom
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, expect, test } from 'vitest';
import CollectionRoute from '../app/collection';
import PlayerRoute from '../app/player';
import RankingsRoute from '../app/rankings';
import RecordsRoute from '../app/records';
import RoomRoute from '../app/room';
import { memoryServices, renderGame } from '../testing/render';

// Beside app/, not in it: every file there is a route.
afterEach(cleanup);

test('the routes are the web\'s pages after the front door, and the phone\'s own for development', () => {
  const routes = readdirSync(join(dirname(fileURLToPath(import.meta.url)), '../app'))
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''))
    .sort();
  // The web's pages (apps/web/src/i18n/metadata.ts), the front door (`index`), and the kit, the parts and the scenes, for development only; and the
  // timing probe's, which puts a long life on the phone in a build made with EXPO_PUBLIC_PERF=1 and goes home in any other.
  expect(routes).toEqual(['challenge', 'collection', 'dev', 'index', 'kit', 'legal', 'new', 'perf', 'play', 'player', 'rankings', 'records', 'room', 'scene']);
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
  for (const route of [<RankingsRoute key="rankings" />, <RoomRoute key="room" />] as ReactElement[]) {
    const { container } = renderGame(route, memoryServices());
    expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/');
    cleanup();
  }
});
