// @vitest-environment jsdom
import type { Account, AccountSaves, AccountState } from '@ratrace/online/types';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { memoryServices, renderGame, router } from '../testing/render';
import { sheetsShut } from '../ui/back';
import { Home } from './screens/Home';

/*
 * The game started again (the player signed out) shuts every sheet first. Should making the new round store fail, the sheets are not left shut for
 * good: the player can still open one. The round store is the real one, except when this test makes it fail.
 */

const failing = vi.hoisted(() => ({ next: false }));
vi.mock('@ratrace/core/game/store', async (original) => {
  const real = await original<typeof import('@ratrace/core/game/store')>();
  return {
    ...real,
    createGameStore: (...args: Parameters<typeof real.createGameStore>) => {
      if (failing.next) {
        failing.next = false;
        throw new Error('no round store');
      }
      return real.createGameStore(...args);
    },
  };
});

afterEach(() => {
  cleanup();
  failing.next = false;
});

const MEMBER: AccountState = { kind: 'member', userId: 'u', email: null };
const member: Account = {
  state: () => MEMBER,
  subscribe: () => () => {},
  start: async () => {},
  keepWithGoogle: async () => true,
  useExistingAccount: async () => true,
  dismissNotice: () => {},
  signOut: async () => true,
};
const saved: AccountSaves = {
  status: () => 'saved',
  offer: () => null,
  subscribe: () => () => {},
  onDeviceChanged: () => () => {},
  takeOffer: async () => false,
  declineOffer: async () => {},
};
const sheetTitled = (title: string) => screen.getByRole('heading', { name: title }).closest('[aria-modal="true"]') as HTMLElement;

test('a start of the game that fails leaves the sheets free to open again: the player is left where they were', async () => {
  renderGame(<Home />, { ...memoryServices(), account: member, saves: saved });
  fireEvent.click((await screen.findAllByRole('button', { name: 'Settings' }))[0]);
  fireEvent.click(within(sheetTitled('Settings')).getByRole('button', { name: 'Sign out' }));
  failing.next = true;
  fireEvent.click(within(sheetTitled('Sign out?')).getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(failing.next).toBe(false));
  await waitFor(() => expect(sheetsShut()).toBe(false));
  // The game was not started again, so nobody was sent home: the player is where they were, in the settings, which open as they always do.
  expect(router.dismissTo).not.toHaveBeenCalled();
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeTruthy();
});
