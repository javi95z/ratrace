// @vitest-environment jsdom
import type { Account, AccountState } from '@ratrace/online/types';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Preferences } from './Settings';

/*
 * Deleting the account on the web: the other tabs of the site, and the installed game beside them, hold the player in their memory and share the
 * browser's database with this tab. The tab that deleted tells them; each one hearing it loads its page again, from what the browser now holds,
 * before it writes anything of the old player back.
 */

/** The page loaded again: a test's browser goes nowhere. */
const reloaded = vi.hoisted(() => ({ count: 0 }));
vi.mock('../reloadDocument', () => ({ reloadDocument: () => void (reloaded.count += 1) }));

afterEach(() => {
  cleanup();
  reloaded.count = 0;
});

const GUEST: AccountState = { kind: 'guest', userId: 'guest-1', notice: null };

/** A guest's account, deleted when asked. */
function deletable(): Account {
  let state = GUEST;
  const listeners = new Set<() => void>();
  return {
    state: () => state,
    subscribe: (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    start: async () => undefined,
    keepWithGoogle: async () => false,
    useExistingAccount: async () => false,
    dismissNotice: () => undefined,
    signOut: async () => true,
    deleteAccount: async () => {
      state = { kind: 'offline' };
      for (const listener of [...listeners]) listener();
      return true;
    },
  };
}

describe('deleting the account, with other tabs open', () => {
  it('tells the other tabs once the account is gone, and does not load its own page again: it starts again by itself', async () => {
    const told: unknown[] = [];
    const otherTab = new BroadcastChannel('ratrace:forgotten');
    otherTab.onmessage = (event) => told.push(event.data);
    renderGame(<Preferences />, { ...memoryServices(), account: deletable() });
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    const sheet = screen.getByRole('heading', { name: 'Delete your account?' }).closest('[aria-modal="true"]') as HTMLElement;
    fireEvent.click(within(sheet).getByRole('button', { name: 'Delete forever' }));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/en'));
    await waitFor(() => expect(told).toHaveLength(1));
    await new Promise((settled) => setTimeout(settled, 20));
    expect(reloaded.count).toBe(0);
    otherTab.close();
  });

  it('loads the page again when another tab deleted the account, once', async () => {
    renderGame(<Preferences />, { ...memoryServices(), account: deletable() });
    const anotherTab = new BroadcastChannel('ratrace:forgotten');
    anotherTab.postMessage({ from: 'another-tab' });
    await waitFor(() => expect(reloaded.count).toBe(1));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ratrace:forgotten', newValue: 'another-tab 1' }));
    expect(reloaded.count).toBe(1);
    anotherTab.close();
  });
});
