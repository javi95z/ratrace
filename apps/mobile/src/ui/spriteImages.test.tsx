// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { RatLook } from '@ratrace/core/game/avatar';

// Skia draws on the phone only: here each piece is a <div> that says what it was asked to draw.
vi.mock('@shopify/react-native-skia', () => {
  const node = (kind: string) => ({ children, image }: { children?: ReactNode; image?: { src?: string } | null }) => (
    <div data-skia={kind} data-image={image?.src}>{children}</div>
  );
  return {
    Canvas: node('Canvas'),
    Image: node('Image'),
    Group: node('Group'),
    Fill: node('Fill'),
    Path: node('Path'),
    Skia: { PathBuilder: { Make: () => ({ addRect: () => {}, detach: () => ({}) }) }, XYWHRect: () => ({}) },
    FilterMode: { Nearest: 0 },
    MipmapMode: { None: 0 },
  };
});
vi.mock('../sprites/sources', () => ({
  SOURCES: new Proxy({}, {
    get: (_, id) => `src:${String(id)}`,
    getOwnPropertyDescriptor: (_, id) => ({ value: `src:${String(id)}`, configurable: true, enumerable: true }),
  }),
}));

const { loadSpritesWith, readAhead, SPRITE_BUDGET_BYTES, spritesLoading, useSpriteImage, useSpritesLoading } = await import('./spriteImages');
const { Sprite } = await import('./Sprite');
const { RatLayers } = await import('./RatAvatar');

afterEach(() => vi.restoreAllMocks());

const all = (root: Element, kind: string) => Array.from(root.querySelectorAll(`[data-skia="${kind}"]`));
/** Lets the loads that are under way settle. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
/** A decoded picture as Skia's is: it knows its size, and it can be told it is no longer needed. */
const picture = (src: string, side = 8) => ({ src, width: () => side, height: () => side, dispose: vi.fn() });

test('two hundred sprites of one id in a list: one read and one decode, shared by all', async () => {
  const load = vi.fn(async (source: unknown) => picture(String(source)) as never);
  loadSpritesWith(load);
  const { container } = render(<>{Array.from({ length: 200 }, (_, i) => <Sprite key={i} id="icon.cash" />)}</>);
  await settle();
  expect(load).toHaveBeenCalledTimes(1);
  const images = all(container, 'Image');
  expect(images).toHaveLength(200);
  expect(new Set(images.map((i) => i.getAttribute('data-image')))).toEqual(new Set(['src:icon.cash']));
  // One drawn later finds the picture already decoded: drawn at once, read again never.
  const later = render(<Sprite id="icon.cash" />);
  expect(all(later.container, 'Image')).toHaveLength(1);
  expect(load).toHaveBeenCalledTimes(1);
});

test('sprites read ahead are read once, before anything draws them, and drawn at once when something does', async () => {
  const load = vi.fn(async (source: unknown) => picture(String(source)) as never);
  loadSpritesWith(load);
  readAhead(['icon.cash', 'icon.bond', 'icon.cash']);
  expect(load.mock.calls.map(([source]) => source)).toEqual(['src:icon.cash', 'src:icon.bond']);
  await settle();
  expect(spritesLoading()).toBe(0);
  // Read again ahead, or drawn: nothing is read again, and the picture is there from the first drawing.
  readAhead(['icon.bond']);
  const { container } = render(<Sprite id="icon.bond" />);
  expect(all(container, 'Image').map((i) => i.getAttribute('data-image'))).toEqual(['src:icon.bond']);
  expect(load).toHaveBeenCalledTimes(2);
});

test('a read that fails, or a file that does not decode, shows the checkerboard and is told once, never a crash', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  loadSpritesWith(async (source) => {
    if (String(source) === 'src:icon.bond') throw new Error('no such file');
    return null;
  });
  const { container } = render(
    <>
      <Sprite id="icon.bond" />
      <Sprite id="icon.bond" />
      <Sprite id="icon.crypto" />
    </>,
  );
  await settle();
  expect(all(container, 'Image')).toHaveLength(0);
  expect(all(container, 'Path')).toHaveLength(3);
  expect(warn.mock.calls).toEqual([['sprite did not load: icon.bond'], ['sprite did not load: icon.crypto']]);
});

test('the rat\'s layers come from the same pictures: two rats of one look read each piece once', async () => {
  const load = vi.fn(async (source: unknown) => picture(String(source)) as never);
  loadSpritesWith(load);
  const look: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };
  const { container } = render(<><RatLayers look={look} size={28} /><RatLayers look={look} size={92} /></>);
  await settle();
  expect(load).toHaveBeenCalledTimes(7);
  expect(all(container, 'Image')).toHaveLength(14);
});

/** A component that draws one sprite's picture: the cache counts it watched for as long as it is on screen. */
function Watch({ id }: { id: string }) {
  const { image } = useSpriteImage(id);
  return <div data-image={(image as unknown as { src?: string } | null)?.src} />;
}
/** Puts a sprite on screen and lets its picture arrive; the view's `unmount` takes it off again. */
async function show(id: string) {
  const view = render(<Watch id={id} />);
  await settle();
  return view;
}

