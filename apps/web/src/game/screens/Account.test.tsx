// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseAccount } from '@/online/supabase';
import type { Cloud } from '@/online/supabase';
import type { Account, AccountSaves, AccountState, CloudSaving } from '@/online/types';
import { memoryServices, renderGame } from '@/testing/render';
import { Preferences } from './Settings';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

afterEach(cleanup);

/** An account whose state the test sets, and which remembers what it was asked. */
function fakeAccount(initial: AccountState, kept = true) {
  let state = initial;
  const listeners = new Set<() => void>();
  const asked: string[] = [];
  const account: Account = {
    state: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: async (language) => {
      asked.push(`start ${language}`);
    },
    keepWithGoogle: async (returnTo) => {
      asked.push(`keep ${returnTo}`);
      return kept;
    },
    useExistingAccount: async (returnTo) => {
      asked.push(`use ${returnTo}`);
      return kept;
    },
    dismissNotice: () => {
      asked.push('dismiss');
      if (state.kind === 'guest') state = { ...state, notice: null };
      for (const listener of listeners) listener();
    },
  };
  return { account, asked };
}
/** The account's copy, standing wherever the test says. */
const savesAt = (status: CloudSaving): AccountSaves => ({
  status: () => status,
  offer: () => null,
  subscribe: () => () => {},
  onDeviceChanged: () => () => {},
  takeOffer: async () => false,
  declineOffer: async () => {},
});
const show = (account?: Account, locale: 'en' | 'es' = 'en', saves?: AccountSaves) => renderGame(<Preferences />, { ...memoryServices(), account, saves }, locale);

describe('the account in the settings', () => {
  it('is not there at all in a game with no cloud behind it', () => {
    show();
    expect(screen.queryByRole('region', { name: 'Account' })).toBeNull();
    expect(screen.getByRole('switch', { name: /Tips from the guide/ })).toBeTruthy();
  });

  it('starts the account once, in the language of the page', async () => {
    const { account, asked } = fakeAccount({ kind: 'offline' });
    show(account, 'es');
    await waitFor(() => expect(asked).toEqual(['start es']));
    expect(screen.queryByRole('region', { name: 'Cuenta' })).toBeNull();
  });

  it('tells a guest so, and sends them to Google and back to this very page when they ask to keep the account', async () => {
    const { account, asked } = fakeAccount({ kind: 'guest', userId: 'u', notice: null });
    const user = userEvent.setup();
    show(account);
    const block = screen.getByRole('region', { name: 'Account' });
    expect(block.textContent).toContain('You are playing as a guest');
    expect(block.textContent).toContain('the same account on every device');
    await user.click(screen.getByRole('button', { name: 'Keep it with Google' }));
    expect(asked).toContain(`keep ${window.location.href}`);
    // On its way to Google: a second press must not start a second journey.
    expect((screen.getByRole('button', { name: 'Keep it with Google' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets a guest try again when the journey could not begin', async () => {
    const { account } = fakeAccount({ kind: 'guest', userId: 'u', notice: null }, false);
    const user = userEvent.setup();
    show(account);
    await user.click(screen.getByRole('button', { name: 'Keep it with Google' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Keep it with Google' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('offers a second device the account its Google already has, and can be told to leave it', async () => {
    const { account, asked } = fakeAccount({ kind: 'guest', userId: 'u', notice: 'taken' });
    const user = userEvent.setup();
    show(account);
    // Most often it is the same player on another device: the way in is offered, and nothing is lost by taking it.
    expect(screen.getByRole('alert').textContent).toBe('That Google account already has a player in this game. If it is you, use it here: what you have on this device joins it.');
    await user.click(screen.getByRole('button', { name: 'Use that account on this device' }));
    expect(asked).toContain(`use ${window.location.href}`);
    expect((screen.getByRole('button', { name: 'Use that account on this device' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets the notice be put away, and is then a guest as before', async () => {
    const { account, asked } = fakeAccount({ kind: 'guest', userId: 'u', notice: 'taken' });
    const user = userEvent.setup();
    show(account);
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(asked).toContain('dismiss');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep it with Google' })).toBeTruthy();
  });

  it('says where the player\'s things are: in the account, on their way to it, or waiting for a connection', () => {
    const member: AccountState = { kind: 'member', userId: 'u', email: null };
    show(fakeAccount(member).account, 'en', savesAt('saved'));
    expect(screen.getByRole('status').textContent).toBe('Saved to your account');
    cleanup();
    show(fakeAccount(member).account, 'en', savesAt('sending'));
    expect(screen.getByRole('status').textContent).toBe('Saving to your account…');
    cleanup();
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }).account, 'es', savesAt('waiting'));
    expect(screen.getByRole('status').textContent).toBe('Guardado en este dispositivo. Esperando conexión.');
  });

  it('says nothing about saving to an account where nothing is being saved to one', () => {
    show(fakeAccount({ kind: 'member', userId: 'u', email: null }).account, 'en', savesAt('off'));
    expect(screen.queryByRole('status')).toBeNull();
    cleanup();
    show(fakeAccount({ kind: 'member', userId: 'u', email: null }).account);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells a guest that the account is in the cloud, and that only this browser can open it', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }).account);
    expect(screen.getByRole('region', { name: 'Account' }).textContent).toContain('You are playing as a guest: an account that only this browser can open.');
  });

  it('says plainly when nothing was linked, whatever the reason', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: 'failed' }).account);
    expect(screen.getByRole('alert').textContent).toBe('Nothing was linked. You are still a guest.');
    expect(screen.queryByRole('button', { name: 'Use that account on this device' })).toBeNull();
  });

  it('shows a kept account as kept, with enough of the address to know it and not the whole of it', () => {
    show(fakeAccount({ kind: 'member', userId: 'u', email: 'ana.garcia@example.com' }).account);
    const block = screen.getByRole('region', { name: 'Account' });
    expect(block.textContent).toContain('Kept with Google');
    // The settings are also drawn on the front door, where anyone beside the player can read them.
    expect(block.textContent).toContain('an•••@example.com');
    expect(block.textContent).not.toContain('ana.garcia');
    expect(screen.queryByRole('button', { name: 'Keep it with Google' })).toBeNull();
  });

  it('works over the real account, not only over a stand-in: a guest signs in, and is shown as one', async () => {
    // The class the game really uses, on a cloud that answers at once. Its methods are handed to React loose,
    // which is how a method that needs `this` breaks the whole page.
    const cloud: Cloud = {
      currentUser: async () => null,
      signInAsGuest: async () => ({ id: 'user-1', is_anonymous: true, email: undefined }),
      linkGoogle: async () => true,
      signInWithGoogle: async () => true,
      ensureProfile: async () => {},
      onUser: () => () => {},
      playingGames: async () => [],
      pushGame: async () => 'saved',
      abandonGame: async () => {},
      loadProgress: async () => null,
      saveProgress: async () => {},
      listRuns: async () => [],
      finishRun: async () => 'done',
      rankedLife: async () => null,
      ranked: {} as Cloud['ranked'],
      community: {} as Cloud['community'],
    };
    show(new SupabaseAccount(async () => cloud, () => 'http://localhost:3000/en', () => {}));
    expect((await screen.findByRole('region', { name: 'Account' })).textContent).toContain('You are playing as a guest');
  });

  it('speaks Spanish', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }).account, 'es');
    expect(screen.getByRole('region', { name: 'Cuenta' }).textContent).toContain('Juegas como invitado');
    expect(screen.getByRole('button', { name: 'Conservarla con Google' })).toBeTruthy();
  });
});
