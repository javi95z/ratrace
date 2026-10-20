// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
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

const { Group } = await import('@shopify/react-native-skia');
const { loadSpritesWith } = await import('./spriteImages');
const { Sprite } = await import('./Sprite');
const { RatAvatar, RatLayers } = await import('./RatAvatar');

afterEach(() => vi.restoreAllMocks());
// Every picture decoded as soon as it is asked for: what each test looks at is what is drawn once it is in.
beforeEach(async () => {
  loadSpritesWith(async (source) => ({ src: String(source), width: () => 8, height: () => 8, dispose: () => {} }) as never);
});
/** Renders, then lets the pictures asked for arrive. */
async function drawn(ui: React.ReactElement) {
  const result = render(ui);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}

const all = (root: Element, kind: string) => Array.from(root.querySelectorAll(`[data-skia="${kind}"]`));

test('a sprite is drawn pixel for pixel: nearest neighbour, no mipmaps, at its box', async () => {
  const { container } = await drawn(<Sprite id="icon.cash" scale={3} />);
  expect(all(container, 'Canvas')[0].getAttribute('data-size')).toBe('96x96');
  const [image] = all(container, 'Image');
  expect(image.getAttribute('data-image')).toBe('src:icon.cash');
  expect(image.getAttribute('data-sampling')).toBe(JSON.stringify({ filter: 0, mipmap: 0 }));
  expect(image.getAttribute('data-size')).toBe('96x96');
});

test('a sprite forced to a size (the web\'s `!h-4 !w-4`) is drawn at that box, whatever its art is: nearest neighbour into it', async () => {
  const { container } = await drawn(<Sprite id="icon.cash" size={{ w: 16, h: 16 }} />);
  expect(all(container, 'Canvas')[0].getAttribute('data-size')).toBe('16x16');
  expect(all(container, 'Image')[0].getAttribute('data-size')).toBe('16x16');
  expect(all(container, 'Image')[0].getAttribute('data-sampling')).toBe(JSON.stringify({ filter: 0, mipmap: 0 }));
  // A size is the whole box: no scale multiplies it, and a sprite that is not there is the checkerboard at that size.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const missing = await drawn(<Sprite id="test.not_there_sized" scale={3} size={{ w: 20, h: 12.5 }} />);
  expect(all(missing.container, 'Canvas')[0].getAttribute('data-size')).toBe('20x12.5');
  warn.mockRestore();
});

test('what is given to a sprite is drawn over its picture, in its own canvas', async () => {
  const { container } = await drawn(
    <Sprite id="icon.cash">
      <Group />
    </Sprite>,
  );
  const canvas = all(container, 'Canvas')[0];
  const kinds = Array.from(canvas.children).map((c) => c.getAttribute('data-skia'));
  expect(kinds).toEqual(['Image', 'Group']);
});

test('a silhouette is the sprite as a mask over night-900', async () => {
  const { container } = await drawn(<Sprite id="icon.cash" silhouette />);
  const [group] = all(container, 'Group');
  expect(group.getAttribute('data-layer')).toBe('yes');
  const fill = all(group, 'Fill')[0];
  expect(fill.getAttribute('data-blend')).toBe('srcIn');
  expect(fill.getAttribute('data-color')).toBe('#0b1022');
  expect(all(group, 'Image')).toHaveLength(1);
});

test('a sprite that does not exist: the checkerboard at the fallback size, logged once, no crash', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = await drawn(
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

test('alt names the picture for a screen reader; without it the sprite is hidden from one', async () => {
  const { getByLabelText, container } = await drawn(
    <>
      <Sprite id="icon.cash" alt="cash" />
      <Sprite id="icon.cash" />
    </>,
  );
  expect(getByLabelText('cash')).toBeTruthy();
  expect(container.querySelectorAll('[aria-label]')).toHaveLength(1);
});

const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };

test('the rat: its layers in order on one canvas, the body cut by its outfit\'s clip', async () => {
  const { container } = await drawn(<RatLayers look={look} size={92} />);
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

test('RatAvatar: the box at 32 / 44 / 96 with the whole rat inside its 2 pt border, on its colour', async () => {
  for (const [size, box] of [['sm', 32], ['md', 44], ['lg', 96]] as const) {
    const { container, unmount } = await drawn(<RatAvatar look={look} size={size} />);
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
