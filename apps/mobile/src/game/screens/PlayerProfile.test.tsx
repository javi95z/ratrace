// @vitest-environment jsdom
import { avatarOf, mayWear, ratColourOf, ratLookOf } from '@ratrace/core/game/avatar';
import { newProfile } from '@ratrace/core/session/types';
import type { FinishedRun } from '@ratrace/core/session/types';
import type { RoundActions, RoundState } from '@ratrace/core/game/store';
import type { Account, AccountState, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clipboard } from '../../testing/fakes';
import { memoryServices, renderGame, router } from '../../testing/render';
import { Counted, settled } from '../../testing/renders';
import type { Renders } from '../../testing/renders';
import { useGame } from '../context';
import { PlayerProfile } from './PlayerProfile';

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

/** A profile on the server, remembering what it was asked to keep; one that refuses to keep a rat, where a test says so. */
function profile({ refuses = false }: { refuses?: boolean } = {}) {
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
      if (refuses) return false;
      me.avatar = avatar;
      return true;
    },
  } as unknown as Community;
  return { community, asked };
}

const member: AccountState = { kind: 'member', userId: 'u-1', email: null };
const show = (state: AccountState, community: Community | null, services = memoryServices()) => renderGame(<PlayerProfile />, { ...services, account: accountAs(state), community: () => community });

/** What react-native-web keeps of a view's onLayout: calling it is what its observer does once the view is laid out. */
type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
const layout = (node: Element, width: number) => (node as Laid).__reactLayoutHandler?.({ nativeEvent: { layout: { x: 0, y: 0, width, height: 300 } } });

/** A radio's state, as react-native-web writes it. */
const checked = (radio: HTMLElement) => radio.getAttribute('aria-checked');

const run = (runId: string, over: Partial<FinishedRun> = {}): FinishedRun => ({
  format: 1, runId, engineVersion: 'e', contentVersion: 'c', lifeId: 'nurse', seed: 's', log: [], finishedAt: 1, score: 300, netWorth: 50_000_000, status: 20,
  escapedAtRound: null, bankruptcies: 0, history: [300_000], badges: [], cities: ['madrid'], verified: false, ...over,
});

