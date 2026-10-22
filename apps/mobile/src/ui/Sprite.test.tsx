// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RatLook } from '@ratrace/core/game/avatar';

// How many paths were built (a checkerboard's cells are one): counted by the mock below.
const paths = vi.hoisted(() => ({ made: 0 }));

// Skia draws on the phone only: here each of its pieces is a <div> that says what it was asked to draw.
vi.mock('@shopify/react-native-skia', () => {
  const node =
    (kind: string) =>
    ({ children, image, blendMode, color, layer, sampling, width, height, x, y, matrix }: Record<string, unknown> & { children?: ReactNode }) => (
      <div
        data-skia={kind}
        data-matrix={matrix ? JSON.stringify(matrix) : undefined}
        data-image={(image as { src?: string } | null | undefined)?.src}
        data-blend={blendMode as string | undefined}
        data-color={color as string | undefined}
        data-layer={layer ? 'yes' : undefined}
        data-sampling={sampling ? JSON.stringify(sampling) : undefined}
        data-size={width !== undefined ? `${String(width)}x${String(height)}` : undefined}
        data-at={x !== undefined ? `${String(x)},${String(y)}` : undefined}
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
    Rect: node('Rect'),
    ColorMatrix: node('ColorMatrix'),
    Skia: {
      PathBuilder: {
        Make: () => {
          paths.made += 1;
          return { addRect: () => {}, detach: () => ({}) };
        },
      },
      XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
    },
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
const { Sprite, SpriteLayers, SpriteStrip } = await import('./Sprite');
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

test('a picture larger than its box (the web\'s `background-size: cover`) is drawn where it is placed, at a fraction of a point if that is where it falls, and cut by the box', async () => {
  const { container } = await drawn(<Sprite id="icon.cash" size={{ w: 366, h: 66 }} place={{ x: 0, y: -5.71, w: 366, h: 77.42 }} />);
  // The box is the banner's: the canvas cuts what hangs over it.
  expect(all(container, 'Canvas')[0].getAttribute('data-size')).toBe('366x66');
  const [image] = all(container, 'Image');
  expect(image.getAttribute('data-at')).toBe('0,-5.71');
  expect(image.getAttribute('data-size')).toBe('366x77.42');
  expect(image.getAttribute('data-sampling')).toBe(JSON.stringify({ filter: 0, mipmap: 0 }));
  // Unplaced, it fills its box from its corner.
  const plain = await drawn(<Sprite id="icon.cash" size={{ w: 16, h: 16 }} />);
  expect(all(plain.container, 'Image')[0].getAttribute('data-at')).toBe('0,0');
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

test('a greyed sprite (under the web\'s `grayscale` filter) is drawn through the filter\'s own matrix; a greyed silhouette is the grey of night-900', async () => {
  const { GREYSCALE } = await import('./theme');
  const { container } = await drawn(<Sprite id="icon.cash" grey />);
  const [image] = all(container, 'Image');
  const [matrix] = all(image, 'ColorMatrix');
  expect(matrix.getAttribute('data-matrix')).toBe(JSON.stringify(GREYSCALE));
  // Not greyed: no filter at all.
  const plain = await drawn(<Sprite id="icon.cash" />);
  expect(all(plain.container, 'ColorMatrix')).toHaveLength(0);
  const shadow = await drawn(<Sprite id="icon.cash" silhouette grey />);
  expect(all(shadow.container, 'Fill')[0].getAttribute('data-color')).toBe('#101010');
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

test('a loop\'s frames are one canvas, side by side: each drawn pixel for pixel into a box of one frame, the checkerboard for one that is missing', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = await drawn(<SpriteStrip ids={['anim.coin.0', 'anim.coin.1', 'no.such.frame', 'anim.coin.3']} frame={{ w: 24, h: 24 }} />);
  expect(all(container, 'Canvas').map((canvas) => canvas.getAttribute('data-size'))).toEqual(['96x24']);
  const images = all(container, 'Image');
  expect(images.map((image) => [image.getAttribute('data-image'), image.getAttribute('data-at'), image.getAttribute('data-size')])).toEqual([
    ['src:anim.coin.0', '0,0', '24x24'],
    ['src:anim.coin.1', '24,0', '24x24'],
    ['src:anim.coin.3', '72,0', '24x24'],
  ]);
  for (const image of images) expect(image.getAttribute('data-sampling')).toBe(JSON.stringify({ filter: 0, mipmap: 0 }));
  // The missing frame: the checkerboard's ground in its own box, and its cells.
  expect(all(container, 'Rect').map((rect) => rect.getAttribute('data-size'))).toEqual(['24x24']);
  expect(all(container, 'Path')).toHaveLength(1);
  expect(warn).toHaveBeenCalledWith('sprite missing: no.such.frame');
});

test('a picture laid with others builds no checkerboard when it is read: only the one that is missing does', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  paths.made = 0;
  const whole = await drawn(<SpriteStrip ids={['anim.coin.0', 'anim.coin.1', 'anim.coin.2', 'anim.coin.3']} frame={{ w: 24, h: 24 }} />);
  expect(all(whole.container, 'Image')).toHaveLength(4);
  expect(paths.made).toBe(0);
  whole.unmount();
  const holed = await drawn(<SpriteStrip ids={['anim.coin.0', 'no.such.frame', 'anim.coin.2', 'anim.coin.3']} frame={{ w: 24, h: 24 }} />);
  expect(all(holed.container, 'Path')).toHaveLength(1);
  expect(paths.made).toBe(1);
  holed.unmount();
});

test('pictures laid together are drawn once every one of them is in, all on one canvas handed its whole drawing: none comes in on its own later', async () => {
  const waiting = new Map<string, (image: unknown) => void>();
  loadSpritesWith((source) => new Promise((done) => waiting.set(String(source), done)) as never);
  const layers = [
    { id: 'backdrop.madrid', x: -10, y: -10, w: 64, h: 64 },
    { id: 'portrait.nurse.22', x: -10, y: -4, w: 64, h: 64 },
  ];
  const { container } = render(<SpriteLayers size={{ w: 44, h: 44 }} layers={layers} />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(all(container, 'Canvas')).toHaveLength(0);
  // The face first: still nothing, the sky is not in.
  await act(async () => {
    waiting.get('src:portrait.nurse.22')?.({ src: 'src:portrait.nurse.22', width: () => 64, height: () => 64, dispose: () => {} });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(all(container, 'Canvas')).toHaveLength(0);
  await act(async () => {
    waiting.get('src:backdrop.madrid')?.({ src: 'src:backdrop.madrid', width: () => 64, height: () => 64, dispose: () => {} });
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(all(container, 'Canvas').map((canvas) => canvas.getAttribute('data-size'))).toEqual(['44x44']);
  expect(all(container, 'Image').map((image) => [image.getAttribute('data-image'), image.getAttribute('data-at')])).toEqual([
    ['src:backdrop.madrid', '-10,-10'],
    ['src:portrait.nurse.22', '-10,-4'],
  ]);
});
