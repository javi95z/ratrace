// @vitest-environment jsdom
import { avatarOf, ratLookOf } from '@ratrace/core/game/avatar';
import type { RatLook } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { Account, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement, useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSpritesWith } from '../../ui/spriteImages';
import { memoryServices, renderGame } from '../../testing/render';
import { settled } from '../../testing/renders';
import { PlayerProfile } from './PlayerProfile';
import { RatEditor } from './RatEditor';

/**
 * Every canvas drawn, by its size, in the order drawn, and every canvas mounted (a view of its own on the phone): the rat above the choices is 44
 * square, a tab's choices one canvas as large as the tab.
 */
const canvases = vi.hoisted(() => ({ drawn: [] as string[], mounted: [] as string[] }));
vi.mock('../../ui/Canvas', async (original) => {
  const real = await original<typeof import('../../ui/Canvas')>();
  function Counted(props: ComponentProps<typeof real.Canvas>) {
    const style = props.style as { width?: number; height?: number } | undefined;
    const size = `${style?.width}x${style?.height}`;
    canvases.drawn.push(size);
    useEffect(() => void canvases.mounted.push(size), []); // eslint-disable-line react-hooks/exhaustive-deps
    return createElement(real.Canvas, props);
  }
  return { Canvas: Counted };
});
/** The choices drawn, each time one is: what is pressed of a choice is its raised frame, the only one with its 4 of padding. */
const tiles = vi.hoisted(() => ({ drawn: 0 }));
vi.mock('../../ui/Frame', async (original) => {
  const real = await original<typeof import('../../ui/Frame')>();
  return {
    ...real,
    Framed: (props: ComponentProps<typeof real.Framed>) => {
      if (props.kind === 'raised' && (props.style as { padding?: number } | undefined)?.padding === 4) tiles.drawn += 1;
      return createElement(real.Framed, props);
    },
  };
});
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

beforeEach(() => {
  loadSpritesWith(async (source) => ({ src: String(source), width: () => 8, height: () => 8, dispose: () => {} }) as never);
  canvases.drawn.length = 0;
  canvases.mounted.length = 0;
  tiles.drawn = 0;
});
afterEach(cleanup);

const LOOK: RatLook = { colour: 'sky', body: 'grey', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };
const PREVIEW = '44x44';
/** The tab as the phone lays it out here: 380 wide, each part's grid 400 below the last. Its choices are then 71.2 square (5 to a row, 6 apart). */
const WIDTH = 380;
const count = (size: string) => canvases.drawn.filter((drawn) => drawn === size).length;
/** What react-native-web keeps of a view's onLayout: calling it is what its observer does once the view is laid out. */
type Laid = HTMLElement & { __reactLayoutHandler?: (event: unknown) => void };
const layout = (node: Element, x: number, y: number, width: number, height: number) =>
  (node as Laid).__reactLayoutHandler?.({ nativeEvent: { layout: { x, y, width, height } } });
/** The tab laid out, as the phone does once it is drawn: its width, and where each part's grid stands in it. */
async function layOut() {
  await act(async () => {
    layout(screen.getByRole('tabpanel'), 0, 0, WIDTH, 1200);
    screen.getAllByRole('radiogroup').forEach((grid, i) => layout(grid, 0, 30 + i * 400, WIDTH, 300));
  });
  await settled();
}
/** The canvas of the tab's choices, once laid out. */
const choicesCanvas = () => [...document.querySelectorAll('[data-skia="Canvas"]')].find((canvas) => canvas.getAttribute('data-size') !== PREVIEW);

/** The editor over a rat it keeps itself, as the profile does: what it is told, and the rat as it now is. */
function editor({ earned = {}, rank = 'sewer', tab }: { earned?: Record<string, unknown>; rank?: RankId; tab?: 'body' | 'wear' | 'scene' } = {}) {
  const told = { picked: [] as RatLook[], locked: [] as string[] };
  function Kept() {
    const [look, setLook] = useState(LOOK);
    return (
      <RatEditor
        look={look}
        earned={earned}
        rank={rank}
        badgeName={(id) => `badge ${id}`}
        rankName={(id) => `rank ${id}`}
        onPick={(next) => {
          told.picked.push(next);
          setLook(next);
        }}
        onLocked={(message) => told.locked.push(message)}
        tab={tab}
      />
    );
  }
  renderGame(<Kept />, memoryServices());
  return told;
}