describe('the player\'s profile', () => {
  it('draws the big rat once the member is read, in the look they wear: no canvas of another look first, hidden', async () => {
    const { community } = profile();
    let answer: (found: { nickname: string; friendCode: string; avatar: string | null }) => void = () => {};
    const waiting = { ...community, me: () => new Promise((done) => (answer = done)) } as unknown as Community;
    const { container } = show(member, waiting);
    const big = () => container.querySelectorAll('[data-skia="Canvas"][data-size="128x128"]');
    expect(big()).toHaveLength(0);
    await act(async () => answer({ nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: null }));
    await waitFor(() => expect(big()).toHaveLength(1));
  });

  it('asks nobody to sign in before the account has tried to', () => {
    renderGame(<PlayerProfile />, { ...memoryServices(), account: { ...accountAs({ kind: 'offline' }), settled: () => false }, community: () => null });
    expect(screen.queryByText('Sign in with Google to have a profile others can see.')).toBeNull();
    // The way back and the title are there all the same.
    expect(screen.getByRole('heading', { name: 'Your profile' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
  });

  it('asks a player with no Google account to sign in, and offers nothing to change', async () => {
    show({ kind: 'guest', userId: 'g', notice: null }, profile().community);
    expect(await screen.findByText('Sign in with Google to have a profile others can see.')).toBeTruthy();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('keeps the rat the player dresses, a part at a time, and shows each part chosen', async () => {
    const { community, asked } = profile();
    show(member, community);
    // One is theirs before they choose, the same every time: a fur, a colour, and nothing on.
    const given = ratLookOf(null, 'u-1');
    const furs = await screen.findByRole('radiogroup', { name: 'Fur' });
    expect(within(furs).getAllByRole('radio').filter((radio) => checked(radio) === 'true')).toHaveLength(1);
    // Three tabs: the rat itself, what it wears, what is behind it.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Body', 'Clothes', 'Backdrop']);
    // A hat, kept at once and shown chosen.
    fireEvent.click(screen.getByRole('tab', { name: 'Clothes' }));
    expect(screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))).toEqual(['Clothes', 'Headwear', 'Eyes']);
    const hats = () => screen.getByRole('radiogroup', { name: 'Headwear' });
    expect(checked(within(hats()).getByRole('radio', { name: 'None' }))).toBe('true');
    // Each choice shows what it offers, on a plain rat: it does not change with the rest of the player's rat.
    const suit = () => within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Suit' }).innerHTML;
    const suitBefore = suit();
    fireEvent.click(within(hats()).getByRole('radio', { name: 'Beanie' }));
    const capped = { ...given, hat: 'beanie' as const };
    await waitFor(() => expect(asked).toEqual([`avatar ${avatarOf(capped)}`]));
    expect(checked(within(hats()).getByRole('radio', { name: 'Beanie' }))).toBe('true');
    expect(checked(within(hats()).getByRole('radio', { name: 'None' }))).toBe('false');
    expect(suit()).toBe(suitBefore);
    // A crown is for the highest rank of rat: until then it says how it is won, and nothing is kept.
    const crown = within(hats()).getByRole('radio', { name: 'Crown' });
    expect(crown.getAttribute('data-locked')).toBe('true');
    fireEvent.click(crown);
    expect(await screen.findByText(/^Unlocked on reaching /)).toBeTruthy();
    expect(asked).toHaveLength(1);
    // Nothing worn is marked as such, over its picture, once the tab is laid out: a cross for each part that may be left off.
    expect(screen.queryByText('✕')).toBeNull();
    await act(async () => {
      layout(screen.getByRole('tabpanel'), 380);
      screen.getAllByRole('radiogroup').forEach((grid) => layout(grid, 380));
    });
    expect(screen.getAllByText('✕')).toHaveLength(3);
    // And the colour of the ground, kept with the hat.
    fireEvent.click(screen.getByRole('tab', { name: 'Backdrop' }));
    const other = given.colour === 'teal' ? 'gold' : 'teal';
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Colour' })).getByRole('radio', { name: other === 'gold' ? 'Gold' : 'Teal' }));
    await waitFor(() => expect(asked.at(-1)).toBe(`avatar ${avatarOf({ ...capped, colour: other })}`));
  });

  it('puts a rat together at random, from what the player may wear', async () => {
    const { community, asked } = profile();
    show(member, community);
    // The last of every list: past what a new player has opened, were the locked ones not left out.
    const dice = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    try {
      fireEvent.click(await screen.findByRole('button', { name: '🎲 At random' }));
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

  it('puts the rat back, and says so, when the server would not keep it', async () => {
    const { community, asked } = profile({ refuses: true });
    show(member, community);
    const furs = await screen.findByRole('radiogroup', { name: 'Fur' });
    const before = within(furs).getAllByRole('radio').find((radio) => checked(radio) === 'true')!;
    const other = within(furs).getAllByRole('radio').find((radio) => checked(radio) === 'false')!;
    fireEvent.click(other);
    expect(await screen.findByText('It could not be saved. Try again.')).toBeTruthy();
    expect(asked).toHaveLength(1);
    expect(checked(before)).toBe('true');
    expect(checked(other)).toBe('false');
  });

  it('changes the name, and says why one is not taken', async () => {
    const { community, asked } = profile();
    show(member, community);
    // The name is shown as it is, and changed in place on a tap.
    expect(await screen.findByText('Rata_Uno')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change your name' }));
    const field = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    await waitFor(() => expect(field.value).toBe('Rata_Uno'));
    fireEvent.change(field, { target: { value: 'no' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toMatch(/3 to 16/);
    fireEvent.change(field, { target: { value: 'Taken_One' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(asked).toContain('rename Taken_One'));
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    // Let go of, the name is as it was.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Rata_Uno')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change your name' }));
    const again = screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement;
    expect(again.value).toBe('Rata_Uno');
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.change(again, { target: { value: 'Rata_Dos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(asked).toContain('rename Rata_Dos'));
    expect(await screen.findByText('Rata_Dos')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('copies the friend code on a tap, and says so', async () => {
    show(member, profile().community);
    const code = await screen.findByRole('button', { name: /ABCD2345/ });
    expect(code.textContent).toBe('Your friend codeABCD2345· Copy');
    fireEvent.click(code);
    await waitFor(() => expect(clipboard.text).toBe('ABCD2345'));
    expect(await screen.findByText('Code copied')).toBeTruthy();
  });

  it('says nothing where the phone does not take the code: it is on screen to be copied by hand', async () => {
    clipboard.refuses = true;
    show(member, profile().community);
    fireEvent.click(await screen.findByRole('button', { name: /ABCD2345/ }));
    await settled();
    expect(screen.queryByText('Code copied')).toBeNull();
  });

  it('shows what the player has lived at a glance: lives, the best score, badges, games with others', async () => {
    const services = memoryServices();
    await services.store.addRun(run('a', { score: 1200 }));
    await services.store.addRun(run('b', { score: 3400, room: true }));
    await services.store.saveProfile({ ...newProfile(), badges: { escaped: { at: 1, gameId: 'a' }, mba: { at: 2, gameId: 'b' } } });
    show(member, profile().community, services);
    const figures = await screen.findByLabelText('Your figures');
    await waitFor(() => expect(figures.textContent).toBe('2Lives3,400Best2Badges1Games'));
  });

  it('shows the rat rank and leads to the rest of the player\'s game', async () => {
    show(member, profile().community);
    expect(await screen.findByText('Sewer rat')).toBeTruthy();
    expect(screen.getByText('Rank 1 of 6')).toBeTruthy();
    for (const [name, path] of [['Records', '/records'], ['Collection', '/collection'], ['Rankings', '/rankings']] as const) {
      fireEvent.click(screen.getByRole('link', { name }));
      expect(router.push).toHaveBeenLastCalledWith(path);
    }
  });

  it('draws nothing again for a step of the game it does not show', async () => {
    const renders: Renders = { count: 0 };
    const { community } = profile();
    const probe: { state: (RoundState & RoundActions) | null } = { state: null };
    function Probe() {
      probe.state = useGame((s) => s);
      return null;
    }
    renderGame(
      <>
        <Probe />
        <Counted into={renders}>
          <PlayerProfile />
        </Counted>
      </>,
      { ...memoryServices(), account: accountAs(member), community: () => community },
    );
    await screen.findByText('Rata_Uno');
    await settled(() => probe.state?.start('nurse'));
    await settled(() => probe.state?.leaveNews());
    const before = renders.count;
    await settled(() => probe.state?.pick(0));
    await settled(() => probe.state?.afterCard());
    expect(probe.state?.view?.answered).toBe(1);
    expect(renders.count).toBe(before);
  });

  it('is given the code just copied, for a scene: the toast says so from the start', async () => {
    const { community } = profile();
    renderGame(<PlayerProfile copied />, { ...memoryServices(), account: accountAs(member), community: () => community });
    expect(await screen.findByText('Code copied')).toBeTruthy();
    await act(async () => undefined);
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
