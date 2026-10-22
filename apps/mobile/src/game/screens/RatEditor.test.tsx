// @vitest-environment jsdom
import { avatarOf, ratLookOf } from '@ratrace/core/game/avatar';
import type { RatLook } from '@ratrace/core/game/avatar';
import type { RankId } from '@ratrace/content';
import type { Account, Community } from '@ratrace/online/types';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createElement, useState } from 'react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSpritesWith } from '../../ui/spriteImages';
import { memoryServices, renderGame, spriteRenders } from '../../testing/render';
import { settled } from '../../testing/renders';
import { PlayerProfile } from './PlayerProfile';
import { RatEditor } from './RatEditor';

/** Every canvas drawn, by its size, in the order drawn: the rat above the choices is 44 square, a choice's as wide as the page lays it out (none here). */
const canvases = vi.hoisted(() => ({ drawn: [] as string[] }));
vi.mock('../../ui/Canvas', async (original) => {
  const real = await original<typeof import('../../ui/Canvas')>();
  return {
    Canvas: (props: ComponentProps<typeof real.Canvas>) => {
      const style = props.style as { width?: number; height?: number } | undefined;
      canvases.drawn.push(`${style?.width}x${style?.height}`);
      return createElement(real.Canvas, props);
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
});
afterEach(cleanup);

const LOOK: RatLook = { colour: 'sky', body: 'grey', face: 'calm', outfit: null, hat: null, eyes: null, backdrop: null };
const PREVIEW = '44x44';
const CHOICE = '0x0';
const count = (size: string) => canvases.drawn.filter((drawn) => drawn === size).length;

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

  it('opens on the tab it is given, for a scene', async () => {
    editor({ tab: 'scene' });
    expect(screen.getByRole('tab', { name: 'Backdrop' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))).toEqual(['Backdrop', 'Colour']);
    // A backdrop is shown alone, its picture filling the choice.
    expect(spriteRenders.get('rat.backdrop.stars')).toBeGreaterThan(0);
    await settled();
  });

  it('never wears a prize not won yet: it says how it is won, and the rat is as it was', async () => {
    const told = editor({ tab: 'wear' });
    const hats = screen.getByRole('radiogroup', { name: 'Headwear' });
    const crown = within(hats).getByRole('radio', { name: 'Crown' });
    expect(crown.querySelector('[data-sprite="icon.locked"]')).not.toBeNull();
    fireEvent.click(crown);
    expect(told.locked).toEqual(['Unlocked on reaching rank king']);
    const gold = within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Gold jacket' });
    fireEvent.click(gold);
    expect(told.locked.at(-1)).toBe('Earned with the badge "badge escaped"');
    expect(told.picked).toEqual([]);
    expect(crown.getAttribute('aria-checked')).toBe('false');
    // Drawn grey, under a lock.
    expect(spriteRenders.get('icon.locked')).toBeGreaterThan(0);
    await settled();
  });

  it('wears a prize once it is won', async () => {
    const told = editor({ tab: 'wear', earned: { escaped: { at: 1 } }, rank: 'king' });
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Headwear' })).getByRole('radio', { name: 'Crown' }));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Gold jacket' }));
    expect(told.locked).toEqual([]);
    expect(told.picked).toEqual([{ ...LOOK, hat: 'crown' }, { ...LOOK, hat: 'crown', outfit: 'gold' }]);
    expect(within(screen.getByRole('radiogroup', { name: 'Clothes' })).getByRole('radio', { name: 'Gold jacket' }).getAttribute('aria-checked')).toBe('true');
    await settled();
  });

  it('draws again, on a pick, only the rat above the choices: the same canvas, with the piece picked on it', async () => {
    editor({ tab: 'wear' });
    await settled();
    const canvas = preview();
    expect(imagesOf(canvas)).toEqual(['src:rat.body.grey', 'src:rat.face.calm']);
    const [choices, rat] = [count(CHOICE), count(PREVIEW)];
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Headwear' })).getByRole('radio', { name: 'Beanie' }));
    await settled();
    expect(preview()).toBe(canvas);
    expect(imagesOf(canvas)).toEqual(['src:rat.body.grey', 'src:rat.face.calm', 'src:rat.hat.beanie']);
    expect(count(PREVIEW)).toBeGreaterThan(rat);
    // Each choice shows its piece on a plain rat of its own: none of them is drawn again.
    expect(count(CHOICE)).toBe(choices);
  });

  it('draws, on another tab, only that tab\'s choices: the rat above them is not drawn again', async () => {
    editor();
    await settled();
    const rat = count(PREVIEW);
    const drawn = canvases.drawn.length;
    fireEvent.click(screen.getByRole('tab', { name: 'Clothes' }));
    await settled();
    expect(count(PREVIEW)).toBe(rat);
    // Nothing but the choices of the tab: a canvas each for the clothes, the hats and the eyes (and each again once its pictures are read).
    expect(canvases.drawn.slice(drawn).every((size) => size === CHOICE)).toBe(true);
    const shown = screen.getAllByRole('radio').length;
    expect(canvases.drawn.length - drawn).toBeGreaterThanOrEqual(shown);
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