/** Four mebibytes decoded each (1024 × 1024 × 4), so the budget of 24 holds six. */
const BIG = 1024;
function bigPictures() {
  const made: Array<ReturnType<typeof picture>> = [];
  const load = vi.fn(async (source: unknown) => {
    const one = picture(String(source), BIG);
    made.push(one);
    return one as never;
  });
  loadSpritesWith(load);
  return {
    load,
    /** The pictures let go so far, by sprite (one read twice is let go twice if it is). */
    disposed: () => made.filter((one) => one.dispose.mock.calls.length > 0).map((one) => one.src),
    /** The picture of a sprite as last read. */
    latest: (src: string) => made.findLast((one) => one.src === src)!,
  };
}

test('the cache keeps decoded pictures up to 24 MiB, counted as width × height × 4', async () => {
  expect(SPRITE_BUDGET_BYTES).toBe(24 * 1024 * 1024);
  const { load, disposed } = bigPictures();
  // Six of 4 MiB fill the budget exactly: nothing is forgotten, however long ago it was put down.
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) (await show(id)).unmount();
  expect(disposed()).toEqual([]);
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) (await show(id)).unmount();
  expect(load).toHaveBeenCalledTimes(6);
});

test('past the budget the picture drawn longest ago, with no one watching it, is forgotten and disposed; asked for again it is read once more', async () => {
  const { load, disposed } = bigPictures();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) (await show(id)).unmount();
  // The seventh does not fit: the first goes.
  (await show('g')).unmount();
  expect(disposed()).toEqual(['src:a']);
  expect(load).toHaveBeenCalledTimes(7);
  // The ones that stayed are not read again.
  (await show('c')).unmount();
  expect(load).toHaveBeenCalledTimes(7);
  // The forgotten one is: one read more, and now b (drawn longest ago, c was just drawn again) makes the room.
  (await show('a')).unmount();
  expect(load).toHaveBeenCalledTimes(8);
  expect(disposed()).toEqual(['src:a', 'src:b']);
});

test('"longest ago" is when a picture was last asked for, not when it was read', async () => {
  const { disposed } = bigPictures();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) (await show(id)).unmount();
  // a is drawn again, so b is now the one drawn longest ago.
  (await show('a')).unmount();
  (await show('g')).unmount();
  expect(disposed()).toEqual(['src:b']);
});

test('a picture someone is watching is never forgotten, however old; the cache then holds more than its budget until it is put down', async () => {
  const { load, latest, disposed } = bigPictures();
  const kept = await show('a');
  for (const id of ['b', 'c', 'd', 'e', 'f']) (await show(id)).unmount();
  // Past the budget: a, the oldest, is on screen, so b goes instead.
  (await show('g')).unmount();
  expect(disposed()).toEqual(['src:b']);
  expect(latest('src:a').dispose).not.toHaveBeenCalled();
  // Everything on screen at once: nothing can go, and nothing does.
  const open = [kept];
  for (const id of ['c', 'd', 'e', 'f', 'g', 'h']) open.push(await show(id));
  expect(disposed()).toEqual(['src:b']);
  expect(load).toHaveBeenCalledTimes(8);
  // Put down, the oldest are forgotten at once, until the cache is within its budget again.
  open.forEach((view) => view.unmount());
  expect(disposed()).toEqual(['src:a', 'src:b']);
});

test('a sprite that failed to load is never forgotten: it costs nothing and is told once, however much comes after it', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  loadSpritesWith(async (source) => {
    if (String(source) === 'src:bad') throw new Error('no such file');
    return picture(String(source), BIG) as never;
  });
  (await show('bad')).unmount();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) (await show(id)).unmount();
  (await show('bad')).unmount();
  expect(warn.mock.calls).toEqual([['sprite did not load: bad']]);
});

test('says how many sprites are being read, so a page can tell when every picture is in (the scenes are shot only then)', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const reads = new Map<string, { done(ok: boolean): void }>();
  loadSpritesWith(
    (source) =>
      new Promise((resolve) => {
        reads.set(String(source), { done: (ok) => resolve(ok ? (picture(String(source)) as never) : null) });
      }),
  );
  let seen = -1;
  function Watch() {
    seen = useSpritesLoading();
    return null;
  }
  render(
    <>
      <Watch />
      <Sprite id="icon.cash" />
      <Sprite id="icon.cash" />
      <Sprite id="icon.crypto" />
    </>,
  );
  await settle();
  // Two reads under way (one id is read once, however many draw it), and the page told so.
  expect(spritesLoading()).toBe(2);
  expect(seen).toBe(2);
  reads.get('src:icon.cash')!.done(true);
  await settle();
  expect(seen).toBe(1);
  // A read that ends in nothing is over too: the checkerboard is all there will be.
  reads.get('src:icon.crypto')!.done(false);
  await settle();
  expect(spritesLoading()).toBe(0);
  expect(seen).toBe(0);
  // Read with something else from now on: whatever was under way is forgotten.
  render(<Sprite id="icon.bond" />);
  await settle();
  expect(spritesLoading()).toBe(1);
  loadSpritesWith(async () => null);
  expect(spritesLoading()).toBe(0);
});
