import { challengeOf, lives, textFor, weekOf } from '@ratrace/content';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it } from 'vitest';
import { memoryServices } from '../../testing/memoryServices';
import { speaking } from '../../testing/memoryServices';
import { GameProvider } from '../context';
import { WeeklyChallenge } from './Challenge';

/*
 * The weekly challenge's page on the web export: its HTML is drawn on the build's machine, on the build's day and in its time zone, and the browser
 * takes it over on its own day and in its player's zone, a week later or on the other side of the world. What the page says of the week (its life,
 * its rule, the day it ends) is drawn only once the browser has the page: the HTML and the browser's first draw are the same page (the week's frame
 * and its loading line), else React finds another page than the HTML (its #418), says so as an error (which the page's watch reports) and draws the
 * whole page again.
 */

const DAY = 86_400_000;
/** The build's day: a Sunday evening in Madrid, when the week's last day is still the 25th. */
const BUILT = Date.UTC(2026, 9, 25, 18);
/** A day the page is opened on: some weeks later, with another life in the week's challenge. */
const OPENED = (() => {
  const built = challengeOf(weekOf(BUILT), lives);
  for (let at = BUILT + 7 * DAY; ; at += 7 * DAY) if (challengeOf(weekOf(at), lives)?.lifeId !== built?.lifeId) return at;
})();

const zone = process.env.TZ;
let root: ReturnType<typeof hydrateRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
  process.env.TZ = zone;
});

const drawn = (now: number) => (
  <GameProvider services={speaking({ ...memoryServices(), now: () => now }, 'en')}>
    <WeeklyChallenge />
  </GameProvider>
);

it('is taken over in another week and another time zone with nothing found different, then shows the browser\'s week', async () => {
  process.env.TZ = 'Europe/Madrid';
  const html = renderToString(drawn(BUILT));
  const page = document.createElement('div');
  page.innerHTML = html;
  document.body.append(page);
  // Nothing of the build's week is in the HTML: neither its life nor the day it ends.
  const builtWeek = challengeOf(weekOf(BUILT), lives);
  expect(page.textContent).not.toContain(textFor('en').text.lives[builtWeek?.lifeId ?? ''].name);
  expect(page.textContent).not.toContain('Ends');

  process.env.TZ = 'America/Los_Angeles';
  const mismatches: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(page, drawn(OPENED), { onRecoverableError: (error) => mismatches.push(error) });
  });
  expect(mismatches).toEqual([]);
  const opened = challengeOf(weekOf(OPENED), lives);
  expect(page.textContent).toContain(textFor('en').text.lives[opened?.lifeId ?? ''].name);
});

it('draws the page\'s frame in its HTML: its heading and the loading line, in the page\'s language', () => {
  const html = renderToString(drawn(BUILT));
  expect(html).toContain('Weekly challenge');
  expect(html).toContain('Loading');
});
