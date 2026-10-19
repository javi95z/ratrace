// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { avatarOf, mayWear, ratColourOf, ratLookOf } from '@ratrace/core/game/avatar';
import type { Account, AccountState, Community } from '@ratrace/online/types';
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
  it('asks nobody to sign in before the account has tried to', () => {
    renderGame(<PlayerProfile />, { ...memoryServices(), account: { ...accountAs({ kind: 'offline' }), settled: () => false }, community: () => null });
    expect(screen.queryByText('Sign in with Google to have a profile others can see.')).toBeNull();
  });

  it('asks a player with no Google account to sign in, and offers nothing to change', async () => {
    show({ kind: 'guest', userId: 'g', notice: null }, profile().community);
    expect(await screen.findByText('Sign in with Google to have a profile others can see.')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('keeps the rat the player dresses, a part at a time, and shows each part chosen', async () => {
    const { community, asked } = profile();
    const user = userEvent.setup();
    show({ kind: 'member', userId: 'u-1', email: null }, community);
    // One is theirs before they choose, the same every time: a fur, a colour, and nothing on.
    const given = ratLookOf(null, 'u-1');
    const furs = await screen.findByRole('radiogroup', { name: 'Fur' });
    expect(within(furs).getAllByRole('radio').filter((radio) => radio.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    // Three tabs: the rat itself, what it wears, what is behind it.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Body', 'Clothes', 'Backdrop']);
    // A hat, kept at once and shown chosen.
    await user.click(screen.getByRole('tab', { name: 'Clothes' }));
    expect(screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))).toEqual(['Clothes', 'Headwear', 'Eyes']);
    const hats = screen.getByRole('radiogroup', { name: 'Headwear' });
    expect(within(hats).getByRole('radio', { name: 'None' }).getAttribute('aria-checked')).toBe('true');
    await user.click(within(hats).getByRole('radio', { name: 'Beanie' }));
    const capped = { ...given, hat: 'beanie' as const };
    await waitFor(() => expect(asked).toEqual([`avatar ${avatarOf(capped)}`]));
    expect(within(hats).getByRole('radio', { name: 'Beanie' }).getAttribute('aria-checked')).toBe('true');
    // A crown is for the highest rank of rat: until then it says how it is won, and nothing is kept.
    await user.click(within(hats).getByRole('radio', { name: 'Crown' }));
    expect(asked).toHaveLength(1);
    expect(within(hats).getByRole('radio', { name: 'Crown' }).getAttribute('title')).toMatch(/^Unlocked on reaching /);
    // Nothing worn is marked as such.
    expect(within(hats).getByRole('radio', { name: 'None' }).textContent).toBe('✕');
    // And the colour of the ground, kept with the hat.
    await user.click(screen.getByRole('tab', { name: 'Backdrop' }));
    const other = given.colour === 'teal' ? 'gold' : 'teal';
    await user.click(within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', { name: other === 'gold' ? 'Gold' : 'Teal' }));
    await waitFor(() => expect(asked.at(-1)).toBe(`avatar ${avatarOf({ ...capped, colour: other })}`));
  });

  it('puts a rat together at random, from what the player may wear', async () => {
    const { community, asked } = profile();
    const user = userEvent.setup();
    show({ kind: 'member', userId: 'u-1', email: null }, community);
    // The last of every list: past what a new player has opened, were the locked ones not left out.
    const dice = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    try {
      await user.click(await screen.findByRole('button', { name: '🎲 At random' }));
    } finally {
      dice.mockRestore();
    }
    await waitFor(() => expect(asked).toHaveLength(1));
    const look = ratLookOf(asked[0].replace('avatar ', ''), 'u-1');
    for (const layer of ['body', 'face', 'outfit', 'hat', 'eyes', 'backdrop'] as const) {
      const piece = look[layer];
      if (piece !== null) expect(mayWear(layer, piece, {}, 'sewer'), `${layer} ${piece}`).toBe(true);
    }
    expect(look.hat).not.toBeNull();
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
  it('wears what its rank has opened, and what its badges have won', () => {
    expect(mayWear('hat', 'beanie', {}, 'sewer')).toBe(true);
    expect(mayWear('outfit', 'suit', {}, 'sewer')).toBe(false);
    expect(mayWear('outfit', 'suit', {}, 'office')).toBe(true);
    expect(mayWear('hat', 'crown', {}, 'tycoon')).toBe(false);
    expect(mayWear('hat', 'crown', {}, 'king')).toBe(true);
    expect(mayWear('outfit', 'gold', {}, 'king')).toBe(false);
    expect(mayWear('outfit', 'gold', { escaped: { at: 1 } }, 'sewer')).toBe(true);
  });

  it('is the one chosen, or the same one picked from their id every time', () => {
    expect(ratColourOf('rat_wine', 'anyone')).toBe('wine');
    expect(ratLookOf(null, 'u-7')).toEqual(ratLookOf(null, 'u-7'));
    expect(ratLookOf('nurse', 'u-7')).toEqual(ratLookOf(null, 'u-7'));
    expect(ratLookOf('rat_purple', 'u-7')).toEqual(ratLookOf(null, 'u-7'));
    expect(ratLookOf('rat_xzzzzzz', 'u-7')).toEqual({ ...ratLookOf(null, 'u-7') });
  });

  it('is kept in a word the profile takes, and read back the same', () => {
    const look = { colour: 'sky', body: 'spotted', face: 'smug', outfit: 'tuxedo', hat: 'halo', eyes: null, backdrop: 'beach' } as const;
    const kept = avatarOf(look);
    expect(kept).toMatch(/^[a-z0-9_]{1,40}$/);
    expect(ratLookOf(kept, 'anyone')).toEqual(look);
    // One kept before rats had faces of their own wears the calm one.
    expect(ratLookOf('rat_x7a0g03', 'u-7')).toMatchObject({ body: 'spotted', face: 'calm', colour: 'sky' });
    // An older choice of a colour alone keeps its colour.
    expect(ratLookOf('rat_gold', 'u-7')).toEqual({ ...ratLookOf(null, 'u-7'), colour: 'gold' });
  });
});
