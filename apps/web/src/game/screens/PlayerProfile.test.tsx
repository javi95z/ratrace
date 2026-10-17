// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ratColourOf } from '@/game/avatar';
import type { Account, AccountState, Community } from '@/online/types';
import { memoryServices, renderGame } from '@/testing/render';
import { PlayerProfile } from './PlayerProfile';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, className, 'aria-label': label }: { href: string; children: ReactNode; className?: string; 'aria-label'?: string }) => (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/player',
}));

afterEach(cleanup);

const accountAs = (state: AccountState): Account => ({
  state: () => state,
  subscribe: () => () => {},
  start: async () => {},
  keepWithGoogle: async () => true,
  useExistingAccount: async () => true,
  dismissNotice: () => {},
  signOut: async () => true,
});

/** A profile on the server, remembering what it was asked to keep. */
function profile() {
  const me = { nickname: 'Rata_Uno' as string | null, friendCode: 'ABCD2345', avatar: null as string | null };
  const asked: string[] = [];
  const community = {
    me: async () => ({ ...me }),
    rename: async (name: string) => {
      asked.push(`rename ${name}`);
      if (name === 'Taken_One') return 'taken' as const;
      me.nickname = name;
      return 'ok' as const;
    },
    setAvatar: async (avatar: string) => {
      asked.push(`avatar ${avatar}`);
      me.avatar = avatar;
      return true;
    },
  } as unknown as Community;
  return { community, asked };
}

const show = (state: AccountState, community: Community | null) => renderGame(<PlayerProfile />, { ...memoryServices(), account: accountAs(state), community: () => community });

describe('the player\'s profile', () => {
  it('asks a player with no Google account to sign in, and offers nothing to change', async () => {
    show({ kind: 'guest', userId: 'g', notice: null }, profile().community);
    expect(await screen.findByText('Sign in with Google to have a profile others can see.')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('keeps the rat the player picks, and shows it chosen', async () => {
    const { community, asked } = profile();
    const user = userEvent.setup();
    show({ kind: 'member', userId: 'u-1', email: null }, community);
    const rats = await screen.findByRole('radiogroup', { name: 'Your rat' });
    // One is theirs before they choose, the same every time.
    const given = ratColourOf(null, 'u-1');
    expect(within(rats).getAllByRole('radio').filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    const other = given === 'teal' ? 'Gold' : 'Teal';
    await user.click(within(rats).getByRole('radio', { name: other }));
    await waitFor(() => expect(asked).toEqual([`avatar rat_${other.toLowerCase()}`]));
    expect(within(rats).getByRole('radio', { name: other }).getAttribute('aria-checked')).toBe('true');
  });

  it('changes the name, and says why one is not taken', async () => {
    const { community, asked } = profile();
    const user = userEvent.setup();
    show({ kind: 'member', userId: 'u-1', email: null }, community);
    // The name is shown as it is, and changed in place on a tap.
    expect(await screen.findByText('Rata_Uno')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Change your name' }));
    const field = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect((field as HTMLInputElement).value).toBe('Rata_Uno'));
    await user.clear(field);
    await user.type(field, 'no');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toMatch(/3 to 16/);
    await user.clear(field);
    await user.type(field, 'Taken_One');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    await user.clear(field);
    await user.type(field, 'Rata_Dos');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(asked).toContain('rename Rata_Dos'));
    expect(await screen.findByText('Rata_Dos')).toBeTruthy();
  });
});

describe('a player\'s rat', () => {
  it('is the one chosen, or the same one picked from their id every time', () => {
    expect(ratColourOf('rat_wine', 'anyone')).toBe('wine');
    expect(ratColourOf(null, 'u-7')).toBe(ratColourOf(null, 'u-7'));
    expect(ratColourOf('nurse', 'u-7')).toBe(ratColourOf(null, 'u-7'));
    expect(ratColourOf('rat_purple', 'u-7')).toBe(ratColourOf(null, 'u-7'));
  });
});
