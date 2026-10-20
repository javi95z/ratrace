// @vitest-environment jsdom
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { RatLook } from '@ratrace/core/game/avatar';

// Skia draws on the phone only: here each of its pieces is a <div> that says what it was asked to draw.
vi.mock('@shopify/react-native-skia', () => {
  const node =
    (kind: string) =>
    ({ children, image, blendMode, color, layer, sampling, width, height }: Record<string, unknown> & { children?: ReactNode }) => (
      <div
        data-skia={kind}
        data-image={(image as { src?: string } | null | undefined)?.src}
        data-blend={blendMode as string | undefined}
        data-color={color as string | undefined}
        data-layer={layer ? 'yes' : undefined}
        data-sampling={sampling ? JSON.stringify(sampling) : undefined}
        data-size={width !== undefined ? `${String(width)}x${String(height)}` : undefined}
      >
        {children}
      </div>
    );
  return {
    Canvas: ({ children, style }: { children?: ReactNode; style?: { width: number; height: number } }) => (
      <div data-skia="Canvas" data-size={style ? `${style.width}x${style.height}` : undefined}>
        {children}
      </div>
    ),
    Image: node('Image'),
    Group: node('Group'),
    Fill: node('Fill'),
    Path: node('Path'),
    useImage: (source: unknown) => (source ? { src: String(source) } : null),
    Skia: { PathBuilder: { Make: () => ({ addRect: () => {}, detach: () => ({}) }) }, XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }) },
    FilterMode: { Nearest: 0, Linear: 1 },
    MipmapMode: { None: 0 },
  };
});
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => `src:${String(id)}`,
      getOwnPropertyDescriptor: (_, id) => ({ value: `src:${String(id)}`, configurable: true, enumerable: true }),
    },
  ),
}));

const { Sprite } = await import('./Sprite');
const { RatAvatar, RatLayers } = await import('./RatAvatar');

afterEach(() => vi.restoreAllMocks());

const all = (root: Element, kind: string) => Array.from(root.querySelectorAll(`[data-skia="${kind}"]`));

test('a sprite is drawn pixel for pixel: nearest neighbour, no mipmaps, at its box', () => {
  const { container } = render(<Sprite id="icon.cash" scale={3} />);
  expect(all(container, 'Canvas')[0].getAttribute('data-size')).toBe('96x96');
  const [image] = all(container, 'Image');
  expect(image.getAttribute('data-image')).toBe('src:icon.cash');
  expect(image.getAttribute('data-sampling')).toBe(JSON.stringify({ filter: 0, mipmap: 0 }));
  expect(image.getAttribute('data-size')).toBe('96x96');
});

test('a silhouette is the sprite as a mask over night-900', () => {
  const { container } = render(<Sprite id="icon.cash" silhouette />);
  const [group] = all(container, 'Group');
  expect(group.getAttribute('data-layer')).toBe('yes');
  const fill = all(group, 'Fill')[0];
  expect(fill.getAttribute('data-blend')).toBe('srcIn');
  expect(fill.getAttribute('data-color')).toBe('#0b1022');
  expect(all(group, 'Image')).toHaveLength(1);
});

test('a sprite that does not exist: the checkerboard at the fallback size, logged once, no crash', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = render(
    <>
      <Sprite id="test.not_there" fallback={{ w: 20, h: 12 }} scale={2} />
      <Sprite id="test.not_there" fallback={{ w: 20, h: 12 }} scale={2} />
    </>,
  );
  expect(all(container, 'Image')).toHaveLength(0);
  const canvases = all(container, 'Canvas');
  expect(canvases.map((c) => c.getAttribute('data-size'))).toEqual(['40x24', '40x24']);
  expect(all(canvases[0], 'Fill')[0].getAttribute('data-color')).toBe('#1f2a4d');
  expect(all(canvases[0], 'Path')[0].getAttribute('data-color')).toBe('#263566');
  expect(warn.mock.calls).toEqual([['sprite missing: test.not_there']]);
});

test('alt names the picture for a screen reader; without it the sprite is hidden from one', () => {
  const { getByLabelText, container } = render(
    <>
      <Sprite id="icon.cash" alt="cash" />
      <Sprite id="icon.cash" />
    </>,
  );
  expect(getByLabelText('cash')).toBeTruthy();
  expect(container.querySelectorAll('[aria-label]')).toHaveLength(1);
});

const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };

test('the rat: its layers in order on one canvas, the body cut by its outfit\'s clip', () => {
  const { container } = render(<RatLayers look={look} size={92} />);
  expect(all(container, 'Canvas')[0].getAttribute('data-size')).toBe('92x92');
  const images = all(container, 'Image').map((i) => [i.getAttribute('data-image'), i.getAttribute('data-blend')]);
  expect(images).toEqual([
    ['src:rat.backdrop.stars', null],
    ['src:rat.body.grey', null],
    ['src:rat.clip.suit', 'dstIn'],
    ['src:rat.face.grin', null],
    ['src:rat.outfit.suit', null],
    ['src:rat.eyes.round', null],
    ['src:rat.hat.crown', null],
  ]);
  const clipped = all(container, 'Group').find((g) => g.getAttribute('data-layer') === 'yes');
  expect(all(clipped!, 'Image').map((i) => i.getAttribute('data-image'))).toEqual(['src:rat.body.grey', 'src:rat.clip.suit']);
});

test('RatAvatar: the box at 32 / 44 / 96 with the whole rat inside its 2 pt border, on its colour', () => {
  for (const [size, box] of [['sm', 32], ['md', 44], ['lg', 96]] as const) {
    const { container, unmount } = render(<RatAvatar look={look} size={size} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe(`${box}px`);
    expect(root.style.height).toBe(`${box}px`);
    expect(root.style.backgroundColor).toBe('rgb(127, 209, 185)');
    expect([root.style.overflowX, root.style.overflowY]).toEqual(['hidden', 'hidden']);
    expect(root.style.borderTopWidth).toBe('2px');
    expect(root.style.borderLeftColor).toBe('rgb(11, 16, 34)');
    expect(all(root, 'Canvas')[0].getAttribute('data-size')).toBe(`${box - 4}x${box - 4}`);
    unmount();
  }
});
