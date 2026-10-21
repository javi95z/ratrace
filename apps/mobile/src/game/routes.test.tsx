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
  // The web's pages (apps/web/src/i18n/metadata.ts), the front door (`index`), and the kit, the parts and the scenes, for development only.
  expect(routes).toEqual(['challenge', 'collection', 'dev', 'index', 'kit', 'legal', 'new', 'play', 'player', 'rankings', 'records', 'room', 'scene']);
});

test('the records and the collection are their own screens', async () => {
  renderGame(<RecordsRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Records' })).toBeTruthy();
  cleanup();
  renderGame(<CollectionRoute />, memoryServices());
  expect(screen.getByRole('heading', { name: 'Collection' })).toBeTruthy();
});

test('the pages of the game with others go home: no solo screen leads to them, and the phone plays offline', () => {
  for (const route of [<RankingsRoute key="rankings" />, <RoomRoute key="room" />, <PlayerRoute key="player" />] as ReactElement[]) {
    const { container } = renderGame(route, memoryServices());
    expect(container.querySelector('[data-redirect]')?.getAttribute('data-redirect')).toBe('/');
    cleanup();
  }
});