/** The pictures a canvas draws, by the sprite each is. */
const imagesOf = (canvas: Element) => [...canvas.querySelectorAll('[data-skia="Image"]')].map((image) => (JSON.parse(image.getAttribute('data-props') ?? '{}') as { image?: { src?: string } }).image?.src);
/** The canvas of the rat above the choices. */
const preview = () => [...document.querySelectorAll('[data-skia="Canvas"]')].find((canvas) => canvas.getAttribute('data-size') === PREVIEW)!;

describe('the rat, a part at a time', () => {
  it('shows the parts of one tab at a time: the rat itself, what it wears, what is behind it', async () => {
    editor();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Body', 'Clothes', 'Backdrop']);
    expect(screen.getByRole('tablist', { name: 'What to change' })).toBeTruthy();
    const groups = () => screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'));
    expect(groups()).toEqual(['Fur', 'Face']);
    expect(screen.getByRole('tab', { name: 'Body' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'Clothes' }));
    expect(groups()).toEqual(['Clothes', 'Headwear', 'Eyes']);
    expect(screen.getByRole('tab', { name: 'Clothes' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Body' }).getAttribute('aria-selected')).toBe('false');
    fireEvent.click(screen.getByRole('tab', { name: 'Backdrop' }));
    expect(groups()).toEqual(['Backdrop', 'Colour']);
    // Each part under its own name; a fur and a face are always worn, the rest may be left off.
    expect(within(screen.getByRole('radiogroup', { name: 'Backdrop' })).getAllByRole('radio')[0].getAttribute('aria-label')).toBe('None');
    expect(within(screen.getByRole('radiogroup', { name: 'Colour' })).getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))).toEqual(['Gold', 'Teal', 'Wine', 'Sky', 'Coral', 'Emerald', 'Cream', 'Slate']);
    await settled();
  });

  it('draws a tab\'s pictures on one canvas once it is laid out, each choice in its own box of it: the piece on the plain rat, a backdrop alone, a colour its ground', async () => {
    editor({ tab: 'scene' });
    expect(screen.getByRole('tab', { name: 'Backdrop' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))).toEqual(['Backdrop', 'Colour']);
    // Nothing is drawn before the tab is laid out: no canvas at a size of nothing, to be drawn again.
    await settled();
    expect(choicesCanvas()).toBeUndefined();
    await layOut();
    const canvas = choicesCanvas()!;
    // As large as the tab: as wide, and down to the foot of its last grid (two rows of 71.2, 6 apart, 430 down).
    expect(canvas.getAttribute('data-size')).toBe(`${WIDTH}x${430 + 2 * 71.2 + 6}`);
    // Every backdrop, and no rat: a backdrop is shown alone. The three a new rat has not reached the rank for are under a lock.
    expect(imagesOf(canvas).filter((src) => src !== 'src:icon.locked')).toEqual(['stars', 'city', 'coins', 'chart', 'cheese', 'confetti', 'wheel', 'beach'].map((id) => `src:rat.backdrop.${id}`));
    expect(imagesOf(canvas).filter((src) => src === 'src:icon.locked')).toHaveLength(3);
    // A box for each of the nine backdrops and the eight colours, each on its ground; the first, nothing at all, 6 into its choice.
    const boxes = canvas.querySelectorAll(':scope > [data-skia="Group"]');
    expect(boxes).toHaveLength(17);
    expect(JSON.parse(boxes[0].getAttribute('data-props') ?? '{}').clip).toEqual({ x: 6, y: 36, width: 59.2, height: 59.2 });
    // The cross of nothing worn, over its picture.
    expect(screen.getByText('✕')).toBeTruthy();
  });

  it('never wears a prize not won yet: it says how it is won, and the rat is as it was', async () => {
    const told = editor({ tab: 'wear' });
    await layOut();
    const hats = screen.getByRole('radiogroup', { name: 'Headwear' });
    const crown = within(hats).getByRole('radio', { name: 'Crown' });
    expect(crown.getAttribute('data-locked')).toBe('true');
    fireEvent.click(crown);
    expect(told.locked).toEqual(['Unlocked on reaching rank king']);
    const gold = within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Gold jacket' });
    fireEvent.click(gold);
    expect(told.locked.at(-1)).toBe('Earned with the badge "badge escaped"');
    expect(told.picked).toEqual([]);
    expect(crown.getAttribute('aria-checked')).toBe('false');
    // Drawn grey and faint, under a lock, on the tab's canvas: a lock for each prize the player has not won.
    const canvas = choicesCanvas()!;
    const locks = imagesOf(canvas).filter((src) => src === 'src:icon.locked');
    expect(locks).toHaveLength(screen.getAllByRole('radio').filter((radio) => radio.getAttribute('data-locked') === 'true').length);
    expect(locks.length).toBeGreaterThan(0);
    expect(canvas.querySelectorAll('[data-skia="Group"][data-props*=\'"layer":{"element"\']')).toHaveLength(locks.length);
  });

  it('wears a prize once it is won', async () => {
    const told = editor({ tab: 'wear', earned: { escaped: { at: 1 } }, rank: 'king' });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Headwear' })).getByRole('radio', { name: 'Crown' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Gold jacket' }));
    expect(told.locked).toEqual([]);
    expect(told.picked).toEqual([{ ...LOOK, hat: 'crown' }, { ...LOOK, hat: 'crown', outfit: 'gold' }]);
    expect(within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Gold jacket' }).getAttribute('aria-checked')).toBe('true');
    for (const name of ['Crown', 'Gold jacket']) expect(screen.getByRole('radio', { name }).getAttribute('data-locked'), name).toBeNull();
    await settled();
  });

  it('draws again, on a pick, only the rat above the choices and the two choices it moves between: the same canvas, with the piece picked on it', async () => {
    editor({ tab: 'wear' });
    await layOut();
    const canvas = preview();
    expect(imagesOf(canvas)).toEqual(['src:rat.body.grey', 'src:rat.face.calm']);
    const pictures = choicesCanvas()!;
    const [drawn, rat, choices] = [canvases.drawn.length, count(PREVIEW), tiles.drawn];
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Headwear' })).getByRole('radio', { name: 'Beanie' }));
    await settled();
    expect(preview()).toBe(canvas);
    expect(imagesOf(canvas)).toEqual(['src:rat.body.grey', 'src:rat.face.calm', 'src:rat.hat.beanie']);
    expect(count(PREVIEW)).toBeGreaterThan(rat);
    // Only the rat above: each choice shows its piece on a plain rat of its own, and their canvas is not drawn again.
    expect(canvases.drawn.slice(drawn).every((size) => size === PREVIEW)).toBe(true);
    expect(choicesCanvas()).toBe(pictures);
    // And of what is pressed, the hat let go of and the one put on: none of the forty others.
    expect(tiles.drawn - choices).toBe(2);
  });

  it('mounts one canvas for a tab, and no other: the rat above them is not drawn again for another tab', async () => {
    editor();
    await layOut();
    const [rat, mounted] = [count(PREVIEW), canvases.mounted.length];
    expect(canvases.mounted).toEqual([PREVIEW, expect.stringMatching(/^380x/)]);
    for (const tab of ['Clothes', 'Backdrop', 'Body']) {
      const before = canvases.mounted.length;
      fireEvent.click(screen.getByRole('tab', { name: tab }));
      await layOut();
      // One canvas at most for the tab's forty-odd choices (or sixteen, or seventeen), where there was one a choice: none where the tab's canvas
      // stays and is only drawn again (a tab shown again, its pictures already read).
      expect(canvases.mounted.length - before, tab).toBeLessThanOrEqual(1);
      expect(choicesCanvas(), tab).toBeDefined();
    }
    expect(count(PREVIEW)).toBe(rat);
    expect(canvases.mounted.length).toBeLessThanOrEqual(mounted + 3);
    expect(canvases.mounted.filter((size) => size === PREVIEW)).toHaveLength(1);
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

  it('is saved through the game\'s cloud, the choice shown at once', async () => {
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
    const faces = await screen.findByRole('radiogroup', { name: 'Face' });
    fireEvent.click(within(faces).getByRole('radio', { name: 'Wink' }));
    await waitFor(() => expect(kept).toEqual([avatarOf({ ...ratLookOf(null, 'u-1'), face: 'wink' })]));
    expect(within(faces).getByRole('radio', { name: 'Wink' }).getAttribute('aria-checked')).toBe('true');
    // Picked again, it is already the rat: nothing to keep.
    fireEvent.click(within(faces).getByRole('radio', { name: 'Wink' }));
    await act(async () => undefined);
    expect(kept).toHaveLength(1);
  });
});
