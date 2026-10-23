// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { registerAsset } from 'react-native-web/dist/modules/AssetRegistry';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

vi.unmock('./Sprite');
vi.unmock('./Sprite.web');
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy(
    {},
    {
      get: (_, id) => ({ uri: `/sprites/${String(id)}.png` }),
      getOwnPropertyDescriptor: (_, id) => ({ value: { uri: `/sprites/${String(id)}.png` }, configurable: true, enumerable: true }),
    },
  ),
}));

const { loadSpritesWith, readAhead, readSprite, sourceOf, SPRITE_BUDGET_BYTES, spritesLoading, uriOf, useSpriteImage, useSpriteImages, useSpritesLoading } = await import('./spriteImages.web');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const picture = (uri: string, side = 8) => ({ uri, w: side, h: side });
beforeEach(() => loadSpritesWith(async (source) => picture((source as { uri: string }).uri)));

test('an image of the bundle is its address: a registry number as react-native-web serves it, an object with an address, the address itself', () => {
  const id = registerAsset({ httpServerLocation: '/assets/assets/sprites/icons', name: 'anim.coin.0', type: 'png', width: 48, height: 48, scales: [1] });
  expect(uriOf(id)).toBe('/assets/assets/sprites/icons/anim.coin.0.png');
  expect(uriOf({ uri: '/a.png' })).toBe('/a.png');
  expect(uriOf('/b.png')).toBe('/b.png');
  expect(uriOf({ uri: '' })).toBeNull();
  expect(uriOf(987654)).toBeNull();
  // The scale closest to the screen's, named as react-native-web names it.
  vi.stubGlobal('devicePixelRatio', 2);
  const two = registerAsset({ httpServerLocation: '/assets', name: 'x', type: 'png', scales: [1, 2, 3] });
  expect(uriOf(two)).toBe('/assets/x@2x.png');
});

test('a sprite has a file only if the bundle holds one', () => {
  expect(sourceOf('anim.coin.0')).toEqual({ uri: '/sprites/anim.coin.0.png' });
});

function Probe({ id }: { id: string | null }) {
  const { image, failed } = useSpriteImage(id);
  return <p data-state={failed ? 'failed' : image ? image.uri : 'loading'} />;
}

test('a sprite\'s picture is its address and size once the browser has the file: loading, then loaded, read once however many ask', async () => {
  const load = vi.fn(async (source: unknown) => picture((source as { uri: string }).uri, 48));
  loadSpritesWith(load as never);
  const { container } = render(
    <>
      <Probe id="anim.coin.0" />
      <Probe id="anim.coin.0" />
    </>,
  );
  expect(Array.from(container.querySelectorAll('p')).map((p) => p.dataset.state)).toEqual(['loading', 'loading']);
  await settle();
  expect(Array.from(container.querySelectorAll('p')).map((p) => p.dataset.state)).toEqual(['/sprites/anim.coin.0.png', '/sprites/anim.coin.0.png']);
  expect(load).toHaveBeenCalledTimes(1);
});

test('a file that cannot be loaded fails, told once; an id with no file never loads', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  loadSpritesWith(async () => null);
  const { container } = render(
    <>
      <Probe id="anim.coin.1" />
      <Probe id={null} />
    </>,
  );
  await settle();
  expect(Array.from(container.querySelectorAll('p')).map((p) => p.dataset.state)).toEqual(['failed', 'loading']);
  expect(warn).toHaveBeenCalledWith('sprite did not load: anim.coin.1');
  // A read that is refused outright ends the same way.
  loadSpritesWith(async () => {
    throw new Error('refused');
  });
  const again = render(<Probe id="anim.coin.2" />);
  await settle();
  expect((again.container.querySelector('p') as HTMLElement).dataset.state).toBe('failed');
});

test('several sprites at once: the same list while none changes', async () => {
  const seen: unknown[] = [];
  function Many() {
    seen.push(useSpriteImages(['anim.coin.0', null, 'anim.coin.1']));
    return null;
  }
  render(<Many />);
  await settle();
  const last = seen[seen.length - 1] as { image: unknown; failed: boolean }[];
  expect(last.map((state) => (state.image as { uri: string } | null)?.uri ?? null)).toEqual(['/sprites/anim.coin.0.png', null, '/sprites/anim.coin.1.png']);
});

test('the reads under way are counted until each file has loaded or failed, and a page can watch the count', async () => {
  const gates = new Map<string, (p: ReturnType<typeof picture> | null) => void>();
  loadSpritesWith((source) => new Promise((resolve) => gates.set((source as { uri: string }).uri, resolve)));
  const counts: number[] = [];
  function Watcher() {
    counts.push(useSpritesLoading());
    return null;
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<Watcher />);
  expect(spritesLoading()).toBe(0);
  readAhead(['anim.coin.0', 'anim.coin.1', 'anim.coin.2']);
  expect(spritesLoading()).toBe(3);
  await settle();
  expect(counts[counts.length - 1]).toBe(3);
  await act(async () => gates.get('/sprites/anim.coin.0.png')?.(picture('/sprites/anim.coin.0.png')));
  expect(spritesLoading()).toBe(2);
  await act(async () => gates.get('/sprites/anim.coin.1.png')?.(null));
  await act(async () => gates.get('/sprites/anim.coin.2.png')?.(picture('/x')));
  expect(spritesLoading()).toBe(0);
  expect(counts[counts.length - 1]).toBe(0);
});

test('reading ahead leaves a sprite already asked for as it is', async () => {
  const load = vi.fn(async (source: unknown) => picture((source as { uri: string }).uri));
  loadSpritesWith(load as never);
  readAhead(['anim.coin.0']);
  readAhead(['anim.coin.0']);
  await settle();
  expect(load).toHaveBeenCalledTimes(1);
});

test('a sprite read on its own is its address and size, or null where it cannot be loaded', async () => {
  expect(await readSprite('anim.coin.0')).toEqual(picture('/sprites/anim.coin.0.png'));
  loadSpritesWith(async () => null);
  expect(await readSprite('anim.coin.0')).toBeNull();
  loadSpritesWith(async () => {
    throw new Error('no');
  });
  expect(await readSprite('anim.coin.0')).toBeNull();
});

test('the browser\'s own loader: an image of its own, which says its size once it has the file, and null when the file is refused', async () => {
  class FakeImage {
    naturalWidth = 48;
    naturalHeight = 40;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    decode = vi.fn(async () => {});
    set src(uri: string) {
      queueMicrotask(() => (uri.includes('refused') ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
  // A module read afresh, so that its loader is the browser's own and not the one the tests above put in.
  vi.resetModules();
  const fresh = await import('./spriteImages.web');
  expect(await fresh.readSprite('anim.coin.0')).toEqual({ uri: '/sprites/anim.coin.0.png', w: 48, h: 40 });
  expect(await fresh.readSprite('test.refused')).toBeNull();
  expect(SPRITE_BUDGET_BYTES).toBeGreaterThan(0);
});
