// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Account, AccountState } from '@/online/types';
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
    dismissNotice: () => {
      asked.push('dismiss');
      if (state.kind === 'guest') state = { ...state, notice: null };
      for (const listener of listeners) listener();
    },
  };
  return { account, asked };
}
const show = (account?: Account, locale: 'en' | 'es' = 'en') => renderGame(<Preferences />, { ...memoryServices(), account }, locale);

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
    // Nothing is promised that is not true yet: lives are still saved on this device.
    expect(block.textContent).toContain('still saved on this device only');
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

  it('says, once, that the Google account chosen already has a player, and that nothing changed', async () => {
    const { account, asked } = fakeAccount({ kind: 'guest', userId: 'u', notice: 'taken' });
    const user = userEvent.setup();
    show(account);
    expect(screen.getByRole('alert').textContent).toBe('That Google account already has a player in this game. Nothing was changed.');
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(asked).toContain('dismiss');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Keep it with Google' })).toBeTruthy();
  });

  it('says when Google could not be reached', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: 'failed' }).account);
    expect(screen.getByRole('alert').textContent).toBe('Google could not be reached. You are still a guest: try again later.');
  });

  it('shows a kept account as kept, with who it is, and offers nothing more', () => {
    show(fakeAccount({ kind: 'member', userId: 'u', email: 'ana@example.com' }).account);
    const block = screen.getByRole('region', { name: 'Account' });
    expect(block.textContent).toContain('Kept with Google');
    expect(block.textContent).toContain('ana@example.com');
    expect(screen.queryByRole('button', { name: 'Keep it with Google' })).toBeNull();
  });

  it('speaks Spanish', () => {
    show(fakeAccount({ kind: 'guest', userId: 'u', notice: null }).account, 'es');
    expect(screen.getByRole('region', { name: 'Cuenta' }).textContent).toContain('Juegas como invitado');
    expect(screen.getByRole('button', { name: 'Conservarla con Google' })).toBeTruthy();
  });
});
