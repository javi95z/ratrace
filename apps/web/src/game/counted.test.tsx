// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { Account, AccountState } from '@ratrace/online/types';
import type { Counted } from '@/pwa/events';
import { memoryServices, renderGame } from '@/testing/render';
import { useAccount, useGame } from './context';

afterEach(() => window.sessionStorage.clear());

/** A button that begins a life, as the screens do. */
function Begin() {
  const start = useGame((s) => s.start);
  return (
    <button type="button" onClick={() => void start('nurse')}>
      begin
    </button>
  );
}

/** An account whose state the test moves, as a page coming back from Google finds it. */
function accountAt(first: AccountState) {
  let state = first;
  const listeners = new Set<() => void>();
  const account: Account = {
    state: () => state,
    subscribe: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
    start: async () => {},
    keepWithGoogle: async () => true,
    useExistingAccount: async () => true,
    dismissNotice: () => {},
    signOut: async () => false,
  };
  const move = (next: AccountState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  return { account, move };
}

function Keep() {
  const { keepWithGoogle } = useAccount();
  return (
    <button type="button" onClick={() => void keepWithGoogle()}>
      keep
    </button>
  );
}

describe('what the game counts of how it is played', () => {
  it('counts a life begun on this page, as the life it is', async () => {
    const counted: Counted[] = [];
    renderGame(<Begin />, { ...memoryServices(), track: (event) => counted.push(event) });
    await userEvent.setup().click(screen.getByRole('button', { name: 'begin' }));
    await waitFor(() => expect(counted).toEqual([{ name: 'life_start', mode: 'solo' }]));
  });

  it('counts an account kept when the guest comes back from Google a member, and only then', async () => {
    const counted: Counted[] = [];
    const guest = accountAt({ kind: 'guest', userId: 'u-1', notice: null });
    const view = renderGame(<Keep />, { ...memoryServices(), account: guest.account, track: (event) => counted.push(event) });
    await userEvent.setup().click(screen.getByRole('button', { name: 'keep' }));
    await waitFor(() => expect(window.sessionStorage.getItem('ratrace:keeping-account')).toBe('1'));
    view.unmount();

    // The page they come back to: signed in as a member, the same player.
    const back = accountAt({ kind: 'offline' });
    renderGame(<Keep />, { ...memoryServices(), account: back.account, track: (event) => counted.push(event) });
    act(() => back.move({ kind: 'member', userId: 'u-1', email: null }));
    act(() => back.move({ kind: 'member', userId: 'u-1', email: 'x' }));
    expect(counted).toEqual([{ name: 'account_kept' }]);
  });

  it('counts nothing when the guest comes back still a guest, told it did not work', () => {
    const counted: Counted[] = [];
    window.sessionStorage.setItem('ratrace:keeping-account', '1');
    const back = accountAt({ kind: 'offline' });
    renderGame(<Keep />, { ...memoryServices(), account: back.account, track: (event) => counted.push(event) });
    act(() => back.move({ kind: 'guest', userId: 'u-1', notice: 'failed' }));
    // Later signed in some other way: not this guest keeping their account.
    act(() => back.move({ kind: 'member', userId: 'u-1', email: null }));
    expect(counted).toEqual([]);
  });
});
