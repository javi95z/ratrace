// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

// The setup of the phone's tests replaces the phone's Sprite with a fake; this is the web's own.
vi.unmock('./Sprite');
vi.unmock('./Sprite.web');
// Every sprite's file is served at an address of its own.
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => ({ uri: `/sprites/${String(id)}.png` }),
      getOwnPropertyDescriptor: (_, id) => ({ value: { uri: `/sprites/${String(id)}.png` }, configurable: true, enumerable: true }),
    },
  ),
}));

const { loadSpritesWith, spritesLoading } = await import('./spriteImages.web');
const { ArtScale, PIXELATED, Sprite, SpriteLayers, SpriteStrip } = await import('./Sprite.web');

afterEach(() => vi.restoreAllMocks());
// Every file loaded as soon as it is asked for: what each test looks at is what is drawn once it is in.
beforeEach(() => {
  loadSpritesWith(async (source) => ({ uri: (source as { uri: string }).uri, w: 8, h: 8 }));
});
/** Renders, then lets the files asked for arrive. */
async function drawn(ui: React.ReactElement) {
  const result = render(ui);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return result;
}
const imgs = (root: Element) => Array.from(root.querySelectorAll('img'));

test('a known sprite at scale 2 is an img of twice its art size, never smoothed', async () => {
  const { container } = await drawn(<Sprite id="anim.coin.0" scale={2} alt="a coin" />);
  const [img] = imgs(container);
  // anim.coin.0 is 48 x 48 art pixels.
  expect(img.style.width).toBe('96px');
  expect(img.style.height).toBe('96px');
  expect(img.style.imageRendering).toBe('pixelated');
  expect(img.getAttribute('src')).toBe('/sprites/anim.coin.0.png');
  expect(img.getAttribute('alt')).toBe('a coin');
  expect(img.getAttribute('aria-hidden')).toBeNull();
  expect(img.draggable).toBe(false);
  expect(PIXELATED).toEqual({ imageRendering: 'pixelated' });
});

test('the box is there while the file loads, and empty: nothing moves when it arrives', async () => {
  let arrive: (picture: { uri: string; w: number; h: number }) => void = () => {};
  loadSpritesWith(() => new Promise((resolve) => (arrive = resolve)));
  const { container } = render(<Sprite id="anim.coin.0" scale={2} alt="a coin" />);
  expect(imgs(container)).toHaveLength(0);
  expect(spritesLoading()).toBe(1);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.width).toBe('96px');
  expect(box.style.height).toBe('96px');
  await act(async () => arrive({ uri: '/sprites/anim.coin.0.png', w: 48, h: 48 }));
  expect(imgs(container)).toHaveLength(1);
  expect(spritesLoading()).toBe(0);
});

test('a picture without a name is hidden from a screen reader', async () => {
  const { container } = await drawn(<Sprite id="anim.coin.0" />);
  expect(imgs(container)[0].getAttribute('alt')).toBe('');
  expect(imgs(container)[0].getAttribute('aria-hidden')).toBe('true');
});

test('the stage\'s scale is the one `art` asks for', async () => {
  const { container } = await drawn(
    <ArtScale.Provider value={2}>
      <Sprite id="anim.coin.0" scale="art" />
    </ArtScale.Provider>,
  );
  expect(imgs(container)[0].style.width).toBe('96px');
});

test('a sprite that does not exist is the checkerboard at the fallback size, logged once', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = await drawn(<Sprite id="test.not_there_web" fallback={{ w: 20, h: 12 }} alt="missing" />);
  expect(imgs(container)).toHaveLength(0);
  const placeholder = container.querySelector('[data-sprite-missing="test.not_there_web"]') as HTMLElement;
  expect(placeholder).not.toBeNull();
  expect(placeholder.style.width).toBe('20px');
  expect(placeholder.style.height).toBe('12px');
  // It keeps the name it was given.
  expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('missing');
  await drawn(<Sprite id="test.not_there_web" />);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith('sprite missing: test.not_there_web');
});

