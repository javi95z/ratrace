// @vitest-environment jsdom
import { avatarOf, ratLookOf } from '@ratrace/core/game/avatar';
import type { RatLook } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { Account, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSpritesWith } from '../../ui/spriteImages';
import { memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { PlayerProfile } from './PlayerProfile';
import { RatEditor, type RatPart } from './RatEditor';

// Each sprite's file is its name, read at once: what a canvas draws is then written on it.
vi.mock('../../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => `src:${String(id)}`,
      getOwnPropertyDescriptor: (_, id) => ({ value: `src:${String(id)}`, configurable: true, enumerable: true }),
    },
  ),
}));

/** Whether the window is a desk's (a tablet held sideways): a phone's unless a test says so. */
const desk = vi.hoisted(() => ({ on: false }));
vi.mock('../../ui/desk', async (original) => ({ ...(await original<typeof import('../../ui/desk')>()), useIsDesk: () => desk.on }));

beforeEach(() => {
  loadSpritesWith(async (source) => ({ src: String(source), width: () => 8, height: () => 8, dispose: () => {} }) as never);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LOOK: RatLook = { colour: 'sky', body: 'grey', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };
/** The editor's room as a phone of 393 by 852 leaves it, between its head and its foot: the column less its gutters. */
const ROOM = { width: 369, height: 640 };

/** What react-native-web keeps of a view's onLayout: calling it is what its observer does once the view is laid out. */
type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
const layout = (node: Element, width: number, height: number) => (node as Laid).__reactLayoutHandler?.({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
/** The editor laid out, as the phone does once it is drawn. */
async function layOut(room = ROOM) {
  await act(async () => {
    layout(screen.getByTestId('rat-editor'), room.width, room.height);
  });
  await settled();
}

/** The editor over a rat it keeps itself, as the profile does: what it saves, and whether it was closed. */
function editor({ earned = {}, rank = 'sewer', part }: { earned?: Record<string, unknown>; rank?: RankId; part?: RatPart } = {}) {
  const told = { saved: [] as RatLook[], closed: 0 };
  renderGame(
    <RatEditor
      look={LOOK}
      earned={earned}
      rank={rank}
      badgeName={(id) => `badge ${id}`}
      rankName={(id) => `rank ${id}`}
      onSave={(next) => told.saved.push(next)}
      onClose={() => (told.closed += 1)}
      part={part}
    />,
    memoryServices(),
  );
  return told;
}

const radios = () => within(screen.getByRole('radiogroup')).getAllByRole('radio');
const checked = () => radios().find((radio) => radio.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label');
const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));
/** The rat swiped sideways by `dx`, as a finger does. */
const swipe = (dx: number) => {
  const rat = screen.getByRole('slider');
  fireEvent.touchStart(rat, { changedTouches: [{ pageX: 200, pageY: 100 }] });
  fireEvent.touchMove(rat, { changedTouches: [{ pageX: 200 + dx / 2, pageY: 102 }] });
  fireEvent.touchEnd(rat, { changedTouches: [{ pageX: 200 + dx, pageY: 104 }] });
};

describe('the rat, a part at a time', () => {
  it('shows every part in one row, the one picked selected, and the choices of the part picked', async () => {
    editor();
    await layOut();
    const tabs = within(screen.getByRole('tablist', { name: 'What to change' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Fur', 'Face', 'Clothes', 'Headwear', 'Eyes', 'Backdrop', 'Colour']);
    expect(screen.getByRole('tab', { name: 'Fur' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('Fur');
    // A fur is always worn: no choice of none.
    expect(radios()[0].getAttribute('aria-label')).not.toBe('None');
    fireEvent.click(screen.getByRole('tab', { name: 'Headwear' }));
    expect(screen.getByRole('tab', { name: 'Headwear' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Fur' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('radiogroup').getAttribute('aria-label')).toBe('Headwear');
    expect(radios()[0].getAttribute('aria-label')).toBe('None');
    expect(checked()).toBe('None');
    // Nothing worn is said with a cross over its picture.
    expect(screen.getByText('✕')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Colour' }));
    expect(radios().map((radio) => radio.getAttribute('aria-label'))).toEqual(['Gold', 'Teal', 'Wine', 'Sky', 'Coral', 'Emerald', 'Cream', 'Slate']);
    expect(checked()).toBe('Sky');
  });

  it('pages the choices two rows at a time, a dot for each page, the page of the one chosen in sight', async () => {
    editor({ part: 'hat' });
    await layOut();
    // Seventeen hats, five to a row of two: two pages, the first in sight.
    const dots = () => [...document.querySelectorAll('[data-page-dot]')].map((dot) => dot.getAttribute('data-page-dot'));
    expect(dots()).toEqual(['on', 'off']);
    const tiles = radios();
    expect(tiles).toHaveLength(17);
    const left = (tile: HTMLElement) => parseFloat(tile.style.left);
    // Each page as wide as the strip: the eleventh hat stands on the second, the first of its row, where the first stands on the first.
    const page = (tile: HTMLElement) => tile.parentElement!;
    expect(page(tiles[10])).not.toBe(page(tiles[0]));
    expect(page(tiles[9])).toBe(page(tiles[0]));
    expect(page(tiles[10]).style.width).toBe(`${ROOM.width}px`);
    expect(left(tiles[10])).toBeCloseTo(left(tiles[0]));
    expect(parseFloat(tiles[5].style.top)).toBeGreaterThan(parseFloat(tiles[0].style.top));
    // A hat of the second page chosen brings that page into sight.
    const open = tiles.slice(10).find((tile) => tile.getAttribute('data-locked') === null)!;
    fireEvent.click(open);
    await settled();
    expect(open.getAttribute('aria-checked')).toBe('true');
    expect(dots()).toEqual(['off', 'on']);
  });

  it('wears the next choice when the rat is swiped to the left and the one before to the right, passing over a prize not won', async () => {
    editor({ part: 'hat' });
    await layOut();
    const names = radios().map((radio) => radio.getAttribute('aria-label'));
    const open = radios().filter((radio) => radio.getAttribute('data-locked') === null).map((radio) => radio.getAttribute('aria-label'));
    expect(open.length).toBeLessThan(names.length);
    swipe(-80);
    expect(checked()).toBe(open[1]);
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).toBe(open[1]);
    swipe(80);
    swipe(80);
    // Round the end, to the last hat that may be worn: never a locked one.
    expect(checked()).toBe(open[open.length - 1]);
    // A touch that hardly moves, or goes up and down, is no swipe.
    swipe(-10);
    expect(checked()).toBe(open[open.length - 1]);
  });

  it('says in a sheet how a prize not won yet is won, and the rat is as it was', async () => {
    const told = editor({ part: 'hat' });
    await layOut();
    const crown = within(screen.getByRole('radiogroup')).getByRole('radio', { name: 'Crown' });
    expect(crown.getAttribute('data-locked')).toBe('true');
    fireEvent.click(crown);
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Unlocked on reaching rank king')).toBeTruthy();
    expect(crown.getAttribute('aria-checked')).toBe('false');
    expect(checked()).toBe('None');
    save();
    expect(told.saved).toEqual([LOOK]);
  });

  it('wears a prize once it is won', async () => {
    const told = editor({ part: 'hat', earned: { escaped: { at: 1 } }, rank: 'king' });
    await layOut();
    const crown = within(screen.getByRole('radiogroup')).getByRole('radio', { name: 'Crown' });
    expect(crown.getAttribute('data-locked')).toBeNull();
    fireEvent.click(crown);
    fireEvent.click(screen.getByRole('tab', { name: 'Clothes' }));
    fireEvent.click(within(screen.getByRole('radiogroup')).getByRole('radio', { name: 'Gold jacket' }));
    save();
    expect(told.saved).toEqual([{ ...LOOK, hat: 'crown', outfit: 'gold' }]);
  });

  it('puts a rat together by chance from what may be worn', async () => {
    const told = editor();
    await layOut();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    fireEvent.click(screen.getByRole('button', { name: '🎲 At random' }));
    save();
    expect(told.saved).toEqual([{ colour: 'gold', body: 'grey', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null }]);
  });

  it('keeps the rat only on Save, and closes; the way back leaves it as it was', async () => {
    const told = editor({ part: 'hat' });
    await layOut();
    fireEvent.click(within(screen.getByRole('radiogroup')).getByRole('radio', { name: 'Beanie' }));
    expect(told.saved).toEqual([]);
    save();
    expect(told.saved).toEqual([{ ...LOOK, hat: 'beanie' }]);
    expect(told.closed).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(told.saved).toHaveLength(1);
    expect(told.closed).toBe(2);
  });

  it('lays the rat beside every choice at a desk, with no pages', async () => {
    desk.on = true;
    try {
      editor({ part: 'hat' });
      await layOut({ width: 936, height: 560 });
      expect(document.querySelectorAll('[data-page-dot]')).toHaveLength(0);
      const tiles = radios();
      // Every hat on the one page, within the picker's half.
      expect(new Set(tiles.map((tile) => tile.parentElement)).size).toBe(1);
      expect(Math.max(...tiles.map((tile) => parseFloat(tile.style.left)))).toBeLessThan(480);
    } finally {
      desk.on = false;
    }
  });
});

describe('the rat, kept', () => {
  const accountOf = (userId: string): Account => {
    // One state, the same each time it is read, as an account's is until it changes.
    const state = { kind: 'member' as const, userId, email: null };
    return {
      state: () => state,
      subscribe: () => () => {},
      start: async () => {},
      keepWithGoogle: async () => true,
      useExistingAccount: async () => true,
      dismissNotice: () => {},
      signOut: async () => true,
    };
  };

  it('is changed on a screen of its own and saved through the game\'s cloud', async () => {
    const kept: string[] = [];
    const community = {
      me: async () => ({ nickname: 'Rata_Uno', friendCode: 'ABCD2345', avatar: null }),
      rename: async () => 'ok' as const,
      setAvatar: async (avatar: string) => {
        kept.push(avatar);
        return true;
      },
    } as unknown as Community;
    renderGame(<PlayerProfile />, { ...memoryServices(), account: accountOf('u-1'), community: () => community });
    fireEvent.click(await screen.findByRole('button', { name: 'Change your rat' }));
    await layOut();
    // The profile gives way to the editor.
    expect(screen.queryByText('Rata_Uno')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Face' }));
    fireEvent.click(within(screen.getByRole('radiogroup')).getByRole('radio', { name: 'Wink' }));
    expect(kept).toEqual([]);
    save();
    await waitFor(() => expect(kept).toEqual([avatarOf({ ...ratLookOf(null, 'u-1'), face: 'wink' })]));
    // Back on the profile.
    expect(await screen.findByText('Rata_Uno')).toBeTruthy();
    // Saved again unchanged, nothing to keep.
    fireEvent.click(screen.getByRole('button', { name: 'Change your rat' }));
    await layOut();
    save();
    await act(async () => undefined);
    expect(kept).toHaveLength(1);
  });
});
