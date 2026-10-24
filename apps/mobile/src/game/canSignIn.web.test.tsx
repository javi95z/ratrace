import type { Account, AccountState } from '@ratrace/online/types';
import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, expect, it } from 'vitest';
import { memoryServices } from '../testing/memoryServices';
import { GameProvider, useCanSignIn } from './context';
import type { Services } from './context';

/*
 * Whether there is a project to sign in to, on the web export: its HTML is drawn on the build's machine, where the game is always offline
 * (`online/index.web.ts`: no browser, no client), whatever project the build was given; the browser's own game, made as it takes the page over, has
 * the project. The page must take over the HTML as it was drawn, with nobody to sign in to, and learn of the project after: else React finds another
 * page than the HTML (its #418), says so as an error (which the page's watch reports) and draws the page again. The weekly challenge's page tells a
 * guest to sign in only where there is a project (`Challenge.tsx`).
 */

const guest: AccountState = { kind: 'guest', userId: 'u', notice: null };
const account: Account = { state: () => guest, subscribe: () => () => {}, start: async () => {}, keepWithGoogle: async () => true, useExistingAccount: async () => true, dismissNotice: () => {}, signOut: async () => false };

function Probe() {
  return <span id="probe">{useCanSignIn() ? 'a project to sign in to' : 'nobody to sign in to'}</span>;
}

const drawn = (services: Services) => (
  <GameProvider services={services}>
    <Probe />
  </GameProvider>
);

let root: ReturnType<typeof hydrateRoot> | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = '';
});

it('takes over the page drawn offline as it was drawn, and then says there is a project to sign in to', async () => {
  // As the export draws it: offline, no account of a project.
  const html = renderToString(drawn(memoryServices()));
  expect(html).toContain('nobody to sign in to');
  const page = document.createElement('div');
  page.innerHTML = html;
  document.body.append(page);
  const mismatches: unknown[] = [];
  // As the browser takes it over: the same game with the project's account.
  await act(async () => {
    root = hydrateRoot(page, drawn({ ...memoryServices(), account }), { onRecoverableError: (error) => mismatches.push(error) });
  });
  expect(mismatches).toEqual([]);
  expect(page.querySelector('#probe')?.textContent).toBe('a project to sign in to');
});