test('a sprite whose file does not load is the checkerboard at its own size, logged once', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  loadSpritesWith(async () => null);
  const { container } = await drawn(<Sprite id="anim.coin.1" scale={2} />);
  expect(imgs(container)).toHaveLength(0);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.width).toBe('96px');
  expect(container.firstElementChild?.firstElementChild?.getAttribute('data-sprite-missing')).toBe('anim.coin.1');
  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith('sprite did not load: anim.coin.1');
});

test('a file the browser then refuses to draw is the checkerboard too', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = await drawn(<Sprite id="anim.coin.2" />);
  const img = imgs(container)[0];
  await act(async () => {
    img.dispatchEvent(new Event('error'));
  });
  expect(imgs(container)).toHaveLength(0);
  expect(container.querySelector('[data-sprite-missing="anim.coin.2"]')).not.toBeNull();
});

test('a size forces the box, and a place lays the picture in it at a fraction of a point, cut by the box', async () => {
  const forced = await drawn(<Sprite id="anim.coin.0" scale={3} size={{ w: 16, h: 16 }} />);
  expect((forced.container.firstElementChild as HTMLElement).style.width).toBe('16px');
  expect(imgs(forced.container)[0].style.width).toBe('16px');
  expect(imgs(forced.container)[0].style.height).toBe('16px');

  const placed = await drawn(<Sprite id="anim.coin.0" size={{ w: 366, h: 66 }} place={{ x: 0, y: -5.71, w: 366, h: 77.42 }} />);
  const box = placed.container.firstElementChild as HTMLElement;
  expect(box.style.width).toBe('366px');
  expect(getComputedStyle(box).overflowX).toBe('hidden');
  const img = imgs(placed.container)[0];
  expect(img.style.position).toBe('absolute');
  expect(img.style.top).toBe('-5.71px');
  expect(img.style.left).toBe('0px');
  expect(img.style.width).toBe('366px');
  expect(img.style.height).toBe('77.42px');
  expect(img.style.imageRendering).toBe('pixelated');
});

test('a grey sprite goes through the grayscale filter', async () => {
  const { container } = await drawn(<Sprite id="anim.coin.0" grey />);
  expect(imgs(container)[0].style.filter).toBe('grayscale(1)');
});

test('a silhouette is the sprite as a mask over night-900, with no picture and no name', async () => {
  const { container } = await drawn(<Sprite id="anim.coin.0" silhouette alt="ignored" />);
  expect(imgs(container)).toHaveLength(0);
  const mask = container.querySelector('[data-silhouette="anim.coin.0"]') as HTMLElement;
  expect(mask).not.toBeNull();
  expect(mask.style.backgroundColor).toBe('rgb(11, 16, 34)');
  expect(mask.style.maskImage).toBe('url("/sprites/anim.coin.0.png")');
  expect(mask.getAttribute('aria-hidden')).toBe('true');
  expect(container.querySelector('[role="img"]')).toBeNull();
  // Greyed, it is the grey of night-900.
  const grey = await drawn(<Sprite id="anim.coin.0" silhouette grey />);
  expect((grey.container.querySelector('[data-silhouette]') as HTMLElement).style.backgroundColor).toBe('rgb(16, 16, 16)');
});

test('what is given to a sprite is laid over its picture, in its box', async () => {
  const { container } = await drawn(
    <Sprite id="anim.coin.0">
      <span data-testid="over" />
    </Sprite>,
  );
  const box = container.firstElementChild as HTMLElement;
  const kinds = Array.from(box.children).map((c) => c.tagName);
  expect(kinds[0]).toBe('IMG');
  expect(box.querySelector('[data-testid="over"]')).not.toBeNull();
});

test('what is laid over a picture blends with it: its layer is no stacking context of its own (a legendary card\'s rainbow, `mix-blend-mode: overlay`)', async () => {
  const { container } = await drawn(
    <Sprite id="anim.coin.0">
      <span data-testid="over" />
    </Sprite>,
  );
  const layer = (container.querySelector('[data-testid="over"]') as HTMLElement).parentElement as HTMLElement;
  expect(layer.parentElement).toBe(container.firstElementChild);
  // react-native-web's View is `z-index: 0` (its class), which isolates what is in it: the rainbow blended with nothing, a veil over the picture.
  expect(layer.className).not.toMatch(/css-view/);
  expect(layer.style.zIndex).toBe('');
  expect([layer.style.position, layer.style.inset]).toEqual(['absolute', '0px']);
  // As on the phone, where it is drawn in the sprite's canvas, it takes no touch.
  expect(layer.style.pointerEvents).toBe('none');
});

test('pictures laid one over the other stand in one box, the first at the bottom, each where it lies', async () => {
  const layers = [
    { id: 'anim.coin.0', x: 0, y: 0, w: 48, h: 48 },
    { id: 'anim.coin.1', x: 10, y: 6, w: 24, h: 24, grey: true },
  ];
  const { container } = await drawn(<SpriteLayers size={{ w: 60, h: 50 }} layers={layers} alt="two coins" />);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.width).toBe('60px');
  expect(box.style.height).toBe('50px');
  expect(getComputedStyle(box).overflowX).toBe('hidden');
  expect(box.getAttribute('aria-label')).toBe('two coins');
  const pictures = imgs(container);
  expect(pictures.map((p) => p.getAttribute('src'))).toEqual(['/sprites/anim.coin.0.png', '/sprites/anim.coin.1.png']);
  expect(pictures[1].style.left).toBe('10px');
  expect(pictures[1].style.top).toBe('6px');
  expect(pictures[1].style.width).toBe('24px');
  expect(pictures[1].style.filter).toBe('grayscale(1)');
  expect(pictures[0].style.filter).toBe('');
  expect(pictures.every((p) => p.style.imageRendering === 'pixelated')).toBe(true);
});

test('nothing of the layers is drawn until every picture is in, and one that failed is the checkerboard in its box', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  let arrive: (picture: { uri: string; w: number; h: number } | null) => void = () => {};
  loadSpritesWith((source) =>
    (source as { uri: string }).uri.endsWith('anim.coin.0.png') ? Promise.resolve({ uri: '/sprites/anim.coin.0.png', w: 48, h: 48 }) : new Promise((resolve) => (arrive = resolve)),
  );
  const layers = [
    { id: 'anim.coin.0', x: 0, y: 0, w: 48, h: 48 },
    { id: 'anim.coin.3', x: 4, y: 4, w: 16, h: 16 },
    { id: 'test.not_there_layer', x: 8, y: 8, w: 12, h: 12 },
  ];
  const { container } = render(<SpriteLayers size={{ w: 48, h: 48 }} layers={layers} />);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(imgs(container)).toHaveLength(0);
  await act(async () => arrive(null));
  expect(imgs(container).map((p) => p.getAttribute('src'))).toEqual(['/sprites/anim.coin.0.png']);
  expect(container.querySelectorAll('[data-sprite-missing]')).toHaveLength(2);
});

test('a strip shows its frames side by side, each in a box of the frame\'s size', async () => {
  const { container } = await drawn(<SpriteStrip ids={['anim.coin.0', 'anim.coin.1', 'anim.coin.2']} frame={{ w: 48, h: 48 }} />);
  const box = container.firstElementChild as HTMLElement;
  expect(box.style.width).toBe('144px');
  expect(box.style.height).toBe('48px');
  const frames = imgs(container);
  expect(frames.map((f) => f.getAttribute('src'))).toEqual(['/sprites/anim.coin.0.png', '/sprites/anim.coin.1.png', '/sprites/anim.coin.2.png']);
  expect(frames.map((f) => f.style.left)).toEqual(['0px', '48px', '96px']);
  expect(frames.every((f) => f.style.width === '48px' && f.style.height === '48px')).toBe(true);
});
